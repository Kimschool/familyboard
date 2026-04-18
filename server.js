require('dotenv').config();
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const { ensureSchema, getPool } = require('./db');
const {
  bootstrapAdmin, login, logout, verify, issueToken,
  requireAuth, requireAdmin, publicUser,
  newInviteToken, INVITE_TTL_DAYS,
} = require('./auth');

const app = express();
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false }));

process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));
process.on('uncaughtException',  (e) => console.error('[uncaughtException]',  e));

// ---------- cookie parser ----------
app.use((req, _res, next) => {
  const raw = req.headers.cookie || '';
  req.cookies = Object.fromEntries(
    raw.split(';').map((s) => s.trim()).filter(Boolean).map((p) => {
      const i = p.indexOf('=');
      return i < 0 ? [p, ''] : [p.slice(0, i), decodeURIComponent(p.slice(i + 1))];
    })
  );
  next();
});

// ---------- cache ----------
const cache = new Map();
function cacheGet(key, ttlMs) {
  const v = cache.get(key); if (!v) return null;
  if (Date.now() - v.t > ttlMs) { cache.delete(key); return null; }
  return v.data;
}
function cacheSet(key, data) { cache.set(key, { t: Date.now(), data }); }

const setSessionCookie = (res, token) =>
  res.setHeader('Set-Cookie',
    `fb_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 86400}`);

// ---------- 헬스 ----------
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// ---------- 가족 조회 (public): 별칭으로 멤버 목록 ----------
app.get('/api/family/:alias', async (req, res) => {
  try {
    const alias = (req.params.alias || '').trim();
    const [f] = await getPool().query(
      'SELECT id, alias, display_name FROM families WHERE alias = ? LIMIT 1', [alias]
    );
    if (!f.length) return res.status(404).json({ error: 'not-found' });
    const [users] = await getPool().query(
      `SELECT id, display_name, icon, role, birth_year, birth_month, birth_day,
              phone, mood, mood_date,
              (password_hash IS NOT NULL) AS activated
         FROM users WHERE family_id = ?
         ORDER BY role DESC, id ASC`,
      [f[0].id]
    );
    const todayStr = new Intl.DateTimeFormat('sv-SE', {
      timeZone: process.env.DEFAULT_TZ || 'Asia/Tokyo',
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
    res.json({
      family: { alias: f[0].alias, displayName: f[0].display_name },
      members: users.map((u) => {
        const moodYmd = u.mood_date
          ? new Intl.DateTimeFormat('sv-SE', { year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date(u.mood_date))
          : null;
        const moodToday = moodYmd === todayStr ? u.mood : null;
        return {
          id: u.id,
          displayName: u.display_name,
          icon: u.icon,
          role: u.role,
          birthYear: u.birth_year,
          birthMonth: u.birth_month,
          birthDay: u.birth_day,
          phone: u.phone || null,
          mood: moodToday,
          activated: !!u.activated,
        };
      }),
    });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

// ---------- 인증 ----------
app.post('/api/login', async (req, res) => {
  try {
    const r = await login({
      alias: req.body?.alias,
      userId: req.body?.userId,
      username: req.body?.username,
      password: req.body?.password,
    });
    if (!r) return res.status(401).json({ error: 'invalid' });
    setSessionCookie(res, r.token);
    const me = await verify(r.token);
    res.json({ ok: true, user: publicUser(me) });
  } catch (e) {
    console.error('[login] error:', e.message);
    res.status(500).json({ error: 'login-failed', message: e.message });
  }
});

app.get('/api/me', async (req, res) => {
  const u = await verify(req.cookies?.fb_token);
  if (!u) return res.json({ authed: false });
  res.json({ authed: true, user: publicUser(u) });
});

app.post('/api/me/mood', requireAuth, async (req, res) => {
  try {
    const mood = (req.body?.mood || '').toString().trim();
    if (mood && mood.length > 20) return res.status(400).json({ error: 'too-long' });
    const tz = process.env.DEFAULT_TZ || 'Asia/Tokyo';
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    await getPool().query(
      'UPDATE users SET mood = ?, mood_date = ? WHERE id = ?',
      [mood || null, mood ? today : null, req.user.id]
    );
    if (mood) {
      await getPool().query(
        `INSERT INTO mood_history (user_id, mood, mood_date) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE mood = VALUES(mood)`,
        [req.user.id, mood, today]
      );
    } else {
      await getPool().query(
        'DELETE FROM mood_history WHERE user_id = ? AND mood_date = ?',
        [req.user.id, today]
      );
    }
    res.json({ ok: true, mood: mood || null });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.get('/api/user/:id/moods/week', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
    const [check] = await getPool().query(
      'SELECT id FROM users WHERE id = ? AND family_id = ? LIMIT 1',
      [id, req.user.family_id]
    );
    if (!check.length) return res.status(404).json({ error: 'not-found' });

    const tz = process.env.DEFAULT_TZ || 'Asia/Tokyo';
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const [rows] = await getPool().query(
      `SELECT DATE_FORMAT(mood_date, '%Y-%m-%d') AS d, mood
         FROM mood_history
        WHERE user_id = ? AND mood_date >= DATE_SUB(?, INTERVAL 6 DAY)`,
      [id, today]
    );
    const map = new Map(rows.map((r) => [r.d, r.mood]));
    const days = [];
    const t = new Date(today);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() - i);
      const ymd = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      days.push({ date: ymd, mood: map.get(ymd) || null, weekday: ['일','월','화','수','목','금','토'][d.getDay()] });
    }
    res.json(days);
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.post('/api/logout', async (req, res) => {
  await logout(req.cookies?.fb_token);
  res.setHeader('Set-Cookie', 'fb_token=; Path=/; Max-Age=0');
  res.json({ ok: true });
});

// ---------- 초대 (public) ----------
app.get('/api/invite/:token', async (req, res) => {
  try {
    const token = req.params.token;
    const [rows] = await getPool().query(
      `SELECT u.id, u.display_name, u.icon, u.invite_expires_at,
              f.alias AS family_alias, f.display_name AS family_name
         FROM users u JOIN families f ON f.id = u.family_id
        WHERE u.invite_token = ? LIMIT 1`,
      [token]
    );
    if (!rows.length) return res.status(404).json({ error: 'invalid-invite' });
    const u = rows[0];
    if (u.invite_expires_at && new Date(u.invite_expires_at) < new Date()) {
      return res.status(410).json({ error: 'expired' });
    }
    res.json({
      family: { alias: u.family_alias, displayName: u.family_name },
      member: { id: u.id, displayName: u.display_name, icon: u.icon },
    });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.post('/api/invite/:token/accept', async (req, res) => {
  try {
    const token = req.params.token;
    const pw = (req.body?.password || '').toString();
    if (pw.length < 4) return res.status(400).json({ error: 'password-too-short' });

    const [rows] = await getPool().query(
      'SELECT id, invite_expires_at FROM users WHERE invite_token = ? LIMIT 1',
      [token]
    );
    if (!rows.length) return res.status(404).json({ error: 'invalid-invite' });
    if (rows[0].invite_expires_at && new Date(rows[0].invite_expires_at) < new Date()) {
      return res.status(410).json({ error: 'expired' });
    }
    const uid = rows[0].id;
    const hash = bcrypt.hashSync(pw, 10);
    await getPool().query(
      'UPDATE users SET password_hash = ?, invite_token = NULL, invite_expires_at = NULL WHERE id = ?',
      [hash, uid]
    );
    const r = await issueToken(uid);
    setSessionCookie(res, r.token);
    const me = await verify(r.token);
    res.json({ ok: true, user: publicUser(me) });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

// ---------- 가족 관리 (관리자) ----------
app.get('/api/users', requireAdmin, async (req, res) => {
  const [rows] = await getPool().query(
    `SELECT id, username, display_name, role, icon, birth_year, birth_month, birth_day, is_lunar,
            (password_hash IS NOT NULL) AS activated,
            invite_token, invite_expires_at
       FROM users WHERE family_id = ? ORDER BY role DESC, id ASC`,
    [req.user.family_id]
  );
  res.json(rows.map((r) => ({
    ...publicUser(r),
    activated: !!r.activated,
    inviteToken: r.invite_token,
    inviteExpiresAt: r.invite_expires_at,
  })));
});

app.post('/api/users', requireAdmin, async (req, res) => {
  try {
    const { username, displayName, role, icon, birthYear, birthMonth, birthDay, isLunar } = req.body || {};
    const u = (username || '').trim();
    const d = (displayName || '').trim();
    const r = role === 'admin' ? 'admin' : 'member';
    const ic = (icon || 'star').trim();
    if (!u || !d) return res.status(400).json({ error: 'invalid-input' });
    const by = Number(birthYear) || null;
    const bm = Number(birthMonth) || null;
    const bd = Number(birthDay) || null;
    if (bm !== null && !(bm >= 1 && bm <= 12)) return res.status(400).json({ error: 'bad-month' });
    if (bd !== null && !(bd >= 1 && bd <= 31)) return res.status(400).json({ error: 'bad-day' });

    const token = newInviteToken();
    const expires = new Date(Date.now() + INVITE_TTL_DAYS * 86400_000);
    const [result] = await getPool().query(
      `INSERT INTO users (family_id, username, display_name, role, icon, password_hash,
                          invite_token, invite_expires_at, birth_year, birth_month, birth_day, is_lunar)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
      [req.user.family_id, u, d, r, ic, token, expires, by, bm, bd, isLunar ? 1 : 0]
    );
    res.json({ ok: true, id: result.insertId, inviteToken: token, inviteExpiresAt: expires });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      const m = e.sqlMessage.includes('uniq_family_display') ? 'display-exists' : 'username-exists';
      return res.status(409).json({ error: m });
    }
    res.status(500).json({ error: 'internal', message: e.message });
  }
});

app.post('/api/users/:id/invite', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
    const [rows] = await getPool().query(
      'SELECT id FROM users WHERE id = ? AND family_id = ? LIMIT 1',
      [id, req.user.family_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'not-found' });

    const token = newInviteToken();
    const expires = new Date(Date.now() + INVITE_TTL_DAYS * 86400_000);
    // 비번도 초기화 (재설정 요청)
    await getPool().query(
      'UPDATE users SET invite_token = ?, invite_expires_at = ?, password_hash = NULL WHERE id = ?',
      [token, expires, id]
    );
    res.json({ ok: true, inviteToken: token, inviteExpiresAt: expires });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.patch('/api/users/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });

  const updates = [], args = [];
  const { displayName, role, icon, birthYear, birthMonth, birthDay, isLunar, password, phone } = req.body || {};
  if (displayName !== undefined) { updates.push('display_name = ?'); args.push(String(displayName).trim()); }
  if (role !== undefined && (role === 'admin' || role === 'member')) { updates.push('role = ?'); args.push(role); }
  if (icon !== undefined) { updates.push('icon = ?'); args.push(String(icon).trim() || 'star'); }
  if (birthYear !== undefined)  { updates.push('birth_year = ?');  args.push(Number(birthYear)  || null); }
  if (birthMonth !== undefined) { updates.push('birth_month = ?'); args.push(Number(birthMonth) || null); }
  if (birthDay !== undefined)   { updates.push('birth_day = ?');   args.push(Number(birthDay)   || null); }
  if (isLunar !== undefined)    { updates.push('is_lunar = ?');    args.push(isLunar ? 1 : 0); }
  if (phone !== undefined)      { updates.push('phone = ?');       args.push(String(phone).trim() || null); }
  if (password) { updates.push('password_hash = ?'); args.push(bcrypt.hashSync(password, 10)); }

  if (!updates.length) return res.json({ ok: true });
  args.push(id, req.user.family_id);
  try {
    await getPool().query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ? AND family_id = ?`, args);
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'display-exists' });
    res.status(500).json({ error: 'internal', message: e.message });
  }
});

app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
  if (id === req.user.id) return res.status(400).json({ error: 'cannot-delete-self' });

  // 마지막 관리자 삭제 방지
  const [target] = await getPool().query(
    'SELECT role FROM users WHERE id = ? AND family_id = ? LIMIT 1',
    [id, req.user.family_id]
  );
  if (!target.length) return res.status(404).json({ error: 'not-found' });
  if (target[0].role === 'admin') {
    const [cnt] = await getPool().query(
      "SELECT COUNT(*) AS c FROM users WHERE family_id = ? AND role = 'admin'",
      [req.user.family_id]
    );
    if (cnt[0].c <= 1) return res.status(400).json({ error: 'last-admin' });
  }

  await getPool().query('DELETE FROM users WHERE id = ? AND family_id = ?', [id, req.user.family_id]);
  await getPool().query('DELETE FROM sessions WHERE user_id = ?', [id]);
  res.json({ ok: true });
});

// ---------- 약 복용 체크 ----------
app.get('/api/meds', requireAuth, async (req, res) => {
  try {
    const today = todayLocal();
    const [rows] = await getPool().query(
      `SELECT m.id, m.name, m.schedule, m.sort_order,
              EXISTS (SELECT 1 FROM med_checks c WHERE c.med_id = m.id AND c.check_date = ?) AS done_today
         FROM meds m
        WHERE m.user_id = ? ORDER BY FIELD(m.schedule,'morning','lunch','evening','night'), m.sort_order, m.id`,
      [today, req.user.id]
    );
    if (!rows.length) return res.json([]);
    // 최근 7일 체크 내역
    const ids = rows.map((r) => r.id);
    const [checks] = await getPool().query(
      `SELECT med_id, DATE_FORMAT(check_date, '%Y-%m-%d') AS d
         FROM med_checks
        WHERE med_id IN (?) AND check_date >= DATE_SUB(?, INTERVAL 6 DAY)`,
      [ids, today]
    );
    const byMed = new Map();
    for (const c of checks) {
      const set = byMed.get(c.med_id) || new Set();
      set.add(c.d);
      byMed.set(c.med_id, set);
    }
    // 7일 날짜 배열 (오래된 → 오늘)
    const days = [];
    const t = new Date(today);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() - i);
      days.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
    }
    res.json(rows.map((r) => ({
      ...r,
      done_today: !!r.done_today,
      last7: days.map((d) => ({ date: d, done: (byMed.get(r.id) || new Set()).has(d) })),
    })));
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.post('/api/meds', requireAuth, async (req, res) => {
  try {
    const name = (req.body?.name || '').toString().trim().slice(0, 100);
    const schedule = ['morning','lunch','evening','night'].includes(req.body?.schedule)
      ? req.body.schedule : 'morning';
    if (!name) return res.status(400).json({ error: 'name-required' });
    const [r] = await getPool().query(
      `INSERT INTO meds (family_id, user_id, name, schedule, sort_order)
       VALUES (?, ?, ?, ?, 0)`,
      [req.user.family_id, req.user.id, name, schedule]
    );
    res.json({ ok: true, id: r.insertId });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.post('/api/meds/:id/check', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
    // 본인 것만
    const [check] = await getPool().query(
      'SELECT id FROM meds WHERE id = ? AND user_id = ? LIMIT 1', [id, req.user.id]
    );
    if (!check.length) return res.status(404).json({ error: 'not-found' });
    const today = todayLocal();
    const [existing] = await getPool().query(
      'SELECT id FROM med_checks WHERE med_id = ? AND check_date = ? LIMIT 1',
      [id, today]
    );
    if (existing.length) {
      await getPool().query('DELETE FROM med_checks WHERE id = ?', [existing[0].id]);
      res.json({ ok: true, done_today: false });
    } else {
      await getPool().query(
        'INSERT INTO med_checks (med_id, check_date) VALUES (?, ?)',
        [id, today]
      );
      res.json({ ok: true, done_today: true });
    }
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.delete('/api/meds/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
  await getPool().query(
    'DELETE FROM meds WHERE id = ? AND user_id = ?', [id, req.user.id]
  );
  res.json({ ok: true });
});

// ---------- 응원 스티커 ----------
app.get('/api/stickers/today', requireAuth, async (req, res) => {
  try {
    const today = todayLocal();
    const [rows] = await getPool().query(
      `SELECT s.receiver_id, s.sender_id, s.emoji,
              u.display_name AS sender_name, u.icon AS sender_icon,
              r.display_name AS receiver_name, r.icon AS receiver_icon
         FROM family_stickers s
         JOIN users u ON u.id = s.sender_id
         JOIN users r ON r.id = s.receiver_id
        WHERE s.family_id = ? AND s.sticker_date = ?
        ORDER BY s.created_at DESC`,
      [req.user.family_id, today]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.get('/api/stickers/week-ranking', requireAuth, async (req, res) => {
  try {
    // 이번 주 (최근 7일) 보낸/받은 개수 집계
    const [sent] = await getPool().query(
      `SELECT s.sender_id AS user_id, COUNT(*) AS cnt,
              u.display_name, u.icon
         FROM family_stickers s
         JOIN users u ON u.id = s.sender_id
        WHERE s.family_id = ? AND s.sticker_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        GROUP BY s.sender_id ORDER BY cnt DESC`,
      [req.user.family_id]
    );
    const [received] = await getPool().query(
      `SELECT s.receiver_id AS user_id, COUNT(*) AS cnt,
              u.display_name, u.icon
         FROM family_stickers s
         JOIN users u ON u.id = s.receiver_id
        WHERE s.family_id = ? AND s.sticker_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        GROUP BY s.receiver_id ORDER BY cnt DESC`,
      [req.user.family_id]
    );
    res.json({
      sent: sent.map((r) => ({ userId: r.user_id, name: r.display_name, icon: r.icon, count: Number(r.cnt) })),
      received: received.map((r) => ({ userId: r.user_id, name: r.display_name, icon: r.icon, count: Number(r.cnt) })),
    });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.post('/api/sticker', requireAuth, async (req, res) => {
  try {
    const receiverId = Number(req.body?.receiverId);
    const emoji = (req.body?.emoji || '').toString().slice(0, 10);
    if (!Number.isInteger(receiverId) || !emoji) return res.status(400).json({ error: 'bad-input' });
    if (receiverId === req.user.id) return res.status(400).json({ error: 'self-not-allowed' });
    const today = todayLocal();
    // 같은 가족 확인
    const [check] = await getPool().query(
      'SELECT id FROM users WHERE id = ? AND family_id = ? LIMIT 1',
      [receiverId, req.user.family_id]
    );
    if (!check.length) return res.status(404).json({ error: 'not-found' });

    // 토글
    const [existing] = await getPool().query(
      `SELECT id FROM family_stickers
        WHERE sender_id = ? AND receiver_id = ? AND emoji = ? AND sticker_date = ?
        LIMIT 1`,
      [req.user.id, receiverId, emoji, today]
    );
    if (existing.length) {
      await getPool().query('DELETE FROM family_stickers WHERE id = ?', [existing[0].id]);
      res.json({ ok: true, sent: false });
    } else {
      await getPool().query(
        `INSERT INTO family_stickers (family_id, sender_id, receiver_id, emoji, sticker_date)
         VALUES (?, ?, ?, ?, ?)`,
        [req.user.family_id, req.user.id, receiverId, emoji, today]
      );
      res.json({ ok: true, sent: true });
    }
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

// ---------- 응급 연락처 ----------
app.get('/api/emergency', requireAuth, async (req, res) => {
  const [rows] = await getPool().query(
    `SELECT id, name, phone, icon, sort_order
       FROM emergency_contacts WHERE family_id = ?
       ORDER BY sort_order ASC, id ASC`,
    [req.user.family_id]
  );
  res.json(rows);
});

app.post('/api/emergency', requireAdmin, async (req, res) => {
  try {
    const name = (req.body?.name || '').toString().trim();
    const phone = (req.body?.phone || '').toString().trim();
    const icon = (req.body?.icon || 'heart').toString().trim();
    const sortOrder = Number(req.body?.sortOrder) || 0;
    if (!name || !phone) return res.status(400).json({ error: 'name-phone-required' });
    const [r] = await getPool().query(
      `INSERT INTO emergency_contacts (family_id, name, phone, icon, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.family_id, name.slice(0, 50), phone.slice(0, 30), icon.slice(0, 30), sortOrder]
    );
    res.json({ ok: true, id: r.insertId });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.patch('/api/emergency/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
    const updates = [], args = [];
    if (req.body?.name !== undefined)  { updates.push('name = ?');  args.push(String(req.body.name).trim().slice(0, 50)); }
    if (req.body?.phone !== undefined) { updates.push('phone = ?'); args.push(String(req.body.phone).trim().slice(0, 30)); }
    if (req.body?.icon !== undefined)  { updates.push('icon = ?');  args.push(String(req.body.icon).trim().slice(0, 30) || 'heart'); }
    if (req.body?.sortOrder !== undefined) { updates.push('sort_order = ?'); args.push(Number(req.body.sortOrder) || 0); }
    if (!updates.length) return res.json({ ok: true });
    args.push(id, req.user.family_id);
    await getPool().query(
      `UPDATE emergency_contacts SET ${updates.join(', ')} WHERE id = ? AND family_id = ?`, args);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.delete('/api/emergency/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
  await getPool().query(
    'DELETE FROM emergency_contacts WHERE id = ? AND family_id = ?',
    [id, req.user.family_id]
  );
  res.json({ ok: true });
});

// ---------- 가족 정보 (관리자: 별칭 수정) ----------
app.get('/api/family', requireAuth, async (req, res) => {
  const [rows] = await getPool().query(
    `SELECT f.alias, f.display_name, f.notice, f.notice_updated_at,
            u.display_name AS notice_by_name, u.icon AS notice_by_icon
       FROM families f
       LEFT JOIN users u ON u.id = f.notice_updated_by
      WHERE f.id = ? LIMIT 1`,
    [req.user.family_id]
  );
  const r = rows[0];
  if (!r) return res.json({});

  // 현재 공지 ID (가장 최근 notice_history row) + 읽음 상태 + 반응
  let noticeId = null;
  let reads = [];
  let reactions = [];
  if (r.notice) {
    const [n] = await getPool().query(
      `SELECT id FROM notice_history WHERE family_id = ? ORDER BY created_at DESC LIMIT 1`,
      [req.user.family_id]
    );
    if (n.length) {
      noticeId = n[0].id;
      const [rr] = await getPool().query(
        `SELECT nr.user_id, u.display_name, u.icon
           FROM notice_reads nr JOIN users u ON u.id = nr.user_id
          WHERE nr.notice_id = ?`,
        [noticeId]
      );
      reads = rr;
      const [agg] = await getPool().query(
        `SELECT emoji, COUNT(*) AS c, SUM(user_id = ?) AS mine
           FROM notice_reactions WHERE notice_id = ? GROUP BY emoji`,
        [req.user.id, noticeId]
      );
      reactions = agg.map((x) => ({ emoji: x.emoji, count: Number(x.c), mine: Number(x.mine) > 0 }));
    }
  }

  res.json({
    alias: r.alias,
    displayName: r.display_name,
    notice: r.notice || null,
    noticeId,
    noticeUpdatedAt: r.notice_updated_at,
    noticeBy: r.notice_by_name ? { name: r.notice_by_name, icon: r.notice_by_icon } : null,
    noticeReads: reads.map((r) => ({ userId: r.user_id, name: r.display_name, icon: r.icon })),
    noticeReactions: reactions,
  });
});

// ---------- 가족 투표 ----------
app.get('/api/poll/active', requireAuth, async (req, res) => {
  try {
    const [polls] = await getPool().query(
      `SELECT p.id, p.title, p.options, p.author_id, p.created_at,
              u.display_name AS author_name, u.icon AS author_icon
         FROM family_polls p JOIN users u ON u.id = p.author_id
        WHERE p.family_id = ? AND p.closed = 0
        ORDER BY p.created_at DESC LIMIT 1`,
      [req.user.family_id]
    );
    if (!polls.length) return res.json(null);
    const p = polls[0];
    const [votes] = await getPool().query(
      `SELECT pv.option_index, pv.user_id, u.display_name, u.icon
         FROM poll_votes pv JOIN users u ON u.id = pv.user_id
        WHERE pv.poll_id = ?`, [p.id]
    );
    const options = (typeof p.options === 'string' ? JSON.parse(p.options) : p.options);
    const myVote = votes.find((v) => v.user_id === req.user.id);
    res.json({
      id: p.id,
      title: p.title,
      options,
      author: { id: p.author_id, name: p.author_name, icon: p.author_icon },
      createdAt: p.created_at,
      myVote: myVote ? myVote.option_index : null,
      votes: votes.map((v) => ({ optionIndex: v.option_index, name: v.display_name, icon: v.icon })),
    });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.post('/api/poll', requireAuth, async (req, res) => {
  try {
    const title = (req.body?.title || '').toString().trim().slice(0, 200);
    const options = Array.isArray(req.body?.options)
      ? req.body.options.map((x) => String(x).trim()).filter(Boolean).slice(0, 8) : [];
    if (!title) return res.status(400).json({ error: 'title-required' });
    if (options.length < 2) return res.status(400).json({ error: 'need-2-options' });
    // 기존 active 투표 모두 닫기
    await getPool().query(
      'UPDATE family_polls SET closed = 1 WHERE family_id = ? AND closed = 0',
      [req.user.family_id]
    );
    const [r] = await getPool().query(
      `INSERT INTO family_polls (family_id, author_id, title, options) VALUES (?, ?, ?, ?)`,
      [req.user.family_id, req.user.id, title, JSON.stringify(options)]
    );
    res.json({ ok: true, id: r.insertId });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.post('/api/poll/:id/vote', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const idx = Number(req.body?.optionIndex);
    if (!Number.isInteger(id) || !Number.isInteger(idx)) return res.status(400).json({ error: 'bad-input' });
    const [p] = await getPool().query(
      `SELECT options FROM family_polls WHERE id = ? AND family_id = ? AND closed = 0 LIMIT 1`,
      [id, req.user.family_id]
    );
    if (!p.length) return res.status(404).json({ error: 'not-found-or-closed' });
    const options = (typeof p[0].options === 'string' ? JSON.parse(p[0].options) : p[0].options);
    if (idx < 0 || idx >= options.length) return res.status(400).json({ error: 'bad-option' });

    await getPool().query(
      `INSERT INTO poll_votes (poll_id, user_id, option_index) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE option_index = VALUES(option_index), voted_at = CURRENT_TIMESTAMP`,
      [id, req.user.id, idx]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.post('/api/poll/:id/close', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
  // 작성자 또는 admin
  const [p] = await getPool().query(
    'SELECT author_id FROM family_polls WHERE id = ? AND family_id = ? LIMIT 1',
    [id, req.user.family_id]
  );
  if (!p.length) return res.status(404).json({ error: 'not-found' });
  if (p[0].author_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'forbidden' });
  }
  await getPool().query('UPDATE family_polls SET closed = 1 WHERE id = ?', [id]);
  res.json({ ok: true });
});

// ---------- 공지 이모지 반응 ----------
app.post('/api/notice/:id/react', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
    const emoji = (req.body?.emoji || '').toString().slice(0, 10);
    if (!emoji) return res.status(400).json({ error: 'empty' });

    // 같은 가족 공지인지
    const [ok] = await getPool().query(
      'SELECT 1 FROM notice_history WHERE id = ? AND family_id = ? LIMIT 1',
      [id, req.user.family_id]
    );
    if (!ok.length) return res.status(404).json({ error: 'not-found' });

    const [existing] = await getPool().query(
      'SELECT 1 FROM notice_reactions WHERE notice_id = ? AND user_id = ? AND emoji = ? LIMIT 1',
      [id, req.user.id, emoji]
    );
    if (existing.length) {
      await getPool().query(
        'DELETE FROM notice_reactions WHERE notice_id = ? AND user_id = ? AND emoji = ?',
        [id, req.user.id, emoji]
      );
    } else {
      await getPool().query(
        'INSERT INTO notice_reactions (notice_id, user_id, emoji) VALUES (?, ?, ?)',
        [id, req.user.id, emoji]
      );
    }
    const [agg] = await getPool().query(
      `SELECT emoji, COUNT(*) AS c, SUM(user_id = ?) AS mine
         FROM notice_reactions WHERE notice_id = ? GROUP BY emoji`,
      [req.user.id, id]
    );
    res.json({
      ok: true,
      reactions: agg.map((r) => ({ emoji: r.emoji, count: Number(r.c), mine: Number(r.mine) > 0 })),
    });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.post('/api/notice/:id/read', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
  await getPool().query(
    `INSERT IGNORE INTO notice_reads (notice_id, user_id) VALUES (?, ?)`,
    [id, req.user.id]
  );
  res.json({ ok: true });
});

app.patch('/api/family', requireAdmin, async (req, res) => {
  try {
    const { alias, displayName, notice } = req.body || {};
    const upd = [], args = [];
    if (alias !== undefined) { upd.push('alias = ?'); args.push(String(alias).trim()); }
    if (displayName !== undefined) { upd.push('display_name = ?'); args.push(String(displayName).trim()); }
    if (notice !== undefined) {
      const n = String(notice).trim();
      upd.push('notice = ?'); args.push(n || null);
      upd.push('notice_updated_at = ?'); args.push(n ? new Date() : null);
      upd.push('notice_updated_by = ?'); args.push(n ? req.user.id : null);
      // 공지 히스토리 — 새 내용이면 append
      if (n) {
        await getPool().query(
          'INSERT INTO notice_history (family_id, text, author_id) VALUES (?, ?, ?)',
          [req.user.family_id, n.slice(0, 500), req.user.id]
        );
      }
    }
    if (!upd.length) return res.json({ ok: true });
    args.push(req.user.family_id);
    await getPool().query(`UPDATE families SET ${upd.join(', ')} WHERE id = ?`, args);
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'alias-exists' });
    res.status(500).json({ error: 'internal', message: e.message });
  }
});

app.get('/api/notice/history', requireAuth, async (req, res) => {
  const [rows] = await getPool().query(
    `SELECT n.id, n.text, n.created_at,
            u.display_name AS author_name, u.icon AS author_icon
       FROM notice_history n
       LEFT JOIN users u ON u.id = n.author_id
      WHERE n.family_id = ?
      ORDER BY n.created_at DESC LIMIT 30`,
    [req.user.family_id]
  );
  res.json(rows);
});

// ---------- 날씨 / 대기질 / 환율 ----------
const TZ_ENC = encodeURIComponent(process.env.DEFAULT_TZ || 'Asia/Tokyo');

app.get('/api/weather', async (_req, res) => {
  try {
    const lat = process.env.DEFAULT_LAT || '35.6895';
    const lon = process.env.DEFAULT_LON || '139.6917';
    const key = `weather:${lat},${lon}`;
    const cached = cacheGet(key, 10 * 60 * 1000);
    if (cached) return res.json(cached);

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
      `&hourly=temperature_2m,precipitation_probability,weather_code` +
      `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max` +
      `&timezone=${TZ_ENC}&forecast_days=2`;
    const j = await (await fetch(url)).json();
    const out = {
      city: process.env.DEFAULT_CITY || '도쿄',
      temp: Math.round(j.current?.temperature_2m ?? 0),
      feels: Math.round(j.current?.apparent_temperature ?? 0),
      humidity: Math.round(j.current?.relative_humidity_2m ?? 0),
      wind: Math.round(j.current?.wind_speed_10m ?? 0),
      code: j.current?.weather_code ?? 0,
      max: Math.round(j.daily?.temperature_2m_max?.[0] ?? 0),
      min: Math.round(j.daily?.temperature_2m_min?.[0] ?? 0),
      rainProb: j.daily?.precipitation_probability_max?.[0] ?? 0,
      tomorrow: j.daily?.temperature_2m_max?.[1] != null ? {
        max: Math.round(j.daily.temperature_2m_max[1]),
        min: Math.round(j.daily.temperature_2m_min[1]),
        code: j.daily.weather_code?.[1] ?? 0,
        rainProb: j.daily.precipitation_probability_max?.[1] ?? 0,
      } : null,
    };
    // 시간별 — 현재 시각부터 다음 12시간 (1시간 간격 12포인트)
    if (j.hourly?.time?.length) {
      const nowIdx = j.hourly.time.findIndex((t) => new Date(t) >= new Date()) || 0;
      const picks = [];
      for (let i = Math.max(0, nowIdx); i < j.hourly.time.length && picks.length < 12; i += 1) {
        picks.push({
          time: j.hourly.time[i],
          temp: Math.round(j.hourly.temperature_2m[i]),
          code: j.hourly.weather_code[i],
          rainProb: j.hourly.precipitation_probability?.[i] ?? 0,
        });
      }
      out.hourly = picks;
    }
    cacheSet(key, out);
    res.json(out);
  } catch (e) { res.status(502).json({ error: 'weather-fetch-failed', message: e.message }); }
});

app.get('/api/air', async (_req, res) => {
  try {
    const lat = process.env.DEFAULT_LAT || '35.6895';
    const lon = process.env.DEFAULT_LON || '139.6917';
    const key = `air:${lat},${lon}`;
    const cached = cacheGet(key, 30 * 60 * 1000);
    if (cached) return res.json(cached);

    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
      `&current=pm10,pm2_5,alder_pollen,birch_pollen,grass_pollen&timezone=${TZ_ENC}`;
    const j = await (await fetch(url)).json();

    const pm10 = j.current?.pm10 ?? null;
    const pm25 = j.current?.pm2_5 ?? null;
    const pollen = Math.max(
      j.current?.alder_pollen ?? 0, j.current?.birch_pollen ?? 0, j.current?.grass_pollen ?? 0
    );
    const out = {
      pm10, pm25,
      pm10Level: level(pm10, [30, 80, 150]),
      pm25Level: level(pm25, [15, 35, 75]),
      pollen, pollenLevel: level(pollen, [1, 10, 50]),
    };
    cacheSet(key, out);
    res.json(out);
  } catch (e) { res.status(502).json({ error: 'air-fetch-failed', message: e.message }); }
});
function level(v, [g, m, b]) {
  if (v == null) return 'unknown';
  if (v <= g) return 'good'; if (v <= m) return 'normal'; if (v <= b) return 'bad';
  return 'worst';
}

app.get('/api/fx', async (_req, res) => {
  try {
    const key = 'fx:USD';
    const cached = cacheGet(key, 60 * 60 * 1000);
    if (cached) return res.json(cached);
    const j = await (await fetch('https://open.er-api.com/v6/latest/USD')).json();
    if (j.result !== 'success') throw new Error('fx-bad-response');
    const krw = j.rates.KRW, jpy = j.rates.JPY;
    const out = {
      ts: j.time_last_update_unix * 1000,
      usdKrw: Math.round(krw),
      usdJpy: Math.round(jpy * 100) / 100,
      jpyKrw: Math.round((krw / jpy) * 100 * 100) / 100,
      rates: j.rates, base: 'USD',
    };
    cacheSet(key, out);
    res.json(out);
  } catch (e) { res.status(502).json({ error: 'fx-fetch-failed', message: e.message }); }
});

// ---------- 메모 (가족 단위) ----------
app.get('/api/memos', requireAuth, async (req, res) => {
  const [rows] = await getPool().query(
    `SELECT m.id, m.content, m.done, m.important, m.due_date, m.recurring, m.created_at,
            COALESCE(u.display_name, '') AS created_by_name, u.icon AS created_by_icon
       FROM memos m LEFT JOIN users u ON u.id = m.created_by
      WHERE m.family_id = ?
      ORDER BY m.done ASC, m.important DESC, m.id DESC LIMIT 100`,
    [req.user.family_id]
  );
  if (!rows.length) return res.json(rows);
  const ids = rows.map((r) => r.id);
  const [rx] = await getPool().query(
    `SELECT memo_id, emoji, user_id FROM memo_reactions WHERE memo_id IN (?)`,
    [ids]
  );
  for (const m of rows) {
    const list = rx.filter((r) => r.memo_id === m.id);
    const by = new Map();
    for (const r of list) {
      const v = by.get(r.emoji) || { emoji: r.emoji, count: 0, mine: false };
      v.count += 1;
      if (r.user_id === req.user.id) v.mine = true;
      by.set(r.emoji, v);
    }
    m.reactions = [...by.values()];
  }
  res.json(rows);
});

app.post('/api/memo/:id/react', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const emoji = (req.body?.emoji || '').toString().slice(0, 10);
    if (!Number.isInteger(id) || !emoji) return res.status(400).json({ error: 'bad-input' });
    const [ok] = await getPool().query(
      'SELECT 1 FROM memos WHERE id = ? AND family_id = ? LIMIT 1',
      [id, req.user.family_id]
    );
    if (!ok.length) return res.status(404).json({ error: 'not-found' });

    const [existing] = await getPool().query(
      'SELECT 1 FROM memo_reactions WHERE memo_id = ? AND user_id = ? AND emoji = ? LIMIT 1',
      [id, req.user.id, emoji]
    );
    if (existing.length) {
      await getPool().query(
        'DELETE FROM memo_reactions WHERE memo_id = ? AND user_id = ? AND emoji = ?',
        [id, req.user.id, emoji]
      );
    } else {
      await getPool().query(
        'INSERT INTO memo_reactions (memo_id, user_id, emoji) VALUES (?, ?, ?)',
        [id, req.user.id, emoji]
      );
    }
    const [agg] = await getPool().query(
      `SELECT emoji, COUNT(*) AS c, SUM(user_id = ?) AS mine
         FROM memo_reactions WHERE memo_id = ? GROUP BY emoji`,
      [req.user.id, id]
    );
    res.json({
      ok: true,
      reactions: agg.map((r) => ({ emoji: r.emoji, count: Number(r.c), mine: Number(r.mine) > 0 })),
    });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

// ---------- 답변 즐겨찾기 ⭐ ----------
app.post('/api/answer/:id/favorite', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
    const [ok] = await getPool().query(
      `SELECT 1 FROM daily_answers a
         JOIN daily_questions q ON q.id = a.question_id
        WHERE a.id = ? AND q.family_id = ? LIMIT 1`,
      [id, req.user.family_id]
    );
    if (!ok.length) return res.status(404).json({ error: 'not-found' });

    const [ex] = await getPool().query(
      'SELECT 1 FROM answer_favorites WHERE user_id = ? AND answer_id = ? LIMIT 1',
      [req.user.id, id]
    );
    if (ex.length) {
      await getPool().query(
        'DELETE FROM answer_favorites WHERE user_id = ? AND answer_id = ?',
        [req.user.id, id]
      );
      res.json({ ok: true, favorited: false });
    } else {
      await getPool().query(
        'INSERT INTO answer_favorites (user_id, answer_id) VALUES (?, ?)',
        [req.user.id, id]
      );
      res.json({ ok: true, favorited: true });
    }
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.get('/api/favorites/answers', requireAuth, async (req, res) => {
  try {
    const [rows] = await getPool().query(
      `SELECT a.id AS answer_id, a.answer_text, a.user_id, u.display_name, u.icon,
              q.question_text, q.question_date
         FROM answer_favorites f
         JOIN daily_answers a ON a.id = f.answer_id
         JOIN daily_questions q ON q.id = a.question_id
         JOIN users u ON u.id = a.user_id
        WHERE f.user_id = ? AND q.family_id = ?
        ORDER BY f.created_at DESC LIMIT 50`,
      [req.user.id, req.user.family_id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.post('/api/memos', requireAuth, async (req, res) => {
  const content = (req.body?.content || '').toString().trim();
  if (!content) return res.status(400).json({ error: 'content-required' });
  if (content.length > 500) return res.status(400).json({ error: 'too-long' });
  const dueDate = req.body?.dueDate ? String(req.body.dueDate).slice(0, 10) : null;
  const recurring = ['daily','weekly'].includes(req.body?.recurring) ? req.body.recurring : null;
  const [r] = await getPool().query(
    'INSERT INTO memos (family_id, content, created_by, due_date, recurring) VALUES (?, ?, ?, ?, ?)',
    [req.user.family_id, content, req.user.id, dueDate, recurring]
  );
  res.json({ id: r.insertId, content, done: 0, due_date: dueDate, recurring,
            created_by_name: req.user.display_name, created_by_icon: req.user.icon });
});

app.patch('/api/memos/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
  const updates = [];
  const args = [];

  // 반복 메모: 완료 시 다음 회차 자동 생성
  if (req.body?.done === true) {
    const [cur] = await getPool().query(
      'SELECT id, content, created_by, recurring FROM memos WHERE id = ? AND family_id = ? LIMIT 1',
      [id, req.user.family_id]
    );
    if (cur.length && cur[0].recurring && cur[0].done === 0) {
      // 이미 다음 회차가 만들어져 있는지 확인 (같은 content + recurring + done=0)
      const [existing] = await getPool().query(
        `SELECT id FROM memos WHERE family_id = ? AND content = ? AND recurring = ? AND done = 0 AND id <> ? LIMIT 1`,
        [req.user.family_id, cur[0].content, cur[0].recurring, id]
      );
      if (!existing.length) {
        await getPool().query(
          `INSERT INTO memos (family_id, content, created_by, recurring) VALUES (?, ?, ?, ?)`,
          [req.user.family_id, cur[0].content, cur[0].created_by, cur[0].recurring]
        );
      }
    }
  }

  if (req.body?.done !== undefined)      { updates.push('done = ?');      args.push(req.body.done ? 1 : 0); }
  if (req.body?.important !== undefined) { updates.push('important = ?'); args.push(req.body.important ? 1 : 0); }
  if (req.body?.content !== undefined) {
    const c = String(req.body.content).trim();
    if (!c) return res.status(400).json({ error: 'content-required' });
    if (c.length > 500) return res.status(400).json({ error: 'too-long' });
    updates.push('content = ?'); args.push(c);
  }
  if (req.body?.dueDate !== undefined) {
    const d = req.body.dueDate ? String(req.body.dueDate).slice(0, 10) : null;
    updates.push('due_date = ?'); args.push(d);
  }
  if (req.body?.recurring !== undefined) {
    const r = ['daily','weekly'].includes(req.body.recurring) ? req.body.recurring : null;
    updates.push('recurring = ?'); args.push(r);
  }
  if (!updates.length) return res.json({ ok: true });
  args.push(id, req.user.family_id);
  await getPool().query(
    `UPDATE memos SET ${updates.join(', ')} WHERE id = ? AND family_id = ?`, args
  );
  res.json({ ok: true });
});

app.delete('/api/memos/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
  await getPool().query(
    'DELETE FROM memos WHERE id = ? AND family_id = ?', [id, req.user.family_id]
  );
  res.json({ ok: true });
});

// ---------- 오늘의 가족 질문 ----------
const QUESTIONS = [
  '오늘 가장 기뻤던 일은 무엇인가요?',
  '가장 행복했던 순간은 언제인가요?',
  '가족에게 가장 고마운 점은?',
  '다시 돌아가고 싶은 시기가 있다면?',
  '어릴 적 꿈은 무엇이었나요?',
  '최근에 가장 맛있게 드신 음식은?',
  '가족과 함께 가보고 싶은 여행지는?',
  '오늘 하루를 한 단어로 표현한다면?',
  '내가 가장 존경하는 사람은?',
  '가족 중에 가장 닮고 싶은 모습은?',
  '어릴 적 가장 좋아했던 음식은?',
  '요즘 가장 고마웠던 사람은?',
  '가장 좋아하는 계절과 그 이유는?',
  '어릴 적 가장 좋아했던 놀이는?',
  '가족에게 가장 하고 싶은 말은?',
  '10년 뒤의 내 모습은 어떨까요?',
  '가장 기억에 남는 여행지는?',
  '최근에 가장 감동받았던 일은?',
  '내가 가장 잘하는 것은 무엇인가요?',
  '부모님께서 가장 자주 하셨던 말씀은?',
  '우리 가족만의 추억 하나를 나눠 주세요',
  '가족과 함께 꼭 해보고 싶은 일은?',
  '가장 좋아하는 음식 조합은?',
  '어릴 적 가장 무서웠던 기억은?',
  '가족과 다시 가보고 싶은 장소는?',
  '가장 많이 울었던 날은 언제였나요?',
  '요즘 가장 자주 생각나는 사람은?',
  '인생에서 가장 잘한 선택은?',
  '가장 오래된 좋은 친구는 누구인가요?',
  '가장 고치고 싶은 내 습관은?',
  '어릴 적 가장 예뻤던 동네 풍경은?',
  '가장 좋아하는 명절과 그 이유는?',
  '가장 맛있게 끓인 음식은 무엇인가요?',
  '아침에 눈을 뜨면 가장 먼저 드는 생각은?',
  '가장 소중하게 간직하는 물건은?',
  '요즘 가장 듣고 싶은 말은?',
  '가장 위로가 되는 장소는 어디인가요?',
  '최근에 가장 크게 웃었던 순간은?',
  '20대의 나에게 한마디 한다면?',
  '가족과 함께한 최고의 식사는?',
];

function todayLocal() {
  const tz = process.env.DEFAULT_TZ || 'Asia/Tokyo';
  return new Intl.DateTimeFormat('sv-SE', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function yesterdayLocal() {
  const tz = process.env.DEFAULT_TZ || 'Asia/Tokyo';
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return new Intl.DateTimeFormat('sv-SE', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

async function getOrCreateQuestion(familyId, dateStr) {
  const [rows] = await getPool().query(
    'SELECT * FROM daily_questions WHERE family_id = ? AND question_date = ? LIMIT 1',
    [familyId, dateStr]
  );
  if (rows.length) return rows[0];
  const days = Math.floor(new Date(dateStr).getTime() / 86400000);
  const idx = ((familyId + days) % QUESTIONS.length + QUESTIONS.length) % QUESTIONS.length;
  await getPool().query(
    'INSERT IGNORE INTO daily_questions (family_id, question_date, question_text) VALUES (?, ?, ?)',
    [familyId, dateStr, QUESTIONS[idx]]
  );
  const [rows2] = await getPool().query(
    'SELECT * FROM daily_questions WHERE family_id = ? AND question_date = ? LIMIT 1',
    [familyId, dateStr]
  );
  return rows2[0];
}

app.get('/api/question/today', requireAuth, async (req, res) => {
  try {
    const today = todayLocal();
    const q = await getOrCreateQuestion(req.user.family_id, today);
    const [my] = await getPool().query(
      'SELECT answer_text, is_skip FROM daily_answers WHERE question_id = ? AND user_id = ? LIMIT 1',
      [q.id, req.user.id]
    );
    const [counts] = await getPool().query(
      'SELECT COUNT(*) AS c FROM daily_answers WHERE question_id = ?', [q.id]
    );
    const [members] = await getPool().query(
      "SELECT COUNT(*) AS c FROM users WHERE family_id = ? AND password_hash IS NOT NULL",
      [req.user.family_id]
    );
    const [answerers] = await getPool().query(
      `SELECT a.user_id, u.display_name, u.icon
         FROM daily_answers a JOIN users u ON u.id = a.user_id
        WHERE a.question_id = ?`,
      [q.id]
    );
    res.json({
      date: today,
      question: q.question_text,
      myAnswer: my[0]?.answer_text || null,
      mySkipped: !!my[0]?.is_skip,
      answeredCount: counts[0].c,
      memberCount: members[0].c,
      answerers,
    });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.post('/api/question/today/skip', requireAuth, async (req, res) => {
  try {
    const today = todayLocal();
    const q = await getOrCreateQuestion(req.user.family_id, today);
    await getPool().query(
      `INSERT INTO daily_answers (question_id, user_id, answer_text, is_skip)
         VALUES (?, ?, NULL, 1)
       ON DUPLICATE KEY UPDATE answer_text = NULL, is_skip = 1`,
      [q.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

// ISO 주차 (YYYY-WW) 반환
function weekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-${String(weekNum).padStart(2, '0')}`;
}

// 스트릭 복구 상태
app.get('/api/question/recovery-status', requireAuth, async (req, res) => {
  try {
    const [rows] = await getPool().query(
      `SELECT last_recovery_week FROM users WHERE id = ?`, [req.user.id]
    );
    const current = weekKey();
    const used = rows[0]?.last_recovery_week === current;
    // 최근 7일에 is_skip 또는 미답변이 있는지
    const [gaps] = await getPool().query(
      `SELECT q.id AS question_id, DATE_FORMAT(q.question_date, '%Y-%m-%d') AS date,
              q.question_text,
              (SELECT COUNT(*) FROM daily_answers a
                WHERE a.question_id = q.id AND a.user_id = ? AND a.is_skip = 0 AND a.answer_text IS NOT NULL) AS answered
         FROM daily_questions q
        WHERE q.family_id = ? AND q.question_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
          AND q.question_date < CURDATE()
        ORDER BY q.question_date DESC`,
      [req.user.id, req.user.family_id]
    );
    const recoverable = gaps.filter((g) => !g.answered);
    res.json({ usedThisWeek: !!used, currentWeek: current, recoverable });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

// 스트릭 복구 사용: 지난 7일 중 한 날에 답변 달아 스트릭 이어 붙이기
app.post('/api/question/recover', requireAuth, async (req, res) => {
  try {
    const questionId = Number(req.body?.questionId);
    const answer = (req.body?.answer || '').toString().trim();
    if (!Number.isInteger(questionId)) return res.status(400).json({ error: 'bad-id' });
    if (!answer) return res.status(400).json({ error: 'empty-answer' });

    // 주차 제한
    const current = weekKey();
    const [u] = await getPool().query('SELECT last_recovery_week FROM users WHERE id = ?', [req.user.id]);
    if (u[0]?.last_recovery_week === current) return res.status(429).json({ error: 'already-used-this-week' });

    // 질문이 내 가족의 최근 7일 안인지 검증
    const [q] = await getPool().query(
      `SELECT id FROM daily_questions
        WHERE id = ? AND family_id = ?
          AND question_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
          AND question_date < CURDATE()
        LIMIT 1`,
      [questionId, req.user.family_id]
    );
    if (!q.length) return res.status(404).json({ error: 'not-found-or-out-of-window' });

    await getPool().query(
      `INSERT INTO daily_answers (question_id, user_id, answer_text, is_skip) VALUES (?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE answer_text = VALUES(answer_text), is_skip = 0`,
      [questionId, req.user.id, answer.slice(0, 1000)]
    );
    await getPool().query(
      'UPDATE users SET last_recovery_week = ? WHERE id = ?',
      [current, req.user.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.get('/api/question/streak', requireAuth, async (req, res) => {
  try {
    // 최근 60일 질문 중 내 답변 유무 (스킵 제외)
    const [rows] = await getPool().query(
      `SELECT q.question_date,
              EXISTS (SELECT 1 FROM daily_answers a
                        WHERE a.question_id = q.id AND a.user_id = ? AND a.is_skip = 0 AND a.answer_text IS NOT NULL) AS answered
         FROM daily_questions q
        WHERE q.family_id = ? AND q.question_date <= CURDATE()
        ORDER BY q.question_date DESC LIMIT 60`,
      [req.user.id, req.user.family_id]
    );
    let streak = 0;
    for (const row of rows) {
      if (row.answered) streak++;
      else break;
    }
    // 가족 전체 스트릭
    const [members] = await getPool().query(
      `SELECT id, display_name, icon FROM users
         WHERE family_id = ? AND password_hash IS NOT NULL`,
      [req.user.family_id]
    );
    const familyStreaks = [];
    for (const m of members) {
      const [qs] = await getPool().query(
        `SELECT EXISTS (SELECT 1 FROM daily_answers a
                          WHERE a.question_id = q.id AND a.user_id = ? AND a.is_skip = 0 AND a.answer_text IS NOT NULL) AS answered
           FROM daily_questions q
          WHERE q.family_id = ? AND q.question_date <= CURDATE()
          ORDER BY q.question_date DESC LIMIT 60`,
        [m.id, req.user.family_id]
      );
      let s = 0;
      for (const r of qs) { if (r.answered) s++; else break; }
      familyStreaks.push({ id: m.id, name: m.display_name, icon: m.icon, streak: s });
    }
    familyStreaks.sort((a, b) => b.streak - a.streak);
    res.json({ myStreak: streak, familyStreaks });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.post('/api/question/today/answer', requireAuth, async (req, res) => {
  try {
    const answer = (req.body?.answer || '').toString().trim();
    if (!answer) return res.status(400).json({ error: 'empty' });
    if (answer.length > 1000) return res.status(400).json({ error: 'too-long' });
    const today = todayLocal();
    const q = await getOrCreateQuestion(req.user.family_id, today);
    await getPool().query(
      `INSERT INTO daily_answers (question_id, user_id, answer_text, is_skip) VALUES (?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE answer_text = VALUES(answer_text), is_skip = 0`,
      [q.id, req.user.id, answer]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

// ---------- 주간 가족 활동 요약 ----------
app.get('/api/activity/week', requireAuth, async (req, res) => {
  try {
    const fid = req.user.family_id;

    // 답변 수 (가족 전체, 본인 포함, skip 제외) 최근 7일
    const [ansByUser] = await getPool().query(
      `SELECT a.user_id, u.display_name, u.icon, COUNT(*) AS cnt
         FROM daily_answers a
         JOIN daily_questions q ON q.id = a.question_id
         JOIN users u ON u.id = a.user_id
        WHERE q.family_id = ? AND q.question_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
          AND a.answer_text IS NOT NULL AND a.is_skip = 0
        GROUP BY a.user_id ORDER BY cnt DESC`,
      [fid]
    );
    const totalAnswers = ansByUser.reduce((s, r) => s + Number(r.cnt), 0);

    // 메모 수
    const [memoCnt] = await getPool().query(
      `SELECT COUNT(*) AS cnt FROM memos
        WHERE family_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
      [fid]
    );

    // 스티커 (보낸/받은 Top 1)
    const [stkTotal] = await getPool().query(
      `SELECT COUNT(*) AS cnt FROM family_stickers
        WHERE family_id = ? AND sticker_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)`,
      [fid]
    );
    const [topSender] = await getPool().query(
      `SELECT u.display_name, u.icon, COUNT(*) AS cnt
         FROM family_stickers s JOIN users u ON u.id = s.sender_id
        WHERE s.family_id = ? AND s.sticker_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        GROUP BY s.sender_id ORDER BY cnt DESC LIMIT 1`,
      [fid]
    );
    const [topReceiver] = await getPool().query(
      `SELECT u.display_name, u.icon, COUNT(*) AS cnt
         FROM family_stickers s JOIN users u ON u.id = s.receiver_id
        WHERE s.family_id = ? AND s.sticker_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        GROUP BY s.receiver_id ORDER BY cnt DESC LIMIT 1`,
      [fid]
    );

    // 기분 체크인
    const [moodCnt] = await getPool().query(
      `SELECT COUNT(*) AS cnt FROM mood_history mh
         JOIN users u ON u.id = mh.user_id
        WHERE u.family_id = ? AND mh.mood_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)`,
      [fid]
    );

    res.json({
      answers: {
        total: totalAnswers,
        byUser: ansByUser.map((r) => ({ userId: r.user_id, name: r.display_name, icon: r.icon, count: Number(r.cnt) })),
      },
      memos: { total: Number(memoCnt[0].cnt) },
      stickers: {
        total: Number(stkTotal[0].cnt),
        topSender: topSender[0] ? { name: topSender[0].display_name, icon: topSender[0].icon, count: Number(topSender[0].cnt) } : null,
        topReceiver: topReceiver[0] ? { name: topReceiver[0].display_name, icon: topReceiver[0].icon, count: Number(topReceiver[0].cnt) } : null,
      },
      moodCheckins: Number(moodCnt[0].cnt),
    });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.get('/api/question/yesterday', requireAuth, async (req, res) => {
  try {
    const y = yesterdayLocal();
    const [qrows] = await getPool().query(
      'SELECT * FROM daily_questions WHERE family_id = ? AND question_date = ? LIMIT 1',
      [req.user.family_id, y]
    );
    if (!qrows.length) return res.json({ date: y, question: null, answers: [] });
    const q = qrows[0];
    const [ans] = await getPool().query(
      `SELECT a.id AS answer_id, a.answer_text, a.is_skip, a.user_id,
              a.created_at, a.updated_at,
              u.display_name, u.icon,
              EXISTS (SELECT 1 FROM answer_favorites f WHERE f.user_id = ? AND f.answer_id = a.id) AS my_favorite
         FROM daily_answers a JOIN users u ON u.id = a.user_id
        WHERE a.question_id = ? AND (a.answer_text IS NOT NULL OR a.is_skip = 1)
        ORDER BY a.created_at ASC`,
      [req.user.id, q.id]
    );
    const ids = ans.map((a) => a.answer_id);
    let reactions = [];
    if (ids.length) {
      const [rx] = await getPool().query(
        `SELECT answer_id, emoji, user_id FROM answer_reactions WHERE answer_id IN (?)`,
        [ids]
      );
      reactions = rx;
    }
    // Group per answer
    for (const a of ans) {
      const list = reactions.filter((r) => r.answer_id === a.answer_id);
      const byEmoji = new Map();
      for (const r of list) {
        const e = byEmoji.get(r.emoji) || { emoji: r.emoji, count: 0, mine: false };
        e.count += 1;
        if (r.user_id === req.user.id) e.mine = true;
        byEmoji.set(r.emoji, e);
      }
      a.reactions = [...byEmoji.values()];
    }
    res.json({ date: y, question: q.question_text, answers: ans });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.get('/api/answer/:id/comments', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
    // 같은 가족 확인
    const [ok] = await getPool().query(
      `SELECT 1 FROM daily_answers a
         JOIN daily_questions q ON q.id = a.question_id
        WHERE a.id = ? AND q.family_id = ? LIMIT 1`,
      [id, req.user.family_id]
    );
    if (!ok.length) return res.status(404).json({ error: 'not-found' });
    const [rows] = await getPool().query(
      `SELECT c.id, c.text, c.author_id, c.created_at,
              u.display_name AS author_name, u.icon AS author_icon
         FROM answer_comments c JOIN users u ON u.id = c.author_id
        WHERE c.answer_id = ? ORDER BY c.created_at ASC`, [id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.post('/api/answer/:id/comments', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
    const text = (req.body?.text || '').toString().trim().slice(0, 300);
    if (!text) return res.status(400).json({ error: 'empty' });
    const [ok] = await getPool().query(
      `SELECT 1 FROM daily_answers a
         JOIN daily_questions q ON q.id = a.question_id
        WHERE a.id = ? AND q.family_id = ? LIMIT 1`,
      [id, req.user.family_id]
    );
    if (!ok.length) return res.status(404).json({ error: 'not-found' });
    const [r] = await getPool().query(
      'INSERT INTO answer_comments (answer_id, author_id, text) VALUES (?, ?, ?)',
      [id, req.user.id, text]
    );
    res.json({ ok: true, id: r.insertId });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.delete('/api/answer/:id/comments/:cid', requireAuth, async (req, res) => {
  try {
    const cid = Number(req.params.cid);
    if (!Number.isInteger(cid)) return res.status(400).json({ error: 'bad-id' });
    await getPool().query(
      'DELETE FROM answer_comments WHERE id = ? AND author_id = ?',
      [cid, req.user.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.post('/api/answer/:id/react', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
    const emoji = (req.body?.emoji || '❤️').toString().slice(0, 10);
    // 같은 가족의 답변만 반응 가능
    const [check] = await getPool().query(
      `SELECT a.id FROM daily_answers a
         JOIN daily_questions q ON q.id = a.question_id
        WHERE a.id = ? AND q.family_id = ? LIMIT 1`,
      [id, req.user.family_id]
    );
    if (!check.length) return res.status(404).json({ error: 'not-found' });

    const [existing] = await getPool().query(
      'SELECT id FROM answer_reactions WHERE answer_id = ? AND user_id = ? AND emoji = ? LIMIT 1',
      [id, req.user.id, emoji]
    );
    if (existing.length) {
      await getPool().query('DELETE FROM answer_reactions WHERE id = ?', [existing[0].id]);
    } else {
      await getPool().query(
        'INSERT INTO answer_reactions (answer_id, user_id, emoji) VALUES (?, ?, ?)',
        [id, req.user.id, emoji]
      );
    }
    // 집계
    const [agg] = await getPool().query(
      'SELECT emoji, COUNT(*) AS c, SUM(user_id = ?) AS mine FROM answer_reactions WHERE answer_id = ? GROUP BY emoji',
      [req.user.id, id]
    );
    res.json({
      ok: true,
      reactions: agg.map((r) => ({ emoji: r.emoji, count: Number(r.c), mine: Number(r.mine) > 0 })),
    });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.get('/api/question/history', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(60, Number(req.query.limit) || 30);
    const today = todayLocal();
    const [qrows] = await getPool().query(
      `SELECT * FROM daily_questions WHERE family_id = ? AND question_date < ?
         ORDER BY question_date DESC LIMIT ?`,
      [req.user.family_id, today, limit]
    );
    const results = [];
    for (const q of qrows) {
      const [ans] = await getPool().query(
        `SELECT a.answer_text, u.display_name, u.icon
           FROM daily_answers a JOIN users u ON u.id = a.user_id
          WHERE a.question_id = ? ORDER BY a.created_at ASC`,
        [q.id]
      );
      results.push({ date: q.question_date, question: q.question_text, answers: ans });
    }
    res.json(results);
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

// ---------- 띠별운세 ----------
const ZODIAC = ['원숭이','닭','개','돼지','쥐','소','호랑이','토끼','용','뱀','말','양'];
function zodiacOf(year) {
  if (!year) return null;
  return ZODIAC[((year % 12) + 12) % 12];
}
const FORTUNE = {
  '쥐':  ['꼼꼼함이 빛을 발하는 하루','작은 정보 하나가 큰 도움이 돼요','돈 관리에 좋은 흐름','가족과의 대화가 기분을 올려줘요','서두르지 않으면 좋은 결과가 있어요','새로운 시도가 재미있을 거예요','조용한 휴식이 필요한 날'],
  '소':  ['한 걸음씩 나아가는 힘이 있어요','꾸준함이 복을 불러와요','무리하지 말고 쉬어 가세요','든든한 한 끼가 마음을 채워줘요','오랜 친구에게 연락해 보세요','작은 성취에 기뻐하는 하루','마음을 비우면 편해져요'],
  '호랑이':['당당한 기운이 주변에 전해져요','도전해 보는 마음이 좋아요','말보다 행동이 통하는 날','자신감이 복을 부르는 흐름','산책이 컨디션을 살려줘요','가족의 응원이 힘이 돼요','오늘은 욕심을 조금 줄이세요'],
  '토끼':['부드러움이 큰 힘이 돼요','주변을 보살피면 복이 돌아와요','가벼운 운동이 기분을 좋게 해요','따뜻한 차 한 잔이 좋아요','작은 행운이 찾아와요','기분 좋은 소식을 듣는 날','쉼표가 필요한 하루'],
  '용':  ['좋은 흐름을 타는 하루','하고자 하는 일에 힘이 실려요','사람들이 도움을 줘요','작은 꿈이 또렷해져요','건강을 살피면 더 좋아요','기분 전환이 필요한 날','마음이 넉넉해지는 하루'],
  '뱀':  ['예민한 감각이 잘 맞아요','생각을 정리하기 좋은 날','지혜로운 판단이 빛나요','서두를 일이 없어요','가까운 사람과 따뜻한 시간','작은 소식 하나가 반가워요','편안한 휴식이 약이 돼요'],
  '말':  ['활력이 넘치는 하루','움직일수록 좋은 에너지','새 소식이 찾아와요','친구와의 만남이 즐거워요','무리하지 않으면 더 좋아요','기분 좋은 산책을 추천해요','가볍게 비우는 하루'],
  '양':  ['따뜻한 마음이 전해져요','가족에게 좋은 일이 있어요','조용한 즐거움이 있는 날','작은 배려가 큰 기쁨이 돼요','맛있는 음식이 생각나는 날','기분이 편안해지는 흐름','몸을 아끼는 하루'],
  '원숭이':['재치 있는 판단이 통하는 날','새 아이디어가 떠올라요','주변을 즐겁게 만드는 힘','작은 변화가 기분을 새롭게 해요','가벼운 대화가 재미있어요','욕심보다는 여유','마음에 꽃이 피는 하루'],
  '닭':  ['부지런함이 복을 불러요','꼼꼼한 일처리가 빛나요','아침 일찍의 기분이 좋아요','사람들의 칭찬을 듣는 날','가족과의 식사가 행복해요','마음을 크게 가지면 좋아요','편히 쉬는 시간이 필요해요'],
  '개':  ['신의 있는 모습이 인정받아요','든든한 하루','가족이 큰 힘이 돼요','작은 여행이 떠오르는 날','몸 상태를 살피면 좋아요','따뜻한 한마디가 힘이 돼요','조용히 보내는 저녁'],
  '돼지':['여유 속에 행복이 있어요','좋은 인연이 가까이 있어요','맛있는 것이 위안이 돼요','기분 좋은 소식을 듣는 날','소소한 복이 많은 하루','무리하지 않아도 괜찮아요','따뜻한 휴식이 필요해요'],
};
function dayOfYear(d = new Date()) {
  return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
}

app.get('/api/zodiac', requireAuth, async (req, res) => {
  const [rows] = await getPool().query(
    `SELECT id, display_name, icon, birth_year FROM users
      WHERE family_id = ? AND birth_year IS NOT NULL
      ORDER BY role DESC, id ASC`,
    [req.user.family_id]
  );
  const doy = dayOfYear();
  res.json(rows.map((u) => {
    const z = zodiacOf(u.birth_year);
    const pool = FORTUNE[z] || [];
    const fortune = pool.length ? pool[(doy + u.id) % pool.length] : '좋은 하루 되세요';
    return { name: u.display_name, icon: u.icon, year: u.birth_year, zodiac: z, fortune };
  }));
});

// ---------- 생일 축하 메시지 ----------
app.get('/api/birthday/:userId/messages', requireAuth, async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId)) return res.status(400).json({ error: 'bad-id' });
    const year = Number(req.query.year) || new Date().getFullYear();
    // 같은 가족 확인
    const [check] = await getPool().query(
      'SELECT id, display_name, icon FROM users WHERE id = ? AND family_id = ? LIMIT 1',
      [userId, req.user.family_id]
    );
    if (!check.length) return res.status(404).json({ error: 'not-found' });
    const [rows] = await getPool().query(
      `SELECT m.id, m.message, m.year, m.created_at, m.author_user_id,
              u.display_name AS author_name, u.icon AS author_icon
         FROM birthday_messages m
         JOIN users u ON u.id = m.author_user_id
        WHERE m.target_user_id = ? AND m.year = ? AND m.family_id = ?
        ORDER BY m.created_at ASC`,
      [userId, year, req.user.family_id]
    );
    res.json({ target: check[0], year, messages: rows });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.post('/api/birthday/:userId/message', requireAuth, async (req, res) => {
  try {
    const targetId = Number(req.params.userId);
    if (!Number.isInteger(targetId)) return res.status(400).json({ error: 'bad-id' });
    if (targetId === req.user.id) return res.status(400).json({ error: 'self-not-allowed' });
    const text = (req.body?.text || '').toString().trim();
    if (!text) return res.status(400).json({ error: 'empty' });
    if (text.length > 500) return res.status(400).json({ error: 'too-long' });
    const year = Number(req.body?.year) || new Date().getFullYear();

    const [check] = await getPool().query(
      'SELECT id FROM users WHERE id = ? AND family_id = ? LIMIT 1',
      [targetId, req.user.family_id]
    );
    if (!check.length) return res.status(404).json({ error: 'not-found' });

    await getPool().query(
      `INSERT INTO birthday_messages (family_id, target_user_id, author_user_id, message, year)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE message = VALUES(message)`,
      [req.user.family_id, targetId, req.user.id, text, year]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.delete('/api/birthday/:userId/message', requireAuth, async (req, res) => {
  const targetId = Number(req.params.userId);
  if (!Number.isInteger(targetId)) return res.status(400).json({ error: 'bad-id' });
  const year = Number(req.query.year) || new Date().getFullYear();
  await getPool().query(
    `DELETE FROM birthday_messages
      WHERE target_user_id = ? AND author_user_id = ? AND year = ? AND family_id = ?`,
    [targetId, req.user.id, year, req.user.family_id]
  );
  res.json({ ok: true });
});

// ---------- 커스텀 기념일 ----------
app.get('/api/anniversaries', requireAuth, async (req, res) => {
  try {
    const [rows] = await getPool().query(
      `SELECT id, title, emoji, month, day, year, is_lunar
         FROM anniversaries WHERE family_id = ?
         ORDER BY month, day`,
      [req.user.family_id]
    );
    const now = new Date();
    const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const list = rows.map((r) => {
      let target = new Date(now.getFullYear(), r.month - 1, r.day);
      if (target < todayMid) target = new Date(now.getFullYear() + 1, r.month - 1, r.day);
      const daysLeft = Math.round((target - todayMid) / 86400000);
      const years = r.year ? (now.getFullYear() - r.year + (target.getFullYear() > now.getFullYear() ? 0 : 0)) : null;
      return { ...r, daysLeft, years };
    });
    res.json(list);
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.post('/api/anniversaries', requireAuth, async (req, res) => {
  try {
    const { title, emoji, month, day, year, isLunar } = req.body || {};
    const t = (title || '').toString().trim().slice(0, 100);
    const m = Number(month);
    const d = Number(day);
    if (!t) return res.status(400).json({ error: 'title-required' });
    if (!(m >= 1 && m <= 12)) return res.status(400).json({ error: 'bad-month' });
    if (!(d >= 1 && d <= 31)) return res.status(400).json({ error: 'bad-day' });
    const [r] = await getPool().query(
      `INSERT INTO anniversaries (family_id, title, emoji, month, day, year, is_lunar, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.family_id, t, (emoji || '🎈').toString().slice(0, 10), m, d,
       year ? Number(year) : null, isLunar ? 1 : 0, req.user.id]
    );
    res.json({ ok: true, id: r.insertId });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.delete('/api/anniversaries/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
  await getPool().query(
    'DELETE FROM anniversaries WHERE id = ? AND family_id = ?',
    [id, req.user.family_id]
  );
  res.json({ ok: true });
});

// ---------- 곧 다가오는 생일 ----------
app.get('/api/birthdays/soon', requireAuth, async (req, res) => {
  const [rows] = await getPool().query(
    `SELECT id, display_name, icon, birth_month, birth_day, is_lunar
       FROM users WHERE family_id = ?
         AND birth_month IS NOT NULL AND birth_day IS NOT NULL`,
    [req.user.family_id]
  );
  const today = new Date();
  const todayKey = `${today.getMonth() + 1}-${today.getDate()}`;
  let todayMatch = null;
  const within7 = [];
  for (const r of rows) {
    const k = `${r.birth_month}-${r.birth_day}`;
    if (k === todayKey) todayMatch = r;
    const daysLeft = daysUntil(r.birth_month, r.birth_day);
    if (daysLeft > 0 && daysLeft <= 7) within7.push({ ...r, daysLeft });
  }
  within7.sort((a, b) => a.daysLeft - b.daysLeft);
  res.json({ today: todayMatch, upcoming: within7 });
});
function daysUntil(m, d) {
  const now = new Date();
  const y = now.getFullYear();
  const todayMid = new Date(y, now.getMonth(), now.getDate());
  let target = new Date(y, m - 1, d);
  if (target < todayMid) target = new Date(y + 1, m - 1, d);
  return Math.round((target - todayMid) / 86400000);
}

// ---------- 정적 서빙 ----------
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  maxAge: '1h',
  setHeaders: (res, p) => {
    if (p.endsWith('service-worker.js') || p.endsWith('index.html') || p.endsWith('app.js')) {
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  },
}));

// 초대 페이지도 index.html 로 떨어뜨려 SPA 처리
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error('[api error]', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'internal', message: err.message });
});

// ---------- 부팅 ----------
const PORT = Number(process.env.PORT || 3003);
(async () => {
  try {
    await ensureSchema();
    console.log('[db] schema ready');
    await bootstrapAdmin();
  } catch (e) { console.warn('[db] init failed (continuing):', e.message); }
  app.listen(PORT, () => console.log(`familyboard listening on :${PORT}`));
})();
