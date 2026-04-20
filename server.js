require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { ensureSchema, getPool } = require('./db');
const {
  bootstrapAdmin, login, logout, verify, issueToken,
  requireAuth, requireAdmin, publicUser,
  newInviteToken, INVITE_TTL_DAYS,
} = require('./auth');

const app = express();

/** 컨테이너 내부 경로만 허용. NAS의 /volume2/... 는 호스트 경로라 컨테이너에 없음 → 파일이 NAS에 안 보이고 레이어에만 쌓임 */
function resolveProfilePhotosDir() {
  const fallback = path.join(__dirname, 'data', 'profile-photos');
  let raw = (process.env.PROFILE_PHOTOS_DIR || '').trim();
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.slice(1, -1).trim();
  }
  if (!raw) return fallback;
  const norm = raw.replace(/\\/g, '/');
  if (/^\/volume\d+\//i.test(norm)) {
    console.warn(
      '[profile-photos] PROFILE_PHOTOS_DIR에 NAS 호스트 경로(/volume2/...)가 들어가 있으면 안 됩니다.',
      'docker-compose에서 /app/data 만 NAS에 마운트하고, 여기서는 컨테이너 경로를 쓰세요. 예: /app/data/profile-photos',
      '→ 잘못된 값 무시:', raw
    );
    return fallback;
  }
  return path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
}
const PROFILE_PHOTOS_DIR = resolveProfilePhotosDir();
try {
  fs.mkdirSync(PROFILE_PHOTOS_DIR, { recursive: true });
} catch (e) {
  console.warn('[profile-photos] mkdir:', e.message);
}
console.log('[profile-photos] 저장 경로:', PROFILE_PHOTOS_DIR);
try {
  const probe = path.join(PROFILE_PHOTOS_DIR, '.write-test');
  fs.writeFileSync(probe, 'ok');
  fs.unlinkSync(probe);
  console.log('[profile-photos] 쓰기 테스트: OK');
} catch (e) {
  console.error('[profile-photos] 쓰기 테스트 실패 — 권한 또는 볼륨 마운트 확인:', e.message);
}

// 가족 갤러리: PROFILE_PHOTOS_DIR 의 부모(= /app/data) 밑에 gallery/ 로 분리 저장
const DATA_DIR = path.dirname(PROFILE_PHOTOS_DIR);
const GALLERY_DIR = path.join(DATA_DIR, 'gallery');
try { fs.mkdirSync(GALLERY_DIR, { recursive: true }); } catch (e) { console.warn('[gallery] mkdir:', e.message); }
console.log('[gallery] 저장 경로:', GALLERY_DIR);

/** 빈 값·문자열 "null" 을 DB NULL / JSON null 로 통일 */
function normalizePhoneOut(val) {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s || s.toLowerCase() === 'null' || s === 'undefined') return null;
  return s;
}
function normalizePhoneIn(input) {
  if (input === undefined) return undefined;
  return normalizePhoneOut(input);
}

/** 가족별 하위 폴더명. URL 안전하게 항상 ASCII만 사용.
 *  alias 가 영문/숫자/-/_ 만이면 그대로, 아니면 family-{id} 로 폴백.
 *  → Cloudflare·NAS 리버스프록시에서 한글 경로 인코딩 문제 회피 */
function familySubDir(req) {
  const id = req.user?.family_id;
  const rawAlias = String(req.user?.family_alias || '').trim();
  if (/^[A-Za-z0-9_-]{1,60}$/.test(rawAlias)) return rawAlias;
  return id != null ? `family-${id}` : 'family-x';
}

/** photoUrl 내 경로가 PROFILE_PHOTOS_DIR 밖으로 나가지 않는지 확인 후 삭제. */
function resolveSafeUploadPath(photoUrl) {
  if (!photoUrl || typeof photoUrl !== 'string') return null;
  if (!photoUrl.startsWith('/uploads/profiles/')) return null;
  const rel = photoUrl.slice('/uploads/profiles/'.length);
  if (!rel || rel.includes('..')) return null;
  const parts = rel.split('/').filter(Boolean);
  if (!parts.length) return null;
  const baseDir = path.resolve(PROFILE_PHOTOS_DIR);
  const fp = path.resolve(baseDir, ...parts);
  if (fp !== baseDir && !fp.startsWith(baseDir + path.sep)) return null;
  return { fullPath: fp, basename: parts[parts.length - 1] };
}

function safeUnlinkProfileFile(photoUrl, userId) {
  const r = resolveSafeUploadPath(photoUrl);
  if (!r) return;
  const m = r.basename.match(/^u(\d+)-.+\.jpg$/i);
  if (!m || Number(m[1]) !== Number(userId)) return;
  fs.unlink(r.fullPath, () => {});
}

function safeUnlinkFamilyFile(photoUrl) {
  const r = resolveSafeUploadPath(photoUrl);
  if (!r) return;
  if (!/^family-\d+-[a-z0-9]+\.jpg$/i.test(r.basename)) return;
  fs.unlink(r.fullPath, () => {});
}

function makeUploadDestination(req, _file, cb) {
  try {
    const dir = path.join(PROFILE_PHOTOS_DIR, familySubDir(req));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  } catch (e) {
    cb(e);
  }
}

const profileUpload = multer({
  storage: multer.diskStorage({
    destination: makeUploadDestination,
    filename: (req, _file, cb) => {
      cb(null, `u${req.user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}.jpg`);
    },
  }),
  limits: { fileSize: Math.ceil(1.05 * 1024 * 1024) },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.mimetype);
    cb(ok ? null : new Error('invalid-image-type'), ok);
  },
});

const familyPhotoUpload = multer({
  storage: multer.diskStorage({
    destination: makeUploadDestination,
    filename: (_req, _file, cb) => {
      cb(null, `family-${Date.now()}-${Math.random().toString(36).slice(2, 11)}.jpg`);
    },
  }),
  limits: { fileSize: Math.ceil(2.05 * 1024 * 1024) },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.mimetype);
    cb(ok ? null : new Error('invalid-image-type'), ok);
  },
});

// ---------- 갤러리 업로드 ----------
function makeGalleryDestination(req, _file, cb) {
  try {
    const dir = path.join(GALLERY_DIR, familySubDir(req));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  } catch (e) { cb(e); }
}
const galleryUpload = multer({
  storage: multer.diskStorage({
    destination: makeGalleryDestination,
    filename: (_req, _file, cb) => {
      cb(null, `g-${Date.now()}-${Math.random().toString(36).slice(2, 11)}.jpg`);
    },
  }),
  limits: { fileSize: Math.ceil(3.1 * 1024 * 1024) },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.mimetype);
    cb(ok ? null : new Error('invalid-image-type'), ok);
  },
});
function resolveSafeGalleryPath(url) {
  if (!url || typeof url !== 'string' || !url.startsWith('/uploads/gallery/')) return null;
  const rel = url.slice('/uploads/gallery/'.length);
  if (!rel || rel.includes('..')) return null;
  const parts = rel.split('/').filter(Boolean);
  if (!parts.length) return null;
  const baseDir = path.resolve(GALLERY_DIR);
  const fp = path.resolve(baseDir, ...parts);
  if (fp !== baseDir && !fp.startsWith(baseDir + path.sep)) return null;
  return { fullPath: fp, basename: parts[parts.length - 1] };
}
function safeUnlinkGalleryFile(url) {
  const r = resolveSafeGalleryPath(url);
  if (!r) return;
  if (!/^g-\d+-[a-z0-9]+\.jpg$/i.test(r.basename)) return;
  fs.unlink(r.fullPath, () => {});
}

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
              phone, photo_url, mood, mood_date,
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
          phone: normalizePhoneOut(u.phone),
          photoUrl: u.photo_url || null,
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

// ---------- 내 프로필 편집 (본인 전용) ----------
app.patch('/api/me', requireAuth, async (req, res) => {
  try {
    const updates = [];
    const args = [];
    const { displayName, icon, birthYear, birthMonth, birthDay, isLunar, phone, password, currentPassword } = req.body || {};

    if (displayName !== undefined) {
      const d = String(displayName).trim().slice(0, 50);
      if (!d) return res.status(400).json({ error: 'name-required' });
      updates.push('display_name = ?'); args.push(d);
    }
    if (icon !== undefined) { updates.push('icon = ?'); args.push(String(icon).trim().slice(0, 30) || 'star'); }
    if (birthYear !== undefined)  { updates.push('birth_year = ?');  args.push(Number(birthYear)  || null); }
    if (birthMonth !== undefined) { updates.push('birth_month = ?'); args.push(Number(birthMonth) || null); }
    if (birthDay !== undefined)   { updates.push('birth_day = ?');   args.push(Number(birthDay)   || null); }
    if (isLunar !== undefined)    { updates.push('is_lunar = ?');    args.push(isLunar ? 1 : 0); }
    if (phone !== undefined)      { updates.push('phone = ?');       args.push(normalizePhoneIn(phone)); }
    let prevPhotoUrl = null;
    if (req.body?.photoUrl !== undefined) {
      const [curPh] = await getPool().query('SELECT photo_url FROM users WHERE id = ? LIMIT 1', [req.user.id]);
      prevPhotoUrl = curPh[0]?.photo_url || null;
      const rawPh = req.body.photoUrl;
      const p = rawPh === null || rawPh === '' ? '' : String(rawPh).trim().slice(0, 500);
      updates.push('photo_url = ?'); args.push(p || null);
    }

    if (password) {
      if (String(password).length < 4) return res.status(400).json({ error: 'password-too-short' });
      if (!currentPassword) return res.status(400).json({ error: 'current-password-required' });
      const [cur] = await getPool().query('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [req.user.id]);
      if (!cur.length || !bcrypt.compareSync(currentPassword, cur[0].password_hash)) {
        return res.status(401).json({ error: 'current-password-wrong' });
      }
      updates.push('password_hash = ?'); args.push(bcrypt.hashSync(password, 10));
    }

    if (!updates.length) return res.json({ ok: true });
    args.push(req.user.id);
    await getPool().query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, args);
    if (prevPhotoUrl != null && req.body?.photoUrl !== undefined) {
      const rawPh = req.body.photoUrl;
      const next = rawPh === null || rawPh === '' ? null : String(rawPh).trim().slice(0, 500) || null;
      if (prevPhotoUrl !== next) safeUnlinkProfileFile(prevPhotoUrl, req.user.id);
    }
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'display-exists' });
    res.status(500).json({ error: 'internal', message: e.message });
  }
});

// ---------- 프로필 사진 업로드 (본인) ----------
app.post(
  '/api/me/photo',
  requireAuth,
  (req, res, next) => {
    profileUpload.single('photo')(req, res, (err) => {
      if (err) {
        const msg = err.message === 'invalid-image-type' ? '이미지 파일만 올릴 수 있어요' : (err.message || '업로드 실패');
        return res.status(400).json({ error: 'upload-failed', message: msg });
      }
      if (!req.file) return res.status(400).json({ error: 'no-file', message: '파일이 없어요' });
      next();
    });
  },
  async (req, res) => {
    try {
      const [rows] = await getPool().query('SELECT photo_url FROM users WHERE id = ? LIMIT 1', [req.user.id]);
      const prev = rows[0]?.photo_url || null;
      const publicPath = `/uploads/profiles/${familySubDir(req)}/${req.file.filename}`;
      await getPool().query('UPDATE users SET photo_url = ? WHERE id = ?', [publicPath, req.user.id]);
      safeUnlinkProfileFile(prev, req.user.id);
      res.json({ ok: true, photoUrl: publicPath });
    } catch (e) {
      fs.unlink(req.file.path, () => {});
      res.status(500).json({ error: 'internal', message: e.message });
    }
  }
);

// ---------- 주간 미션 ----------
app.get('/api/missions/week', requireAuth, async (req, res) => {
  try {
    const [ans] = await getPool().query(
      `SELECT COUNT(*) AS c FROM daily_answers a
         JOIN daily_questions q ON q.id = a.question_id
        WHERE a.user_id = ? AND q.family_id = ?
          AND a.answer_text IS NOT NULL AND a.is_skip = 0
          AND q.question_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)`,
      [req.user.id, req.user.family_id]
    );
    const [memos] = await getPool().query(
      `SELECT COUNT(*) AS c FROM memos
        WHERE family_id = ? AND created_by = ?
          AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
      [req.user.family_id, req.user.id]
    );
    const [stkSent] = await getPool().query(
      `SELECT COUNT(*) AS c FROM family_stickers
        WHERE family_id = ? AND sender_id = ?
          AND sticker_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)`,
      [req.user.family_id, req.user.id]
    );
    const [moodCnt] = await getPool().query(
      `SELECT COUNT(*) AS c FROM mood_history
        WHERE user_id = ? AND mood_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)`,
      [req.user.id]
    );
    const missions = [
      { key: 'answer3', emoji: '💬', title: '가족 질문에 3번 답하기', target: 3, progress: Math.min(3, Number(ans[0].c)) },
      { key: 'sticker5', emoji: '💖', title: '응원 스티커 5개 보내기', target: 5, progress: Math.min(5, Number(stkSent[0].c)) },
      { key: 'memo3', emoji: '📝', title: '메모 3개 작성하기', target: 3, progress: Math.min(3, Number(memos[0].c)) },
      { key: 'mood5', emoji: '😊', title: '기분 체크인 5일', target: 5, progress: Math.min(5, Number(moodCnt[0].c)) },
    ];
    res.json(missions);
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
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
    `SELECT id, username, display_name, role, icon, birth_year, birth_month, birth_day, is_lunar, phone, photo_url,
            (password_hash IS NOT NULL) AS activated,
            invite_token, invite_expires_at
       FROM users WHERE family_id = ? ORDER BY role DESC, id ASC`,
    [req.user.family_id]
  );
  res.json(rows.map((r) => ({
    ...publicUser(r),
    phone: normalizePhoneOut(r.phone),
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
  if (phone !== undefined)      { updates.push('phone = ?');       args.push(normalizePhoneIn(phone)); }
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
app.get('/api/meds/month', requireAuth, async (req, res) => {
  try {
    const today = todayLocal();
    const [meds] = await getPool().query(
      `SELECT id, name, schedule FROM meds WHERE user_id = ?
        ORDER BY FIELD(schedule,'morning','lunch','evening','night'), sort_order, id`,
      [req.user.id]
    );
    if (!meds.length) return res.json({ days: [], meds: [] });

    const ids = meds.map((m) => m.id);
    const [checks] = await getPool().query(
      `SELECT med_id, DATE_FORMAT(check_date, '%Y-%m-%d') AS d
         FROM med_checks
        WHERE med_id IN (?) AND check_date >= DATE_SUB(?, INTERVAL 29 DAY)`,
      [ids, today]
    );
    const byMed = new Map();
    for (const c of checks) {
      const set = byMed.get(c.med_id) || new Set();
      set.add(c.d);
      byMed.set(c.med_id, set);
    }
    // 30일 날짜 배열 (오래된 순)
    const days = [];
    const t = new Date(today);
    for (let i = 29; i >= 0; i--) {
      const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() - i);
      days.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
    }
    res.json({
      days,
      meds: meds.map((m) => ({
        id: m.id, name: m.name, schedule: m.schedule,
        checks: days.map((d) => (byMed.get(m.id) || new Set()).has(d) ? 1 : 0),
      })),
    });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

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
  res.json(rows.map((r) => ({ ...r, phone: normalizePhoneOut(r.phone) })));
});

app.post('/api/emergency', requireAdmin, async (req, res) => {
  try {
    const name = (req.body?.name || '').toString().trim();
    const phone = normalizePhoneOut(req.body?.phone);
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
    if (req.body?.phone !== undefined) {
      const p = normalizePhoneIn(req.body.phone);
      updates.push('phone = ?'); args.push(p == null ? null : String(p).slice(0, 30));
    }
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
    `SELECT f.alias, f.display_name, f.notice, f.notice_updated_at, f.photo_url,
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
    photoUrl: r.photo_url || null,
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
    const { alias, displayName, notice, photoUrl } = req.body || {};
    const upd = [], args = [];
    if (alias !== undefined) { upd.push('alias = ?'); args.push(String(alias).trim()); }
    if (displayName !== undefined) { upd.push('display_name = ?'); args.push(String(displayName).trim()); }
    let prevFamilyPhoto = null;
    let nextFamilyPhoto = null;
    let photoChanging = false;
    if (photoUrl !== undefined) {
      photoChanging = true;
      const [curF] = await getPool().query('SELECT photo_url FROM families WHERE id = ? LIMIT 1', [req.user.family_id]);
      prevFamilyPhoto = curF[0]?.photo_url || null;
      const raw = photoUrl === null || photoUrl === '' ? '' : String(photoUrl).trim().slice(0, 500);
      nextFamilyPhoto = raw || null;
      upd.push('photo_url = ?'); args.push(nextFamilyPhoto);
    }
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
    if (photoChanging && prevFamilyPhoto && prevFamilyPhoto !== nextFamilyPhoto) {
      safeUnlinkFamilyFile(prevFamilyPhoto);
    }
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'alias-exists' });
    res.status(500).json({ error: 'internal', message: e.message });
  }
});

// ---------- 가족 사진 업로드 (관리자) ----------
app.post(
  '/api/family/photo',
  requireAdmin,
  (req, res, next) => {
    familyPhotoUpload.single('photo')(req, res, (err) => {
      if (err) {
        const msg = err.message === 'invalid-image-type' ? '이미지 파일만 올릴 수 있어요'
          : err.code === 'LIMIT_FILE_SIZE' ? '파일이 너무 커요 (2MB 이하)'
          : (err.message || '업로드 실패');
        return res.status(400).json({ error: 'upload-failed', message: msg });
      }
      if (!req.file) return res.status(400).json({ error: 'no-file', message: '파일이 없어요' });
      next();
    });
  },
  async (req, res) => {
    try {
      const [rows] = await getPool().query('SELECT photo_url FROM families WHERE id = ? LIMIT 1', [req.user.family_id]);
      const prev = rows[0]?.photo_url || null;
      const publicPath = `/uploads/profiles/${familySubDir(req)}/${req.file.filename}`;
      await getPool().query('UPDATE families SET photo_url = ? WHERE id = ?', [publicPath, req.user.family_id]);
      safeUnlinkFamilyFile(prev);
      res.json({ ok: true, photoUrl: publicPath });
    } catch (e) {
      fs.unlink(req.file.path, () => {});
      res.status(500).json({ error: 'internal', message: e.message });
    }
  }
);

// ---------- 가족 갤러리 ----------
app.get('/api/gallery', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(60, Math.max(1, Number(req.query.limit) || 24));
    const before = Number(req.query.before) || 0;
    const args = before > 0 ? [req.user.family_id, before] : [req.user.family_id];
    const where = before > 0 ? 'WHERE g.family_id = ? AND g.id < ?' : 'WHERE g.family_id = ?';
    const [rows] = await getPool().query(
      `SELECT g.id, g.url, g.caption, g.created_at, g.uploader_id,
              u.display_name AS uploader_name, u.icon AS uploader_icon, u.photo_url AS uploader_photo,
              (SELECT COUNT(*) FROM gallery_likes l WHERE l.photo_id = g.id) AS like_count,
              (SELECT COUNT(*) FROM gallery_comments c WHERE c.photo_id = g.id) AS comment_count,
              EXISTS(SELECT 1 FROM gallery_likes l WHERE l.photo_id = g.id AND l.user_id = ?) AS liked
         FROM gallery_photos g
         LEFT JOIN users u ON u.id = g.uploader_id
         ${where}
         ORDER BY g.id DESC
         LIMIT ?`,
      [req.user.id, ...args, limit]
    );
    res.json(rows.map((r) => ({
      id: r.id,
      url: r.url,
      caption: r.caption,
      createdAt: r.created_at,
      uploaderId: r.uploader_id,
      uploaderName: r.uploader_name,
      uploaderIcon: r.uploader_icon,
      uploaderPhoto: r.uploader_photo,
      likeCount: Number(r.like_count) || 0,
      commentCount: Number(r.comment_count) || 0,
      liked: !!Number(r.liked),
      canDelete: r.uploader_id === req.user.id || req.user.role === 'admin',
    })));
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.post(
  '/api/gallery',
  requireAuth,
  (req, res, next) => {
    galleryUpload.single('photo')(req, res, (err) => {
      if (err) {
        const msg = err.message === 'invalid-image-type' ? '이미지 파일만 올릴 수 있어요'
          : err.code === 'LIMIT_FILE_SIZE' ? '파일이 너무 커요 (3MB 이하)'
          : (err.message || '업로드 실패');
        return res.status(400).json({ error: 'upload-failed', message: msg });
      }
      if (!req.file) return res.status(400).json({ error: 'no-file', message: '파일이 없어요' });
      next();
    });
  },
  async (req, res) => {
    try {
      const caption = (req.body?.caption || '').toString().trim().slice(0, 300) || null;
      const url = `/uploads/gallery/${familySubDir(req)}/${req.file.filename}`;
      const [r] = await getPool().query(
        'INSERT INTO gallery_photos (family_id, uploader_id, url, caption) VALUES (?, ?, ?, ?)',
        [req.user.family_id, req.user.id, url, caption]
      );
      res.json({ ok: true, id: r.insertId, url, caption });
    } catch (e) {
      fs.unlink(req.file.path, () => {});
      res.status(500).json({ error: 'internal', message: e.message });
    }
  }
);

app.delete('/api/gallery/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
    const [rows] = await getPool().query(
      'SELECT id, url, uploader_id FROM gallery_photos WHERE id = ? AND family_id = ? LIMIT 1',
      [id, req.user.family_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'not-found' });
    const p = rows[0];
    if (p.uploader_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'forbidden' });
    }
    await getPool().query('DELETE FROM gallery_photos WHERE id = ?', [id]);
    await getPool().query('DELETE FROM gallery_comments WHERE photo_id = ?', [id]);
    await getPool().query('DELETE FROM gallery_likes WHERE photo_id = ?', [id]);
    safeUnlinkGalleryFile(p.url);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

// 같은 가족의 사진인지 확인 (공통)
async function ensureGalleryPhotoOwnedByFamily(photoId, familyId) {
  const [rows] = await getPool().query(
    'SELECT id FROM gallery_photos WHERE id = ? AND family_id = ? LIMIT 1',
    [photoId, familyId]
  );
  return rows.length > 0;
}

// 댓글 목록
app.get('/api/gallery/:id/comments', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
    if (!await ensureGalleryPhotoOwnedByFamily(id, req.user.family_id)) {
      return res.status(404).json({ error: 'not-found' });
    }
    const [rows] = await getPool().query(
      `SELECT c.id, c.text, c.author_id, c.created_at,
              u.display_name AS author_name, u.icon AS author_icon, u.photo_url AS author_photo
         FROM gallery_comments c JOIN users u ON u.id = c.author_id
        WHERE c.photo_id = ? ORDER BY c.created_at ASC`,
      [id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

// 댓글 작성
app.post('/api/gallery/:id/comments', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
    const text = (req.body?.text || '').toString().trim().slice(0, 300);
    if (!text) return res.status(400).json({ error: 'empty' });
    if (!await ensureGalleryPhotoOwnedByFamily(id, req.user.family_id)) {
      return res.status(404).json({ error: 'not-found' });
    }
    const [r] = await getPool().query(
      'INSERT INTO gallery_comments (photo_id, author_id, text) VALUES (?, ?, ?)',
      [id, req.user.id, text]
    );
    res.json({ ok: true, id: r.insertId });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

// 댓글 삭제 — 작성자 본인 또는 관리자
app.delete('/api/gallery/:id/comments/:cid', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const cid = Number(req.params.cid);
    if (!Number.isInteger(id) || !Number.isInteger(cid)) return res.status(400).json({ error: 'bad-id' });
    if (!await ensureGalleryPhotoOwnedByFamily(id, req.user.family_id)) {
      return res.status(404).json({ error: 'not-found' });
    }
    const [rows] = await getPool().query(
      'SELECT author_id FROM gallery_comments WHERE id = ? AND photo_id = ? LIMIT 1',
      [cid, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'not-found' });
    if (rows[0].author_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'forbidden' });
    }
    await getPool().query('DELETE FROM gallery_comments WHERE id = ?', [cid]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

// 좋아요 토글
app.post('/api/gallery/:id/like', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
    if (!await ensureGalleryPhotoOwnedByFamily(id, req.user.family_id)) {
      return res.status(404).json({ error: 'not-found' });
    }
    const [existing] = await getPool().query(
      'SELECT 1 FROM gallery_likes WHERE photo_id = ? AND user_id = ? LIMIT 1',
      [id, req.user.id]
    );
    let liked;
    if (existing.length) {
      await getPool().query('DELETE FROM gallery_likes WHERE photo_id = ? AND user_id = ?', [id, req.user.id]);
      liked = false;
    } else {
      await getPool().query('INSERT IGNORE INTO gallery_likes (photo_id, user_id) VALUES (?, ?)', [id, req.user.id]);
      liked = true;
    }
    const [cnt] = await getPool().query(
      'SELECT COUNT(*) AS c FROM gallery_likes WHERE photo_id = ?',
      [id]
    );
    res.json({ ok: true, liked, likeCount: Number(cnt[0].c) || 0 });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

// ---------- 가족 채팅 ----------
function mapChatRow(r) {
  return {
    id: r.id,
    userId: r.user_id,
    userName: r.user_name,
    userIcon: r.user_icon,
    userPhoto: r.user_photo,
    text: r.text,
    createdAt: r.created_at,
  };
}
app.get('/api/chat', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const before = Number(req.query.before) || 0;
    const after = Number(req.query.after) || 0;
    if (after > 0) {
      const [rows] = await getPool().query(
        `SELECT c.id, c.user_id, c.text, c.created_at,
                u.display_name AS user_name, u.icon AS user_icon, u.photo_url AS user_photo
           FROM chat_messages c
           LEFT JOIN users u ON u.id = c.user_id
          WHERE c.family_id = ? AND c.id > ?
          ORDER BY c.id ASC LIMIT ?`,
        [req.user.family_id, after, limit]
      );
      return res.json(rows.map(mapChatRow));
    }
    const args = before > 0 ? [req.user.family_id, before] : [req.user.family_id];
    const where = before > 0 ? 'WHERE c.family_id = ? AND c.id < ?' : 'WHERE c.family_id = ?';
    const [rows] = await getPool().query(
      `SELECT c.id, c.user_id, c.text, c.created_at,
              u.display_name AS user_name, u.icon AS user_icon, u.photo_url AS user_photo
         FROM chat_messages c
         LEFT JOIN users u ON u.id = c.user_id
         ${where}
         ORDER BY c.id DESC LIMIT ?`,
      [...args, limit]
    );
    // 클라이언트는 오래된 것부터 아래로 렌더 → 뒤집어서 응답
    res.json(rows.reverse().map(mapChatRow));
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.post('/api/chat', requireAuth, async (req, res) => {
  try {
    const text = (req.body?.text || '').toString().trim();
    if (!text) return res.status(400).json({ error: 'empty' });
    if (text.length > 1000) return res.status(400).json({ error: 'too-long', message: '1000자 이하로 작성해 주세요' });
    const [r] = await getPool().query(
      'INSERT INTO chat_messages (family_id, user_id, text) VALUES (?, ?, ?)',
      [req.user.family_id, req.user.id, text]
    );
    // 보낸 사람도 자기 메시지까지 읽음 처리
    await getPool().query(
      `INSERT INTO chat_reads (user_id, family_id, last_read_id) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE last_read_id = GREATEST(last_read_id, VALUES(last_read_id))`,
      [req.user.id, req.user.family_id, r.insertId]
    );
    res.json({ ok: true, id: r.insertId });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.delete('/api/chat/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
    const [rows] = await getPool().query(
      'SELECT user_id FROM chat_messages WHERE id = ? AND family_id = ? LIMIT 1',
      [id, req.user.family_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'not-found' });
    if (rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'forbidden' });
    }
    await getPool().query('DELETE FROM chat_messages WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.get('/api/chat/unread', requireAuth, async (req, res) => {
  try {
    const [rows] = await getPool().query(
      `SELECT last_read_id FROM chat_reads WHERE user_id = ? AND family_id = ? LIMIT 1`,
      [req.user.id, req.user.family_id]
    );
    const lastRead = rows[0]?.last_read_id || 0;
    const [cnt] = await getPool().query(
      `SELECT COUNT(*) AS c, MAX(id) AS maxId FROM chat_messages
        WHERE family_id = ? AND id > ? AND user_id != ?`,
      [req.user.family_id, lastRead, req.user.id]
    );
    res.json({ unread: cnt[0].c || 0, lastId: cnt[0].maxId || lastRead, lastRead });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.post('/api/chat/read', requireAuth, async (req, res) => {
  try {
    const lastId = Number(req.body?.lastId) || 0;
    await getPool().query(
      `INSERT INTO chat_reads (user_id, family_id, last_read_id) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE last_read_id = GREATEST(last_read_id, VALUES(last_read_id))`,
      [req.user.id, req.user.family_id, lastId]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
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
      lat: Number(lat),
      lon: Number(lon),
      tz: process.env.DEFAULT_TZ || 'Asia/Tokyo',
      updatedAt: j.current?.time || new Date().toISOString(),
      source: 'Open-Meteo',
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

/** Google Pollen API 에서 TREE/GRASS/WEED 통합 + plantInfo 종별(스기/히노키 등)
 *  꽃가루 지수(UPI 0–5) 가져오기. 키 미설정·호출 실패 시 null → Open-Meteo 폴백. */
async function fetchGooglePollen(lat, lon) {
  const apiKey = (process.env.GOOGLE_POLLEN_API_KEY || '').trim();
  if (!apiKey) return null;
  try {
    const url = `https://pollen.googleapis.com/v1/forecast:lookup?key=${encodeURIComponent(apiKey)}` +
      `&location.latitude=${lat}&location.longitude=${lon}&days=1&languageCode=ko`;
    const r = await fetch(url);
    if (!r.ok) {
      console.warn('[google-pollen] HTTP', r.status, await r.text().catch(() => ''));
      return null;
    }
    const j = await r.json();
    const day = j.dailyInfo?.[0];
    if (!day) return null;
    const types = day.pollenTypeInfo || [];
    const plants = day.plantInfo || [];
    // 통합 TREE/GRASS/WEED 최대치 (전체 지수)
    const maxValue = types.reduce((mx, t) => {
      const v = t.indexInfo?.value;
      return typeof v === 'number' && v > mx ? v : mx;
    }, 0);
    // 종별(plantInfo) 중 가장 높은 값의 종 — "누가 범인인지" 에 해당
    const plantsWithValue = plants
      .filter((p) => typeof p.indexInfo?.value === 'number')
      .map((p) => ({
        code: p.code,
        name: p.displayName || p.code,
        value: p.indexInfo.value,
        category: p.indexInfo.category ?? null,
        inSeason: p.inSeason ?? null,
      }))
      .sort((a, b) => b.value - a.value);
    const top = plantsWithValue[0] || null;
    // Google UPI 0–5 → 프론트 level 매핑
    const pollenLevel = maxValue <= 1 ? 'good'
      : maxValue === 2 ? 'normal'
      : maxValue <= 4 ? 'bad'
      : 'worst';
    return {
      pollen: maxValue,
      pollenLevel,
      pollenSource: 'google',
      pollenTypes: types.map((t) => ({
        code: t.code,
        name: t.displayName,
        value: t.indexInfo?.value ?? null,
        category: t.indexInfo?.category ?? null,
      })),
      plants: plantsWithValue,
      topPlant: top,
    };
  } catch (e) {
    console.warn('[google-pollen]', e.message);
    return null;
  }
}

app.get('/api/air', async (_req, res) => {
  try {
    const lat = process.env.DEFAULT_LAT || '35.6895';
    const lon = process.env.DEFAULT_LON || '139.6917';
    const key = `air:${lat},${lon}`;
    const cached = cacheGet(key, 30 * 60 * 1000);
    if (cached) return res.json(cached);

    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
      `&current=pm10,pm2_5,alder_pollen,birch_pollen,grass_pollen&timezone=${TZ_ENC}`;
    const [j, google] = await Promise.all([
      (await fetch(url)).json().catch(() => ({})),
      fetchGooglePollen(lat, lon),
    ]);

    const pm10 = j.current?.pm10 ?? null;
    const pm25 = j.current?.pm2_5 ?? null;
    // Open-Meteo 꽃가루 (동아시아엔 부정확) — Google 실패 시 폴백용
    const omPollen = Math.max(
      j.current?.alder_pollen ?? 0, j.current?.birch_pollen ?? 0, j.current?.grass_pollen ?? 0
    );
    const out = {
      pm10, pm25,
      pm10Level: level(pm10, [30, 80, 150]),
      pm25Level: level(pm25, [15, 35, 75]),
      // Google Pollen 우선, 실패 시 Open-Meteo 폴백
      pollen: google ? google.pollen : omPollen,
      pollenLevel: google ? google.pollenLevel : level(omPollen, [1, 10, 50]),
      pollenSource: google ? 'google' : 'open-meteo',
      pollenTypes: google ? google.pollenTypes : null,
      pollenPlants: google ? google.plants : null,
      pollenTopPlant: google ? google.topPlant : null,
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

  // 1) 가족 제안 질문 중 미사용 가장 오래된 것 우선
  const [custom] = await getPool().query(
    `SELECT id, text FROM custom_questions
       WHERE family_id = ? AND used_date IS NULL
       ORDER BY created_at ASC LIMIT 1`,
    [familyId]
  );
  let text;
  let customId = null;
  if (custom.length) {
    text = custom[0].text;
    customId = custom[0].id;
  } else {
    const days = Math.floor(new Date(dateStr).getTime() / 86400000);
    const idx = ((familyId + days) % QUESTIONS.length + QUESTIONS.length) % QUESTIONS.length;
    text = QUESTIONS[idx];
  }

  await getPool().query(
    'INSERT IGNORE INTO daily_questions (family_id, question_date, question_text) VALUES (?, ?, ?)',
    [familyId, dateStr, text]
  );
  if (customId) {
    await getPool().query(
      'UPDATE custom_questions SET used_date = ? WHERE id = ?',
      [dateStr, customId]
    );
  }
  const [rows2] = await getPool().query(
    'SELECT * FROM daily_questions WHERE family_id = ? AND question_date = ? LIMIT 1',
    [familyId, dateStr]
  );
  return rows2[0];
}

// ---------- 가족 질문 제안 ----------
app.get('/api/question/suggestions', requireAuth, async (req, res) => {
  const [rows] = await getPool().query(
    `SELECT q.id, q.text, q.author_id, q.created_at, q.used_date,
            u.display_name AS author_name, u.icon AS author_icon
       FROM custom_questions q JOIN users u ON u.id = q.author_id
      WHERE q.family_id = ?
      ORDER BY (q.used_date IS NOT NULL), q.created_at DESC LIMIT 40`,
    [req.user.family_id]
  );
  res.json(rows);
});

app.post('/api/question/suggest', requireAuth, async (req, res) => {
  const text = (req.body?.text || '').toString().trim().slice(0, 300);
  if (!text) return res.status(400).json({ error: 'text-required' });
  const [r] = await getPool().query(
    'INSERT INTO custom_questions (family_id, author_id, text) VALUES (?, ?, ?)',
    [req.user.family_id, req.user.id, text]
  );
  res.json({ ok: true, id: r.insertId });
});

app.delete('/api/question/suggestions/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
  // 작성자 본인 또는 관리자, 아직 사용 안 된 것만
  await getPool().query(
    `DELETE FROM custom_questions
      WHERE id = ? AND family_id = ? AND used_date IS NULL
        AND (author_id = ? OR ? = 'admin')`,
    [id, req.user.family_id, req.user.id, req.user.role]
  );
  res.json({ ok: true });
});

// ---------- 개인 일기 ----------
app.get('/api/diary/today', requireAuth, async (req, res) => {
  const today = todayLocal();
  const [rows] = await getPool().query(
    'SELECT text, updated_at FROM personal_diary WHERE user_id = ? AND entry_date = ? LIMIT 1',
    [req.user.id, today]
  );
  res.json({ date: today, text: rows[0]?.text || '', updatedAt: rows[0]?.updated_at || null });
});

app.post('/api/diary/today', requireAuth, async (req, res) => {
  const text = (req.body?.text || '').toString().trim().slice(0, 500);
  const today = todayLocal();
  if (!text) {
    await getPool().query(
      'DELETE FROM personal_diary WHERE user_id = ? AND entry_date = ?',
      [req.user.id, today]
    );
    return res.json({ ok: true, text: '' });
  }
  await getPool().query(
    `INSERT INTO personal_diary (user_id, entry_date, text) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE text = VALUES(text)`,
    [req.user.id, today, text]
  );
  res.json({ ok: true, text });
});

app.get('/api/diary/streak', requireAuth, async (req, res) => {
  try {
    const [rows] = await getPool().query(
      `SELECT DATE_FORMAT(entry_date, '%Y-%m-%d') AS d
         FROM personal_diary WHERE user_id = ?
         ORDER BY entry_date DESC LIMIT 120`,
      [req.user.id]
    );
    const dates = new Set(rows.map((r) => r.d));
    const tz = process.env.DEFAULT_TZ || 'Asia/Tokyo';
    const todayStr = new Intl.DateTimeFormat('sv-SE', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());

    // 오늘 또는 어제부터 거슬러 연속일 계산 (오늘 안 썼어도 어제까지 이어지면 연속으로 인정)
    let current = 0;
    const start = new Date(todayStr);
    if (!dates.has(todayStr)) start.setDate(start.getDate() - 1);
    for (let i = 0; i < 120; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() - i);
      const ymd = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (dates.has(ymd)) current++;
      else break;
    }
    // 최장 기록
    let longest = 0, run = 0;
    const sorted = [...dates].sort();
    let prev = null;
    for (const d of sorted) {
      if (prev) {
        const pd = new Date(prev);
        const cd = new Date(d);
        const diff = Math.round((cd - pd) / 86400000);
        run = (diff === 1) ? run + 1 : 1;
      } else { run = 1; }
      if (run > longest) longest = run;
      prev = d;
    }
    res.json({ current, longest, totalDays: dates.size });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.get('/api/diary/recent', requireAuth, async (req, res) => {
  const limit = Math.min(30, Number(req.query.limit) || 14);
  const [rows] = await getPool().query(
    `SELECT DATE_FORMAT(entry_date, '%Y-%m-%d') AS date, text, updated_at
       FROM personal_diary WHERE user_id = ?
       ORDER BY entry_date DESC LIMIT ?`,
    [req.user.id, limit]
  );
  res.json(rows);
});

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
    const imageUrl = req.body?.imageUrl ? String(req.body.imageUrl).trim().slice(0, 500) : null;
    const today = todayLocal();
    const q = await getOrCreateQuestion(req.user.family_id, today);
    await getPool().query(
      `INSERT INTO daily_answers (question_id, user_id, answer_text, is_skip, image_url) VALUES (?, ?, ?, 0, ?)
       ON DUPLICATE KEY UPDATE answer_text = VALUES(answer_text), is_skip = 0, image_url = VALUES(image_url)`,
      [q.id, req.user.id, answer, imageUrl]
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
      `SELECT a.id AS answer_id, a.answer_text, a.is_skip, a.user_id, a.image_url,
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

// ---------- 가족 공용 일정 (events) ----------
app.get('/api/events', requireAuth, async (req, res) => {
  try {
    const from = (req.query.from || todayLocal()).slice(0, 10);
    const to = (req.query.to || '').slice(0, 10);
    let sql = `SELECT e.id, e.title, e.emoji, DATE_FORMAT(e.event_date, '%Y-%m-%d') AS event_date,
                      TIME_FORMAT(e.event_time, '%H:%i') AS event_time,
                      e.location, e.note, e.created_by,
                      u.display_name AS author_name, u.icon AS author_icon
                 FROM family_events e
                 LEFT JOIN users u ON u.id = e.created_by
                WHERE e.family_id = ? AND e.event_date >= ?`;
    const args = [req.user.family_id, from];
    if (to) { sql += ' AND e.event_date <= ?'; args.push(to); }
    sql += ' ORDER BY e.event_date ASC, e.event_time ASC LIMIT 100';
    const [rows] = await getPool().query(sql, args);
    // daysLeft
    const now = new Date();
    const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const list = rows.map((r) => {
      const d = new Date(r.event_date);
      const daysLeft = Math.round((d - todayMid) / 86400000);
      return { ...r, daysLeft };
    });
    res.json(list);
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.post('/api/events', requireAuth, async (req, res) => {
  try {
    const title = (req.body?.title || '').toString().trim().slice(0, 100);
    const emoji = (req.body?.emoji || '📅').toString().slice(0, 10);
    const eventDate = (req.body?.eventDate || '').toString().slice(0, 10);
    const eventTime = req.body?.eventTime ? String(req.body.eventTime).slice(0, 5) : null;
    const location = req.body?.location ? String(req.body.location).trim().slice(0, 100) : null;
    const note = req.body?.note ? String(req.body.note).trim().slice(0, 300) : null;
    if (!title || !eventDate) return res.status(400).json({ error: 'title-date-required' });
    const [r] = await getPool().query(
      `INSERT INTO family_events (family_id, title, emoji, event_date, event_time, location, note, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.family_id, title, emoji, eventDate, eventTime, location, note, req.user.id]
    );
    res.json({ ok: true, id: r.insertId });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.delete('/api/events/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
  await getPool().query(
    'DELETE FROM family_events WHERE id = ? AND family_id = ?',
    [id, req.user.family_id]
  );
  res.json({ ok: true });
});

// ---------- 프로필 누적 통계 ----------
app.get('/api/user/:id/stats', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
    const [ok] = await getPool().query(
      'SELECT 1 FROM users WHERE id = ? AND family_id = ? LIMIT 1',
      [id, req.user.family_id]
    );
    if (!ok.length) return res.status(404).json({ error: 'not-found' });

    const [ans] = await getPool().query(
      `SELECT COUNT(*) AS c FROM daily_answers a
         JOIN daily_questions q ON q.id = a.question_id
        WHERE a.user_id = ? AND q.family_id = ?
          AND a.answer_text IS NOT NULL AND a.is_skip = 0`,
      [id, req.user.family_id]
    );
    const [memos] = await getPool().query(
      'SELECT COUNT(*) AS c FROM memos WHERE family_id = ? AND created_by = ?',
      [req.user.family_id, id]
    );
    const [stkRecv] = await getPool().query(
      'SELECT COUNT(*) AS c FROM family_stickers WHERE family_id = ? AND receiver_id = ?',
      [req.user.family_id, id]
    );
    const [stkSent] = await getPool().query(
      'SELECT COUNT(*) AS c FROM family_stickers WHERE family_id = ? AND sender_id = ?',
      [req.user.family_id, id]
    );
    res.json({
      answers: Number(ans[0].c),
      memos: Number(memos[0].c),
      stickersReceived: Number(stkRecv[0].c),
      stickersSent: Number(stkSent[0].c),
    });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
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
app.use('/uploads/profiles', express.static(PROFILE_PHOTOS_DIR, {
  maxAge: '0',
  index: false,
  fallthrough: true,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'private, no-cache');
  },
}));
app.use('/uploads/gallery', express.static(GALLERY_DIR, {
  maxAge: '7d',
  immutable: true,
  index: false,
  fallthrough: true,
}));
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
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: 'upload-failed', message: err.code === 'LIMIT_FILE_SIZE' ? '파일이 너무 커요 (1MB 이하)' : err.message });
  }
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
