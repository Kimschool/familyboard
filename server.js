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
      `SELECT id, display_name, icon, role, birth_year,
              (password_hash IS NOT NULL) AS activated
         FROM users WHERE family_id = ?
         ORDER BY role DESC, id ASC`,
      [f[0].id]
    );
    res.json({
      family: { alias: f[0].alias, displayName: f[0].display_name },
      members: users.map((u) => ({
        id: u.id,
        displayName: u.display_name,
        icon: u.icon,
        role: u.role,
        birthYear: u.birth_year,
        activated: !!u.activated,
      })),
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
  const { displayName, role, icon, birthYear, birthMonth, birthDay, isLunar, password } = req.body || {};
  if (displayName !== undefined) { updates.push('display_name = ?'); args.push(String(displayName).trim()); }
  if (role !== undefined && (role === 'admin' || role === 'member')) { updates.push('role = ?'); args.push(role); }
  if (icon !== undefined) { updates.push('icon = ?'); args.push(String(icon).trim() || 'star'); }
  if (birthYear !== undefined)  { updates.push('birth_year = ?');  args.push(Number(birthYear)  || null); }
  if (birthMonth !== undefined) { updates.push('birth_month = ?'); args.push(Number(birthMonth) || null); }
  if (birthDay !== undefined)   { updates.push('birth_day = ?');   args.push(Number(birthDay)   || null); }
  if (isLunar !== undefined)    { updates.push('is_lunar = ?');    args.push(isLunar ? 1 : 0); }
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

// ---------- 가족 정보 (관리자: 별칭 수정) ----------
app.get('/api/family', requireAuth, async (req, res) => {
  const [rows] = await getPool().query(
    'SELECT alias, display_name FROM families WHERE id = ? LIMIT 1', [req.user.family_id]
  );
  res.json(rows[0] ? { alias: rows[0].alias, displayName: rows[0].display_name } : {});
});

app.patch('/api/family', requireAdmin, async (req, res) => {
  try {
    const { alias, displayName } = req.body || {};
    const upd = [], args = [];
    if (alias !== undefined) { upd.push('alias = ?'); args.push(String(alias).trim()); }
    if (displayName !== undefined) { upd.push('display_name = ?'); args.push(String(displayName).trim()); }
    if (!upd.length) return res.json({ ok: true });
    args.push(req.user.family_id);
    await getPool().query(`UPDATE families SET ${upd.join(', ')} WHERE id = ?`, args);
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'alias-exists' });
    res.status(500).json({ error: 'internal', message: e.message });
  }
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
      `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max` +
      `&timezone=${TZ_ENC}&forecast_days=1`;
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
    };
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
    `SELECT m.id, m.content, m.done, m.created_at,
            COALESCE(u.display_name, '') AS created_by_name, u.icon AS created_by_icon
       FROM memos m LEFT JOIN users u ON u.id = m.created_by
      WHERE m.family_id = ?
      ORDER BY m.done ASC, m.id DESC LIMIT 100`,
    [req.user.family_id]
  );
  res.json(rows);
});

app.post('/api/memos', requireAuth, async (req, res) => {
  const content = (req.body?.content || '').toString().trim();
  if (!content) return res.status(400).json({ error: 'content-required' });
  if (content.length > 500) return res.status(400).json({ error: 'too-long' });
  const [r] = await getPool().query(
    'INSERT INTO memos (family_id, content, created_by) VALUES (?, ?, ?)',
    [req.user.family_id, content, req.user.id]
  );
  res.json({ id: r.insertId, content, done: 0,
            created_by_name: req.user.display_name, created_by_icon: req.user.icon });
});

app.patch('/api/memos/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
  const done = req.body?.done ? 1 : 0;
  await getPool().query(
    'UPDATE memos SET done = ? WHERE id = ? AND family_id = ?',
    [done, id, req.user.family_id]
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
