require('dotenv').config();
const http = require('http');
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
const { attachGostopServer } = require('./gostop-server');
const { sendPush, familyUserIds } = require('./push');

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

const GOALS_DIR = path.join(DATA_DIR, 'goals');
try { fs.mkdirSync(GOALS_DIR, { recursive: true }); } catch (e) { console.warn('[goals] mkdir:', e.message); }

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

// ---------- 목표 증거 업로드 ----------
function makeGoalsDestination(req, _file, cb) {
  try {
    const dir = path.join(GOALS_DIR, familySubDir(req));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  } catch (e) { cb(e); }
}
const goalsUpload = multer({
  storage: multer.diskStorage({
    destination: makeGoalsDestination,
    filename: (_req, _file, cb) => {
      cb(null, `ev-${Date.now()}-${Math.random().toString(36).slice(2, 11)}.jpg`);
    },
  }),
  limits: { fileSize: Math.ceil(3.1 * 1024 * 1024) },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.mimetype);
    cb(ok ? null : new Error('invalid-image-type'), ok);
  },
});
function resolveSafeGoalsPath(url) {
  if (!url || typeof url !== 'string' || !url.startsWith('/uploads/goals/')) return null;
  const rel = url.slice('/uploads/goals/'.length);
  if (!rel || rel.includes('..')) return null;
  const parts = rel.split('/').filter(Boolean);
  if (!parts.length) return null;
  const baseDir = path.resolve(GOALS_DIR);
  const fp = path.resolve(baseDir, ...parts);
  if (fp !== baseDir && !fp.startsWith(baseDir + path.sep)) return null;
  return { fullPath: fp, basename: parts[parts.length - 1] };
}
function safeUnlinkGoalsFile(url) {
  const r = resolveSafeGoalsPath(url);
  if (!r) return;
  if (!/^ev-\d+-[a-z0-9]+\.jpg$/i.test(r.basename)) return;
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
      `SELECT id, display_name, icon, role, birth_year, birth_month, birth_day, is_pet,
              phone, photo_url, mood, mood_date, mood_comment,
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
        const commentToday = moodYmd === todayStr ? (u.mood_comment || null) : null;
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
          moodComment: commentToday,
          activated: !!u.activated,
          isPet: !!u.is_pet,
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

// ---------- 푸시 알림 디바이스 토큰 등록/해제 ----------
app.post('/api/devices/register-token', requireAuth, async (req, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    const platform = String(req.body?.platform || '').trim().toLowerCase();
    if (!token || token.length > 255) return res.status(400).json({ error: 'bad-token' });
    if (!['ios', 'android', 'web'].includes(platform)) return res.status(400).json({ error: 'bad-platform' });
    await getPool().query(
      `INSERT INTO device_tokens (token, user_id, platform) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), platform = VALUES(platform)`,
      [token, req.user.id, platform]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.post('/api/devices/unregister-token', requireAuth, async (req, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    if (!token) return res.status(400).json({ error: 'bad-token' });
    await getPool().query('DELETE FROM device_tokens WHERE token = ? AND user_id = ?', [token, req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
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

// ---------- 프로필 사진 업로드 (관리자가 다른 가족 멤버/펫 대상) ----------
app.post(
  '/api/users/:id/photo',
  requireAdmin,
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
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: 'bad-id' });
      }
      // 같은 가족인지 확인
      const [rows] = await getPool().query(
        'SELECT id, photo_url FROM users WHERE id = ? AND family_id = ? LIMIT 1',
        [id, req.user.family_id]
      );
      if (!rows.length) {
        fs.unlink(req.file.path, () => {});
        return res.status(404).json({ error: 'not-found' });
      }
      const prev = rows[0].photo_url || null;
      const publicPath = `/uploads/profiles/${familySubDir(req)}/${req.file.filename}`;
      await getPool().query('UPDATE users SET photo_url = ? WHERE id = ?', [publicPath, id]);
      safeUnlinkProfileFile(prev, id);
      res.json({ ok: true, photoUrl: publicPath });
    } catch (e) {
      fs.unlink(req.file.path, () => {});
      res.status(500).json({ error: 'internal', message: e.message });
    }
  }
);

// ---------- 프로필 사진 삭제 (관리자) ----------
app.delete('/api/users/:id/photo', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
    const [rows] = await getPool().query(
      'SELECT photo_url FROM users WHERE id = ? AND family_id = ? LIMIT 1',
      [id, req.user.family_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'not-found' });
    const prev = rows[0].photo_url || null;
    await getPool().query('UPDATE users SET photo_url = NULL WHERE id = ?', [id]);
    safeUnlinkProfileFile(prev, id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

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
    // 개선안 §3.3 기능1: 1이모지 + 1줄 코멘트
    let comment = (req.body?.comment ?? '').toString().trim();
    if (comment.length > 120) comment = comment.slice(0, 120);
    const commentVal = comment ? comment : null;

    const tz = process.env.DEFAULT_TZ || 'Asia/Tokyo';
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    await getPool().query(
      'UPDATE users SET mood = ?, mood_date = ?, mood_comment = ? WHERE id = ?',
      [mood || null, mood ? today : null, mood ? commentVal : null, req.user.id]
    );
    if (mood) {
      await getPool().query(
        `INSERT INTO mood_history (user_id, mood, mood_date, comment) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE mood = VALUES(mood), comment = VALUES(comment)`,
        [req.user.id, mood, today, commentVal]
      );
    } else {
      await getPool().query(
        'DELETE FROM mood_history WHERE user_id = ? AND mood_date = ?',
        [req.user.id, today]
      );
    }
    res.json({ ok: true, mood: mood || null, comment: mood ? commentVal : null });
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
    `SELECT id, username, display_name, role, icon, birth_year, birth_month, birth_day, is_lunar, is_pet, phone, photo_url,
            (password_hash IS NOT NULL) AS activated,
            invite_token, invite_expires_at
       FROM users WHERE family_id = ? ORDER BY role DESC, id ASC`,
    [req.user.family_id]
  );
  res.json(rows.map((r) => ({
    ...publicUser(r),
    isPet: !!r.is_pet,
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
  const { displayName, role, icon, birthYear, birthMonth, birthDay, isLunar, isPet, password, phone } = req.body || {};
  if (displayName !== undefined) { updates.push('display_name = ?'); args.push(String(displayName).trim()); }
  if (role !== undefined && (role === 'admin' || role === 'member')) { updates.push('role = ?'); args.push(role); }
  if (icon !== undefined) { updates.push('icon = ?'); args.push(String(icon).trim() || 'star'); }
  if (birthYear !== undefined)  { updates.push('birth_year = ?');  args.push(Number(birthYear)  || null); }
  if (birthMonth !== undefined) { updates.push('birth_month = ?'); args.push(Number(birthMonth) || null); }
  if (birthDay !== undefined)   { updates.push('birth_day = ?');   args.push(Number(birthDay)   || null); }
  if (isLunar !== undefined)    { updates.push('is_lunar = ?');    args.push(isLunar ? 1 : 0); }
  if (isPet !== undefined)      { updates.push('is_pet = ?');      args.push(isPet ? 1 : 0); }
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

// 공지만 수정 — 가족 구성원 누구나 가능
app.patch('/api/family/notice', requireAuth, async (req, res) => {
  try {
    const raw = req.body?.notice;
    const n = raw == null ? '' : String(raw).trim();
    const text = n.slice(0, 500) || null;
    const at = text ? new Date() : null;
    const by = text ? req.user.id : null;
    await getPool().query(
      'UPDATE families SET notice = ?, notice_updated_at = ?, notice_updated_by = ? WHERE id = ?',
      [text, at, by, req.user.family_id]
    );
    if (text) {
      await getPool().query(
        'INSERT INTO notice_history (family_id, text, author_id) VALUES (?, ?, ?)',
        [req.user.family_id, text, req.user.id]
      );
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
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
      `SELECT g.id, g.url, g.caption, g.created_at, g.uploader_id, g.album_id,
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
      albumId: r.album_id || null,
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
      const albumId = (req.body?.album_id || '').toString().trim().slice(0, 36) || null;
      const url = `/uploads/gallery/${familySubDir(req)}/${req.file.filename}`;
      const [r] = await getPool().query(
        'INSERT INTO gallery_photos (family_id, uploader_id, url, caption, album_id) VALUES (?, ?, ?, ?, ?)',
        [req.user.family_id, req.user.id, url, caption, albumId]
      );
      res.json({ ok: true, id: r.insertId, url, caption, albumId });
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
    text: r.text || '',
    imageUrl: r.image_url || null,
    createdAt: r.created_at,
  };
}

// 채팅 이미지: 갤러리와 같은 보안 패턴, 별도 디렉터리
const CHAT_DIR = path.join(DATA_DIR, 'chat');
try { fs.mkdirSync(CHAT_DIR, { recursive: true }); } catch (e) { console.warn('[chat] mkdir:', e.message); }
function makeChatDestination(req, _file, cb) {
  try {
    const dir = path.join(CHAT_DIR, familySubDir(req));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  } catch (e) { cb(e); }
}
const chatPhotoUpload = multer({
  storage: multer.diskStorage({
    destination: makeChatDestination,
    filename: (_req, _file, cb) => {
      cb(null, `c-${Date.now()}-${Math.random().toString(36).slice(2, 11)}.jpg`);
    },
  }),
  limits: { fileSize: Math.ceil(3.1 * 1024 * 1024) },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.mimetype);
    cb(ok ? null : new Error('invalid-image-type'), ok);
  },
});
function resolveSafeChatPath(url) {
  if (!url || typeof url !== 'string' || !url.startsWith('/uploads/chat/')) return null;
  const rel = url.slice('/uploads/chat/'.length);
  if (!rel || rel.includes('..')) return null;
  const parts = rel.split('/').filter(Boolean);
  if (!parts.length) return null;
  const baseDir = path.resolve(CHAT_DIR);
  const fp = path.resolve(baseDir, ...parts);
  if (fp !== baseDir && !fp.startsWith(baseDir + path.sep)) return null;
  return { fullPath: fp, basename: parts[parts.length - 1] };
}
function safeUnlinkChatFile(url) {
  const r = resolveSafeChatPath(url);
  if (!r) return;
  if (!/^c-\d+-[a-z0-9]+\.jpg$/i.test(r.basename)) return;
  fs.unlink(r.fullPath, () => {});
}
app.get('/api/chat', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const before = Number(req.query.before) || 0;
    const after = Number(req.query.after) || 0;
    if (after > 0) {
      const [rows] = await getPool().query(
        `SELECT c.id, c.user_id, c.text, c.image_url, c.created_at,
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
      `SELECT c.id, c.user_id, c.text, c.image_url, c.created_at,
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
    notifyChat(req.user, text).catch((e) => console.warn('[push] chat:', e.message));
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

// 채팅 삭제: 본인 메시지만, 작성 후 5분 이내만
const CHAT_DELETE_WINDOW_MS = 5 * 60 * 1000;
app.delete('/api/chat/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
    const [rows] = await getPool().query(
      'SELECT user_id, image_url, created_at FROM chat_messages WHERE id = ? AND family_id = ? LIMIT 1',
      [id, req.user.family_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'not-found' });
    if (rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'forbidden', message: '본인이 쓴 메시지만 삭제할 수 있어요' });
    }
    const createdAt = new Date(rows[0].created_at).getTime();
    if (Number.isFinite(createdAt) && Date.now() - createdAt > CHAT_DELETE_WINDOW_MS) {
      return res.status(403).json({ error: 'too-late', message: '5분 이상 지난 메시지는 삭제할 수 없어요' });
    }
    await getPool().query('DELETE FROM chat_messages WHERE id = ?', [id]);
    if (rows[0].image_url) safeUnlinkChatFile(rows[0].image_url);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

// 채팅 사진 업로드 — 압축된 JPEG Blob 한 장 + 선택적 text
app.post(
  '/api/chat/photo',
  requireAuth,
  (req, res, next) => {
    chatPhotoUpload.single('photo')(req, res, (err) => {
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
      const text = (req.body?.text || '').toString().trim().slice(0, 1000);
      const url = `/uploads/chat/${familySubDir(req)}/${req.file.filename}`;
      const [r] = await getPool().query(
        'INSERT INTO chat_messages (family_id, user_id, text, image_url) VALUES (?, ?, ?, ?)',
        [req.user.family_id, req.user.id, text, url]
      );
      await getPool().query(
        `INSERT INTO chat_reads (user_id, family_id, last_read_id) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE last_read_id = GREATEST(last_read_id, VALUES(last_read_id))`,
        [req.user.id, req.user.family_id, r.insertId]
      );
      res.json({ ok: true, id: r.insertId, imageUrl: url, text });
      notifyChat(req.user, text || '사진을 보냈어요').catch((e) => console.warn('[push] chat-photo:', e.message));
    } catch (e) {
      try { fs.unlink(req.file.path, () => {}); } catch {}
      res.status(500).json({ error: 'internal', message: e.message });
    }
  }
);

// 채팅 사진을 가족 갤러리에 복사 저장
app.post('/api/chat/:id/save-to-gallery', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
    const [rows] = await getPool().query(
      'SELECT image_url, text FROM chat_messages WHERE id = ? AND family_id = ? LIMIT 1',
      [id, req.user.family_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'not-found' });
    const srcUrl = rows[0].image_url;
    if (!srcUrl) return res.status(400).json({ error: 'no-image', message: '사진이 없는 메시지예요' });
    const srcInfo = resolveSafeChatPath(srcUrl);
    if (!srcInfo) return res.status(400).json({ error: 'bad-path' });

    const dstDir = path.join(GALLERY_DIR, familySubDir(req));
    fs.mkdirSync(dstDir, { recursive: true });
    const dstName = `g-${Date.now()}-${Math.random().toString(36).slice(2, 11)}.jpg`;
    const dstPath = path.join(dstDir, dstName);
    await new Promise((resolve, reject) => {
      fs.copyFile(srcInfo.fullPath, dstPath, (err) => err ? reject(err) : resolve());
    });
    const dstUrl = `/uploads/gallery/${familySubDir(req)}/${dstName}`;
    const caption = (rows[0].text || '').toString().trim().slice(0, 300) || null;
    const [ins] = await getPool().query(
      'INSERT INTO gallery_photos (family_id, uploader_id, url, caption) VALUES (?, ?, ?, ?)',
      [req.user.family_id, req.user.id, dstUrl, caption]
    );
    res.json({ ok: true, id: ins.insertId, url: dstUrl });
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

// 타이핑 인디케이터 (메모리, family_id 별 user_id → 마지막 ping 시각)
const TYPING_TTL_MS = 4500;
const TYPING_STATE = new Map();
function setTypingFor(familyId, userId) {
  let m = TYPING_STATE.get(familyId);
  if (!m) { m = new Map(); TYPING_STATE.set(familyId, m); }
  m.set(userId, Date.now());
}
function getTypingFor(familyId, excludeUserId) {
  const m = TYPING_STATE.get(familyId);
  if (!m) return [];
  const now = Date.now();
  const out = [];
  for (const [uid, ts] of m) {
    if (now - ts >= TYPING_TTL_MS) { m.delete(uid); continue; }
    if (uid !== excludeUserId) out.push(uid);
  }
  return out;
}
app.post('/api/chat/typing', requireAuth, (req, res) => {
  setTypingFor(req.user.family_id, req.user.id);
  res.json({ ok: true });
});
app.get('/api/chat/typing', requireAuth, (req, res) => {
  const userIds = getTypingFor(req.user.family_id, req.user.id);
  res.json({ userIds });
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

// ---------- 실시간 사다리타기 ----------
const LADDER_GAMES = new Map();      // gameId → game
let LADDER_NEXT_ID = 1;
const LADDER_GAME_TTL_MS = 10 * 60 * 1000; // 10분 후 자동 정리
const LADDER_COUNTDOWN_MS = 5000;    // 5초 카운트다운 (3 → 5)
const LADDER_RUN_MS = 11000;         // 애니메이션·발표 시간 (8명 stagger + 4.8s 느린 애니 + reveal 여유)

const LADDER_LOBBY_IDLE_MS = 5 * 60 * 1000; // 5분 동안 활동 없는 lobby 자동 정리

function ladderFindActiveByFamily(familyId) {
  for (const g of LADDER_GAMES.values()) {
    if (g.familyId !== familyId) continue;
    if (g.status === 'done') continue;
    // lobby 인데 너무 오래 방치된 방은 정리
    if (g.status === 'lobby') {
      const lastTouch = g.lastActivityAt || g.createdAt;
      if (Date.now() - lastTouch > LADDER_LOBBY_IDLE_MS && g.participants.length === 0) {
        LADDER_GAMES.delete(g.id);
        continue;
      }
    }
    return g;
  }
  return null;
}

function ladderSerialize(game) {
  return {
    id: game.id,
    hostId: game.hostId,
    status: game.status,
    count: game.count,
    results: game.results,
    participants: game.participants,
    rungs: (game.status === 'running' || game.status === 'done') ? game.rungs : null,
    traces: (game.status === 'running' || game.status === 'done') ? game.traces : null,
    rows: game.rows || 0,
    countdownStartAt: game.countdownStartAt,
    runStartAt: game.runStartAt,
    finishedAt: game.finishedAt,
  };
}

function ladderGenerate(cols) {
  // 1.5배 더 빽빽한 사다리 — 행 수 1.5x + 가지 확률 0.45 → 0.55 (인접 차단으로 한도 있어 두 축 함께 증가)
  const ROWS = Math.max(15, Math.round(cols * 4.5));
  const rungs = [];
  for (let r = 0; r < ROWS; r++) {
    rungs[r] = [];
    for (let g = 0; g < cols - 1; g++) {
      if (g > 0 && rungs[r][g - 1]) { rungs[r][g] = false; continue; }
      rungs[r][g] = Math.random() < 0.55;
    }
  }
  const traces = [];
  for (let start = 0; start < cols; start++) {
    let col = start;
    const path = [{ col, row: 0 }];
    for (let r = 0; r < ROWS; r++) {
      if (col > 0 && rungs[r][col - 1]) col -= 1;
      else if (col < cols - 1 && rungs[r][col]) col += 1;
      path.push({ col, row: r + 1 });
    }
    traces.push({ start, finalCol: col, path });
  }
  return { rungs, traces, rows: ROWS };
}

async function ladderPostResult(game) {
  const lines = ['🎲 사다리 결과'];
  const sorted = [...game.participants].sort((a, b) => a.slot - b.slot);
  for (const p of sorted) {
    const trace = game.traces[p.slot];
    const result = game.results[trace.finalCol] || `결과 ${trace.finalCol + 1}`;
    lines.push(`• ${p.name} → ${result}`);
  }
  try {
    await getPool().query(
      'INSERT INTO chat_messages (family_id, user_id, text) VALUES (?, ?, ?)',
      [game.familyId, game.hostId, lines.join('\n')]
    );
  } catch {}
}

function ladderStartCountdown(game) {
  if (game.status !== 'lobby') return;
  game.status = 'countdown';
  game.countdownStartAt = Date.now();
  setTimeout(() => {
    if (game.status !== 'countdown') return;
    const ladder = ladderGenerate(game.count);
    game.rungs = ladder.rungs;
    game.traces = ladder.traces;
    game.rows = ladder.rows;
    game.status = 'running';
    game.runStartAt = Date.now();
    setTimeout(async () => {
      if (game.status !== 'running') return;
      game.status = 'done';
      game.finishedAt = Date.now();
      await ladderPostResult(game);
      setTimeout(() => LADDER_GAMES.delete(game.id), LADDER_GAME_TTL_MS);
    }, LADDER_RUN_MS);
  }, LADDER_COUNTDOWN_MS);
}

app.get('/api/ladder/games/active', requireAuth, (req, res) => {
  const game = ladderFindActiveByFamily(req.user.family_id);
  if (!game) return res.json({ active: false });
  res.json({ active: true, game: ladderSerialize(game) });
});

app.post('/api/ladder/games', requireAuth, async (req, res) => {
  try {
    const existing = ladderFindActiveByFamily(req.user.family_id);
    if (existing) return res.status(409).json({ error: 'active-game-exists', gameId: existing.id });
    const count = Math.max(2, Math.min(8, Number(req.body?.count) || 4));
    let results = Array.isArray(req.body?.results) ? req.body.results.slice(0, count).map(r => String(r || '').slice(0, 14)) : [];
    while (results.length < count) results.push(results.length === 0 ? '💣 당첨' : '꽝');
    const id = LADDER_NEXT_ID++;
    const game = {
      id,
      familyId: req.user.family_id,
      hostId: req.user.id,
      status: 'lobby',
      count, results,
      participants: [],
      rungs: null, traces: null, rows: 0,
      countdownStartAt: null, runStartAt: null, finishedAt: null,
      createdAt: Date.now(),
    };
    game.lastActivityAt = Date.now();
    LADDER_GAMES.set(id, game);
    // 채팅에 게임 시작 메시지 (특수 prefix — 클라이언트가 카드로 렌더)
    await getPool().query(
      'INSERT INTO chat_messages (family_id, user_id, text) VALUES (?, ?, ?)',
      [req.user.family_id, req.user.id, `/ladder-game/${id}`]
    );
    res.json({ ok: true, game: ladderSerialize(game) });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.get('/api/ladder/games/:id', requireAuth, (req, res) => {
  const game = LADDER_GAMES.get(Number(req.params.id));
  if (!game || game.familyId !== req.user.family_id) return res.status(404).json({ error: 'not-found' });
  res.json(ladderSerialize(game));
});

app.post('/api/ladder/games/:id/join', requireAuth, async (req, res) => {
  try {
    const game = LADDER_GAMES.get(Number(req.params.id));
    if (!game || game.familyId !== req.user.family_id) return res.status(404).json({ error: 'not-found' });
    if (game.status !== 'lobby') return res.status(409).json({ error: 'locked' });
    const slot = Number(req.body?.slot);
    if (!Number.isInteger(slot) || slot < 0 || slot >= game.count) {
      return res.status(400).json({ error: 'bad-slot' });
    }
    if (game.participants.some(p => p.slot === slot && p.userId !== req.user.id)) {
      return res.status(409).json({ error: 'slot-taken', message: '이미 다른 가족이 선택한 자리에요' });
    }
    const [rows] = await getPool().query(
      'SELECT id, display_name, icon, photo_url FROM users WHERE id = ? LIMIT 1',
      [req.user.id]
    );
    const me = rows[0];
    const existing = game.participants.find(p => p.userId === req.user.id);
    if (existing) {
      existing.slot = slot;
      existing.ready = false;
    } else {
      game.participants.push({
        userId: req.user.id, slot, ready: false,
        name: me?.display_name || '가족',
        icon: me?.icon || 'star',
        photoUrl: me?.photo_url || null,
      });
    }
    game.lastActivityAt = Date.now();
    res.json(ladderSerialize(game));
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.post('/api/ladder/games/:id/ready', requireAuth, (req, res) => {
  const game = LADDER_GAMES.get(Number(req.params.id));
  if (!game || game.familyId !== req.user.family_id) return res.status(404).json({ error: 'not-found' });
  if (game.status !== 'lobby') return res.status(409).json({ error: 'locked' });
  const me = game.participants.find(p => p.userId === req.user.id);
  if (!me) return res.status(404).json({ error: 'not-joined' });
  me.ready = !!req.body?.ready;
  game.lastActivityAt = Date.now();
  res.json(ladderSerialize(game));
});

app.post('/api/ladder/games/:id/start', requireAuth, (req, res) => {
  const game = LADDER_GAMES.get(Number(req.params.id));
  if (!game || game.familyId !== req.user.family_id) return res.status(404).json({ error: 'not-found' });
  if (game.status !== 'lobby') return res.status(409).json({ error: 'locked' });
  if (game.hostId !== req.user.id) return res.status(403).json({ error: 'not-host', message: '방을 만든 사람만 시작할 수 있어요' });
  if (game.participants.length !== game.count) return res.status(409).json({ error: 'slots-not-full', message: '모든 자리가 채워져야 시작할 수 있어요' });
  if (game.participants.length < 2) return res.status(409).json({ error: 'too-few', message: '2명 이상이 필요해요' });
  if (!game.participants.every(p => p.ready)) return res.status(409).json({ error: 'not-all-ready', message: '모두 준비해야 시작할 수 있어요' });
  ladderStartCountdown(game);
  game.lastActivityAt = Date.now();
  res.json(ladderSerialize(game));
});

app.post('/api/ladder/games/:id/leave', requireAuth, (req, res) => {
  const game = LADDER_GAMES.get(Number(req.params.id));
  if (!game || game.familyId !== req.user.family_id) return res.status(404).json({ error: 'not-found' });
  if (game.status !== 'lobby') return res.status(409).json({ error: 'locked' });
  game.participants = game.participants.filter(p => p.userId !== req.user.id);
  game.lastActivityAt = Date.now();
  // 모두 떠나면 즉시 정리
  if (game.participants.length === 0 && game.status === 'lobby') {
    LADDER_GAMES.delete(game.id);
  }
  res.json(ladderSerialize(game));
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

/** UPI 0–5 → 레벨 문자열 */
function pollenUpiToLevel(v) {
  return v <= 1 ? 'good' : v === 2 ? 'normal' : v <= 4 ? 'bad' : 'worst';
}

/** Google API 의 1일치 dailyInfo 를 내부 포맷으로 매핑 */
function mapPollenDay(day) {
  const types = day.pollenTypeInfo || [];
  const plants = day.plantInfo || [];
  const maxValue = types.reduce((mx, t) => {
    const v = t.indexInfo?.value;
    return typeof v === 'number' && v > mx ? v : mx;
  }, 0);
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
  const d = day.date || {};
  const dateStr = d.year && d.month && d.day
    ? `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`
    : null;
  return {
    date: dateStr,
    maxValue,
    level: pollenUpiToLevel(maxValue),
    topPlant: plantsWithValue[0] || null,
    plants: plantsWithValue,
    types: types.map((t) => ({
      code: t.code,
      name: t.displayName,
      value: t.indexInfo?.value ?? null,
      category: t.indexInfo?.category ?? null,
    })),
  };
}

/** Google Pollen API 로 3일치 꽃가루 예보(오늘+2일) + 종별 상세 가져오기.
 *  키 미설정·호출 실패 시 null → Open-Meteo 폴백. */
async function fetchGooglePollen(lat, lon) {
  const apiKey = (process.env.GOOGLE_POLLEN_API_KEY || '').trim();
  if (!apiKey) return null;
  try {
    const url = `https://pollen.googleapis.com/v1/forecast:lookup?key=${encodeURIComponent(apiKey)}` +
      `&location.latitude=${lat}&location.longitude=${lon}&days=3&languageCode=ko`;
    const r = await fetch(url);
    if (!r.ok) {
      console.warn('[google-pollen] HTTP', r.status, await r.text().catch(() => ''));
      return null;
    }
    const j = await r.json();
    const daily = (j.dailyInfo || []).map(mapPollenDay);
    if (!daily.length) return null;
    const today = daily[0];
    return {
      pollen: today.maxValue,
      pollenLevel: today.level,
      pollenSource: 'google',
      pollenTypes: today.types,
      plants: today.plants,
      topPlant: today.topPlant,
      days: daily,
    };
  } catch (e) {
    console.warn('[google-pollen]', e.message);
    return null;
  }
}

// ---------- 고스톱 개인 상세 통계 ----------
app.get('/api/gostop/stats/:userId', requireAuth, async (req, res) => {
  try {
    const uid = Number(req.params.userId);
    if (!Number.isInteger(uid)) return res.status(400).json({ error: 'bad-id' });
    // 같은 가족 확인
    const [u] = await getPool().query(
      'SELECT id, display_name, icon, photo_url FROM users WHERE id = ? AND family_id = ? LIMIT 1',
      [uid, req.user.family_id]
    );
    if (!u.length) return res.status(404).json({ error: 'not-found' });
    const [games] = await getPool().query(
      `SELECT r.score, r.is_winner, g.player_count, g.ended_at
         FROM gostop_results r
         JOIN gostop_games g ON g.id = r.game_id
        WHERE r.user_id = ? AND g.family_id = ?
        ORDER BY g.ended_at DESC
        LIMIT 30`,
      [uid, req.user.family_id]
    );
    // 연승 계산: 최신부터 is_winner=1 연속
    let curStreak = 0;
    for (const g of games) {
      if (g.is_winner) curStreak++;
      else break;
    }
    // 최대 연승
    let maxStreak = 0, cur = 0;
    // 전체 조회 (모든 판)
    const [all] = await getPool().query(
      `SELECT r.is_winner FROM gostop_results r
         JOIN gostop_games g ON g.id = r.game_id
        WHERE r.user_id = ? AND g.family_id = ?
        ORDER BY g.ended_at ASC`,
      [uid, req.user.family_id]
    );
    for (const g of all) {
      if (g.is_winner) { cur++; if (cur > maxStreak) maxStreak = cur; }
      else cur = 0;
    }
    res.json({
      user: { id: u[0].id, name: u[0].display_name, icon: u[0].icon, photoUrl: u[0].photo_url },
      currentStreak: curStreak,
      maxStreak: maxStreak,
      recentGames: games.map((g) => ({
        score: Number(g.score) || 0,
        isWinner: !!g.is_winner,
        playerCount: g.player_count,
        endedAt: g.ended_at,
      })),
    });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

// ---------- 고스톱 가족 통계 ----------
app.get('/api/gostop/stats', requireAuth, async (req, res) => {
  try {
    // 가족 단위 집계 — 멤버별 승/총판/총점/최고점
    const [rows] = await getPool().query(
      `SELECT u.id, u.display_name, u.icon, u.photo_url,
              COALESCE(s.games, 0) AS games,
              COALESCE(s.wins, 0) AS wins,
              COALESCE(s.total_score, 0) AS total_score,
              COALESCE(s.best_score, 0) AS best_score
         FROM users u
         LEFT JOIN (
           SELECT user_id,
                  COUNT(*) AS games,
                  SUM(is_winner) AS wins,
                  SUM(score) AS total_score,
                  MAX(score) AS best_score
             FROM gostop_results r
             JOIN gostop_games g ON g.id = r.game_id
            WHERE g.family_id = ?
            GROUP BY user_id
         ) s ON s.user_id = u.id
        WHERE u.family_id = ? AND COALESCE(u.is_pet, 0) = 0
        ORDER BY wins DESC, total_score DESC, u.id ASC`,
      [req.user.family_id, req.user.family_id]
    );
    res.json(rows.map(function (r) {
      return {
        userId: r.id,
        name: r.display_name,
        icon: r.icon,
        photoUrl: r.photo_url,
        games: Number(r.games) || 0,
        wins: Number(r.wins) || 0,
        winRate: r.games ? Math.round((Number(r.wins) / Number(r.games)) * 100) : 0,
        totalScore: Number(r.total_score) || 0,
        bestScore: Number(r.best_score) || 0,
      };
    }));
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
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
      pollenDays: google ? google.days : null,
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
  const [existing] = await getPool().query(
    'SELECT 1 FROM personal_diary WHERE user_id = ? AND entry_date = ? LIMIT 1',
    [req.user.id, today]
  );
  await getPool().query(
    `INSERT INTO personal_diary (user_id, entry_date, text) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE text = VALUES(text)`,
    [req.user.id, today, text]
  );
  res.json({ ok: true, text });
  if (!existing.length) {
    notifyDiary(req.user, text).catch((e) => console.warn('[push] diary:', e.message));
  }
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

// 가족 여정: 함께한 일수·누적 기록·이번 주 참여·한 달 전 오늘 회상
app.get('/api/family/journey', requireAuth, async (req, res) => {
  try {
    const fid = req.user.family_id;
    const pool = getPool();

    const [famRows] = await pool.query(
      'SELECT display_name, created_at FROM families WHERE id = ? LIMIT 1',
      [fid]
    );
    if (!famRows.length) return res.status(404).json({ error: 'no_family' });
    const fam = famRows[0];

    const [memberRows] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM users WHERE family_id = ?',
      [fid]
    );
    const memberCount = Number(memberRows[0].cnt);

    // 누적 답변 수 (skip 제외)
    const [totalAns] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM daily_answers a
        JOIN daily_questions q ON q.id = a.question_id
       WHERE q.family_id = ? AND a.answer_text IS NOT NULL AND a.is_skip = 0`,
      [fid]
    );

    // 누적 기분 체크인
    const [totalMood] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM mood_history mh
        JOIN users u ON u.id = mh.user_id
       WHERE u.family_id = ?`,
      [fid]
    );

    // 누적 사진
    let totalPhoto = [{ cnt: 0 }];
    try {
      const [r] = await pool.query(
        'SELECT COUNT(*) AS cnt FROM gallery_photos WHERE family_id = ?',
        [fid]
      );
      totalPhoto = r;
    } catch {}

    // 누적 응원
    const [totalStk] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM family_stickers WHERE family_id = ?',
      [fid]
    );

    // 최근 30일 기분 Top 1
    const [topMood] = await pool.query(
      `SELECT mh.mood, COUNT(*) AS cnt FROM mood_history mh
        JOIN users u ON u.id = mh.user_id
       WHERE u.family_id = ? AND mh.mood_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY mh.mood ORDER BY cnt DESC LIMIT 1`,
      [fid]
    );

    // 이번 주 활동한 고유 멤버 수 (답변·기분·메모·응원 중 하나라도)
    const [activeWk] = await pool.query(
      `SELECT COUNT(DISTINCT uid) AS cnt FROM (
         SELECT a.user_id AS uid FROM daily_answers a
           JOIN daily_questions q ON q.id = a.question_id
          WHERE q.family_id = ? AND q.question_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
            AND a.answer_text IS NOT NULL AND a.is_skip = 0
         UNION
         SELECT mh.user_id FROM mood_history mh
           JOIN users u ON u.id = mh.user_id
          WHERE u.family_id = ? AND mh.mood_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
         UNION
         SELECT created_by FROM memos
          WHERE family_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND created_by IS NOT NULL
         UNION
         SELECT sender_id FROM family_stickers
          WHERE family_id = ? AND sticker_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       ) t`,
      [fid, fid, fid, fid]
    );

    // 한 달 전 오늘 질문·답변 (있으면)
    const [monthBack] = await pool.query(
      `SELECT q.id, q.question_text, q.question_date,
              (SELECT COUNT(*) FROM daily_answers a
                WHERE a.question_id = q.id AND a.answer_text IS NOT NULL AND a.is_skip = 0) AS answered
         FROM daily_questions q
        WHERE q.family_id = ? AND q.question_date = DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        LIMIT 1`,
      [fid]
    );

    // 1년 전 오늘 질문·답변 (있으면, 가능한 오래된 가족만 데이터 있음)
    const [yearBack] = await pool.query(
      `SELECT q.id, q.question_text, q.question_date,
              (SELECT COUNT(*) FROM daily_answers a
                WHERE a.question_id = q.id AND a.answer_text IS NOT NULL AND a.is_skip = 0) AS answered
         FROM daily_questions q
        WHERE q.family_id = ? AND q.question_date = DATE_SUB(CURDATE(), INTERVAL 365 DAY)
        LIMIT 1`,
      [fid]
    );

    const createdAt = fam.created_at;
    const daysTogether = Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000) + 1);

    // 마일스톤: 가까운 미래의 "함께한 N일" 기록
    const NEXT_MS = [7, 30, 100, 180, 365, 730, 1000, 1825, 3650];
    const nextMilestone = NEXT_MS.find((n) => n >= daysTogether) || null;

    res.json({
      familyName: fam.display_name,
      createdAt,
      daysTogether,
      memberCount,
      weeklyActive: Number(activeWk[0]?.cnt || 0),
      totals: {
        answers: Number(totalAns[0]?.cnt || 0),
        moods:   Number(totalMood[0]?.cnt || 0),
        photos:  Number(totalPhoto[0]?.cnt || 0),
        stickers: Number(totalStk[0]?.cnt || 0),
      },
      topMood30d: topMood[0] ? { mood: topMood[0].mood, count: Number(topMood[0].cnt) } : null,
      monthAgo: monthBack[0] ? { question: monthBack[0].question_text, answered: Number(monthBack[0].answered), date: monthBack[0].question_date } : null,
      yearAgo:  yearBack[0]  ? { question: yearBack[0].question_text,  answered: Number(yearBack[0].answered),  date: yearBack[0].question_date }  : null,
      nextMilestone,
      firsts: await computeFamilyFirsts(pool, fid),
    });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

// 가족 "첫 순간들" — 첫 기분/답변/사진/응원/메모 (각각 날짜 + 주인공)
async function computeFamilyFirsts(pool, fid) {
  const out = {};
  try {
    const [r] = await pool.query(
      `SELECT mh.mood_date AS d, u.display_name AS name, mh.mood AS mood
         FROM mood_history mh JOIN users u ON u.id = mh.user_id
        WHERE u.family_id = ? ORDER BY mh.mood_date ASC, mh.id ASC LIMIT 1`,
      [fid]
    );
    if (r.length) out.firstMood = {
      date: new Intl.DateTimeFormat('sv-SE', { year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date(r[0].d)),
      name: r[0].name,
      mood: r[0].mood,
    };
  } catch {}
  try {
    const [r] = await pool.query(
      `SELECT q.question_date AS d, u.display_name AS name
         FROM daily_answers a
         JOIN daily_questions q ON q.id = a.question_id
         JOIN users u ON u.id = a.user_id
        WHERE q.family_id = ? AND a.answer_text IS NOT NULL AND a.is_skip = 0
        ORDER BY q.question_date ASC, a.created_at ASC LIMIT 1`,
      [fid]
    );
    if (r.length) out.firstAnswer = {
      date: new Intl.DateTimeFormat('sv-SE', { year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date(r[0].d)),
      name: r[0].name,
    };
  } catch {}
  try {
    const [r] = await pool.query(
      `SELECT g.created_at AS d, u.display_name AS name
         FROM gallery_photos g LEFT JOIN users u ON u.id = g.uploader_id
        WHERE g.family_id = ? ORDER BY g.created_at ASC LIMIT 1`,
      [fid]
    );
    if (r.length) out.firstPhoto = {
      date: new Intl.DateTimeFormat('sv-SE', { year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date(r[0].d)),
      name: r[0].name || null,
    };
  } catch {}
  try {
    const [r] = await pool.query(
      `SELECT s.sticker_date AS d, u.display_name AS name, s.emoji
         FROM family_stickers s JOIN users u ON u.id = s.sender_id
        WHERE s.family_id = ? ORDER BY s.sticker_date ASC, s.id ASC LIMIT 1`,
      [fid]
    );
    if (r.length) out.firstSticker = {
      date: new Intl.DateTimeFormat('sv-SE', { year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date(r[0].d)),
      name: r[0].name,
      emoji: r[0].emoji,
    };
  } catch {}
  return out;
}

// 가족 전원의 최근 7일 기분 그리드 (개선안 §2.3 감정 자산 시각화)
app.get('/api/family/mood-week', requireAuth, async (req, res) => {
  try {
    const fid = req.user.family_id;
    const pool = getPool();
    const tz = process.env.DEFAULT_TZ || 'Asia/Tokyo';
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());

    const [members] = await pool.query(
      `SELECT id, display_name, icon, photo_url, role
         FROM users WHERE family_id = ?
        ORDER BY role DESC, id ASC`,
      [fid]
    );
    if (!members.length) return res.json({ start: today, days: [], members: [] });

    const ids = members.map((m) => m.id);

    const [rows] = await pool.query(
      `SELECT user_id, DATE_FORMAT(mood_date, '%Y-%m-%d') AS d, mood, comment
         FROM mood_history
        WHERE user_id IN (?)
          AND mood_date >= DATE_SUB(?, INTERVAL 6 DAY)
          AND mood_date <= ?`,
      [ids, today, today]
    );
    const map = new Map(); // "uid|date" → {mood, comment}
    for (const r of rows) map.set(`${r.user_id}|${r.d}`, { mood: r.mood, comment: r.comment });

    // 날짜 라인 생성 (오래된 → 오늘 방향)
    const days = [];
    const base = new Date(today + 'T00:00:00');
    for (let i = 6; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      days.push({
        date: iso,
        dow: d.getDay(),
        day: d.getDate(),
        isToday: iso === today,
      });
    }

    const outMembers = members.map((m) => ({
      id: m.id,
      displayName: m.display_name,
      icon: m.icon,
      photoUrl: m.photo_url || null,
      days: days.map((d) => {
        const k = `${m.id}|${d.date}`;
        const e = map.get(k);
        return { date: d.date, mood: e?.mood || null, comment: e?.comment || null };
      }),
    }));

    res.json({ today, days, members: outMembers });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

// 가족 멤버별 오늘 참여 여부 (기분·질문답변·메모·응원 보내기)
app.get('/api/family/today-status', requireAuth, async (req, res) => {
  try {
    const fid = req.user.family_id;
    const pool = getPool();
    const tz = process.env.DEFAULT_TZ || 'Asia/Tokyo';
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());

    const [members] = await pool.query(
      'SELECT id FROM users WHERE family_id = ?',
      [fid]
    );
    const ids = members.map((m) => m.id);
    if (!ids.length) return res.json({ date: today, byUser: {} });

    const [moodRows] = await pool.query(
      'SELECT DISTINCT user_id FROM mood_history WHERE mood_date = ? AND user_id IN (?)',
      [today, ids]
    );
    const [answerRows] = await pool.query(
      `SELECT DISTINCT a.user_id FROM daily_answers a
         JOIN daily_questions q ON q.id = a.question_id
        WHERE q.question_date = ? AND q.family_id = ?
          AND a.answer_text IS NOT NULL AND a.is_skip = 0
          AND a.user_id IN (?)`,
      [today, fid, ids]
    );
    const [memoRows] = await pool.query(
      `SELECT DISTINCT created_by AS user_id FROM memos
        WHERE family_id = ? AND DATE(created_at) = ? AND created_by IN (?)`,
      [fid, today, ids]
    );
    const [stickerRows] = await pool.query(
      'SELECT DISTINCT sender_id AS user_id FROM family_stickers WHERE family_id = ? AND sticker_date = ? AND sender_id IN (?)',
      [fid, today, ids]
    );

    const moodSet    = new Set(moodRows.map((r) => r.user_id));
    const answerSet  = new Set(answerRows.map((r) => r.user_id));
    const memoSet    = new Set(memoRows.map((r) => r.user_id));
    const stickerSet = new Set(stickerRows.map((r) => r.user_id));

    const byUser = {};
    for (const m of members) {
      byUser[m.id] = {
        mood:    moodSet.has(m.id),
        answered: answerSet.has(m.id),
        memo:    memoSet.has(m.id),
        sticker: stickerSet.has(m.id),
      };
    }
    res.json({ date: today, byUser });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

// 응원 넛지 — 오늘 조용한 가족 한 명을 추천 (자기 자신 제외)
app.get('/api/family/nudge', requireAuth, async (req, res) => {
  try {
    const fid = req.user.family_id;
    const myId = req.user.id;
    const tz = process.env.DEFAULT_TZ || 'Asia/Tokyo';
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());

    // 가족 멤버 중 오늘 활동이 전혀 없는 사람 찾기 (pet 제외, 본인 제외)
    // 활동 = 기분·답변·메모·응원 보내기 중 하나라도
    const [rows] = await getPool().query(
      `SELECT u.id, u.display_name, u.icon, u.photo_url,
              (SELECT MAX(mh.mood_date) FROM mood_history mh WHERE mh.user_id = u.id) AS last_mood,
              (SELECT MAX(q.question_date) FROM daily_answers a
                 JOIN daily_questions q ON q.id = a.question_id
                WHERE a.user_id = u.id AND a.answer_text IS NOT NULL AND a.is_skip = 0) AS last_answer
         FROM users u
        WHERE u.family_id = ?
          AND u.id != ?
          AND COALESCE(u.is_pet,0) = 0
          AND NOT EXISTS (
                SELECT 1 FROM mood_history mh WHERE mh.user_id = u.id AND mh.mood_date = ?
              )
          AND NOT EXISTS (
                SELECT 1 FROM daily_answers a JOIN daily_questions q ON q.id = a.question_id
                 WHERE a.user_id = u.id AND q.question_date = ?
                   AND a.answer_text IS NOT NULL AND a.is_skip = 0
              )
          AND NOT EXISTS (
                SELECT 1 FROM memos m WHERE m.created_by = u.id
                   AND DATE(m.created_at) = ?
              )
          AND NOT EXISTS (
                SELECT 1 FROM family_stickers s WHERE s.sender_id = u.id
                   AND s.sticker_date = ?
              )
        ORDER BY
          /* 오래 조용한 사람 우선: last_mood/last_answer 최대값이 가장 작은 쪽 */
          GREATEST(COALESCE(last_mood, '1970-01-01'), COALESCE(last_answer, '1970-01-01')) ASC,
          u.id ASC
        LIMIT 1`,
      [fid, myId, today, today, today, today]
    );

    // 내가 오늘 이미 응원을 보낸 대상은 제외
    let pick = rows[0] || null;
    if (pick) {
      const [sent] = await getPool().query(
        `SELECT 1 FROM family_stickers WHERE sender_id = ? AND receiver_id = ? AND sticker_date = ? LIMIT 1`,
        [myId, pick.id, today]
      );
      if (sent.length) pick = null;
    }

    if (!pick) return res.json({ target: null });

    const last = pick.last_mood || pick.last_answer || null;
    let hint = `${pick.display_name}님은 오늘 아직 조용하세요`;
    if (last) {
      const days = Math.max(0, Math.floor((new Date(today) - new Date(last)) / 86400000));
      if (days >= 3) hint = `${pick.display_name}님을 ${days}일 동안 못 들었어요`;
    } else {
      hint = `${pick.display_name}님에게 첫 응원을 보내보세요`;
    }

    res.json({
      target: {
        id: pick.id,
        displayName: pick.display_name,
        icon: pick.icon,
        photoUrl: pick.photo_url || null,
      },
      reason: 'quiet_today',
      hint,
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
const PET_FORTUNE = [
  '오늘은 간식을 평소보다 한 입 더 받게 될 거예요',
  '지나가는 새를 많이 보게 되는 행운이 생길지도',
  '햇살 좋은 자리에서 낮잠 자기 좋은 날',
  '주인이 평소보다 한 번 더 안아 줄 거예요',
  '산책길에 새로운 친구를 만날 수도 있어요',
  '좋아하는 장난감이 다시 눈에 띄는 날',
  '식사 시간이 아주 행복한 하루',
  '꼬리를 흔들 일이 많은 하루',
  '낯선 소리에도 평소보다 의젓해지는 날',
  '낮잠이 유난히 달콤한 하루',
  '익숙한 가족 냄새가 가장 큰 위로가 돼요',
  '평소보다 더 많이 쓰다듬어 주실 거예요',
  '간식 주머니가 오늘은 좀 후할지도 몰라요',
  '뛰어놀고 싶은 에너지가 솟는 하루',
  '귀여움을 한껏 발휘하면 좋은 일이 생겨요',
];

// 각 항목: { g: 등급, t: 운세 텍스트 }
// 등급 분포(21개): 대길×2 중길×5 소길×7 평×4 주의×3
const FORTUNE = {
  '쥐': [
    {g:'대길',t:'꼼꼼한 눈썰미가 큰 행운을 낚아채는 날! 오랫동안 기다리던 일이 오늘 풀릴 수 있어요. 적극적으로 나서보세요.'},
    {g:'대길',t:'재물운과 인복이 동시에 활짝 열리는 하루. 뜻밖의 곳에서 반가운 소식이 날아올 수 있으니 연락처를 확인해 두세요.'},
    {g:'중길',t:'작은 정보 하나가 오늘 큰 도움이 될 거예요. 주변의 이야기를 귀 기울여 들으면 뜻밖의 힌트를 얻을 수 있어요.'},
    {g:'중길',t:'돈 관리에 좋은 흐름이에요. 오늘 작은 지출이라도 기록해 두면 연말에 뿌듯한 결과가 기다리고 있을 거예요.'},
    {g:'중길',t:'새로운 시도가 예상보다 재미있는 결과를 가져올 날이에요. 망설이지 말고 첫걸음을 내딛어 보세요.'},
    {g:'중길',t:'기분 좋은 소식이 오늘 하루 안에 찾아올 거예요. 스마트폰을 자주 확인해 두면 좋겠어요.'},
    {g:'중길',t:'사람들 사이에서 당신의 꼼꼼함이 빛을 발하는 날이에요. 주변이 자연스럽게 당신에게 의지하게 될 거예요.'},
    {g:'소길',t:'가족과 나누는 짧은 대화 한 마디가 하루의 기분을 한껏 올려줄 거예요. 먼저 안부 메시지를 보내 보세요.'},
    {g:'소길',t:'서두르지 않고 차근차근 접근하면 의외로 좋은 결과가 나와요. 오늘은 속도보다 방향이 중요한 날이에요.'},
    {g:'소길',t:'작지만 확실한 행운이 하루를 포근하게 감싸줄 거예요. 기대하지 않은 곳에서 작은 선물이 올 수도 있어요.'},
    {g:'소길',t:'오늘 건넨 친절한 말 한마디가 새로운 인연의 씨앗이 될 수 있어요. 상대방의 이름을 불러주는 것만으로도 관계가 따뜻해져요.'},
    {g:'소길',t:'꼼꼼함이 빛나는 하루예요. 지금 하고 있는 일에 집중하면 깔끔한 마무리가 가능해요.'},
    {g:'소길',t:'지출은 조금 줄이고 저축은 조금 늘리면 딱 좋은 날이에요. 작은 절약이 큰 여유를 만들어요.'},
    {g:'소길',t:'오랜 친구나 지인에게 먼저 연락해 보세요. 뜻밖에 좋은 정보나 즐거운 약속이 생길 수 있어요.'},
    {g:'평',  t:'조용히 자신의 페이스를 유지하는 것이 오늘의 정답이에요. 특별한 무언가를 억지로 만들려 하지 않아도 돼요.'},
    {g:'평',  t:'평범해 보이지만 알고 보면 안정적인 흐름이에요. 쌓아온 것들이 조용히 자리를 잡고 있는 중이에요.'},
    {g:'평',  t:'오늘은 에너지를 보충하는 날로 삼으면 좋겠어요. 좋아하는 음식을 먹거나 잠깐 낮잠을 자보세요.'},
    {g:'평',  t:'새로운 것을 시작하기보다 기존의 것을 정리하고 점검하기 좋은 날이에요.'},
    {g:'주의',t:'오늘은 중요한 결정보다 정보 수집에 집중하세요. 섣부른 판단이 나중에 발목을 잡을 수 있어요.'},
    {g:'주의',t:'충동적인 소비나 결정은 오늘 하루만큼은 잠시 미루는 게 좋겠어요. 내일 다시 생각해도 늦지 않아요.'},
    {g:'주의',t:'에너지가 분산될 수 있는 날이에요. 한 가지 일에 집중하고, 여러 일을 동시에 벌이는 것은 자제하세요.'},
  ],
  '소': [
    {g:'대길',t:'묵묵히 쌓아온 노력이 오늘 드디어 빛을 발하는 날! 주변 사람들의 응원과 칭찬이 쏟아질 거예요. 자신을 믿고 당당하게 나서세요.'},
    {g:'대길',t:'예상치 못한 곳에서 기쁜 소식이 찾아오는 특별한 하루예요. 오늘 받는 연락이나 만남이 삶에 좋은 변화를 가져다줄 수 있어요.'},
    {g:'중길',t:'한 걸음씩 묵직하게 나아가는 힘이 오늘 특히 잘 통하는 날이에요. 꾸준함이 가장 강력한 무기라는 걸 오늘 다시 느끼게 될 거예요.'},
    {g:'중길',t:'든든한 한 끼 식사가 마음까지 풍족하게 채워주는 날이에요. 좋아하는 음식을 여유 있게 즐겨보세요.'},
    {g:'중길',t:'오래 연락 못 한 친구에게 먼저 손을 내밀어 보세요. 반가운 재회가 새로운 에너지를 불어넣어 줄 거예요.'},
    {g:'중길',t:'성실한 모습이 오늘따라 주변 사람들의 눈에 잘 띄는 날이에요. 평소처럼 최선을 다하는 것만으로 충분해요.'},
    {g:'중길',t:'계획한 일들이 예상 시간 안에 잘 마무리되는 날이에요. 효율적인 하루가 될 거예요.'},
    {g:'소길',t:'무리하지 않고 나를 돌보는 하루를 보내도 괜찮아요. 오늘 쉬는 것이 내일의 더 큰 활력이 돼요.'},
    {g:'소길',t:'작은 성취를 이뤄낼 때마다 스스로 칭찬해 주세요. 그 기쁨이 쌓이면 더 큰 복이 되어 돌아와요.'},
    {g:'소길',t:'가족이 건네는 따뜻한 말 한마디가 오늘 특히 힘이 되는 날이에요. 먼저 다가가 마음을 나눠보세요.'},
    {g:'소길',t:'마음속에 쌓인 것을 내려놓으면 몸이 가벼워지는 날이에요. 잠깐 산책하거나 깊게 숨을 쉬어보세요.'},
    {g:'소길',t:'소소한 집안일이나 정리정돈이 의외로 큰 만족감을 주는 날이에요. 깨끗해진 공간이 마음까지 정리시켜줘요.'},
    {g:'소길',t:'지금 하고 있는 일이 느리게 느껴지더라도 멈추지 마세요. 소의 걸음은 느려도 결국 목적지에 가장 먼저 도착해요.'},
    {g:'소길',t:'오늘 먹는 것에 조금 더 신경 써보세요. 균형 잡힌 식사가 체력과 기분을 동시에 끌어올려 줄 거예요.'},
    {g:'평',  t:'변화보다 안정을 선택하는 게 오늘의 현명한 선택이에요. 지금 자리에서 충실히 하루를 보내면 그걸로 충분해요.'},
    {g:'평',  t:'천천히 지금 이 순간을 즐기는 하루예요. 무언가 서두를 필요가 없어요.'},
    {g:'평',  t:'특별한 이벤트 없이 조용한 하루지만, 이런 평온한 날이 사실 가장 소중한 날이에요.'},
    {g:'평',  t:'오늘은 일보다 휴식에 점수를 주는 날이에요. 적당히 쉬고 내일을 위해 에너지를 아껴두세요.'},
    {g:'주의',t:'무리한 계획이나 과도한 목표는 오늘만큼은 잠시 접어두세요. 현실적인 일에 집중하면 훨씬 잘 풀려요.'},
    {g:'주의',t:'에너지가 예상보다 많이 소모되는 날이에요. 불필요한 약속이나 만남은 줄이고 충분히 쉬세요.'},
    {g:'주의',t:'누군가의 부탁을 거절하기 어려운 날이에요. 하지만 무리한 부탁은 정중히 거절하는 것이 서로에게 좋아요.'},
  ],
  '호랑이': [
    {g:'대길',t:'당당한 기운이 오늘 주변 모든 것을 이끄는 날! 두려움 없이 앞장서면 사람들이 자연스럽게 따라와요. 오늘만큼은 크게 도전해 보세요.'},
    {g:'대길',t:'용기 있는 행동 하나가 큰 행운의 문을 열어주는 날이에요. 망설이던 그 일, 오늘이 바로 시작하기에 최고의 타이밍이에요.'},
    {g:'중길',t:'도전하는 마음이 예상보다 좋은 결과를 만들어 내는 날이에요. 실패를 두려워하기보다 배움의 기회로 삼으면 더 멀리 가요.'},
    {g:'중길',t:'말보다 행동이 더 잘 통하는 날이에요. 설명하는 것보다 직접 보여주는 게 훨씬 효과적이에요.'},
    {g:'중길',t:'자신감 있는 태도가 주변에 좋은 기운을 전파하는 날이에요. 당신의 열정이 주변 사람들에게도 불꽃을 지펴줄 거예요.'},
    {g:'중길',t:'가족이나 가까운 사람들의 응원이 오늘 특히 날개를 달아줄 거예요. 소중한 사람들에게 감사함을 전해보세요.'},
    {g:'중길',t:'오늘은 리더십이 빛나는 날이에요. 팀이나 모임에서 먼저 의견을 제시하면 좋은 반응을 얻을 거예요.'},
    {g:'소길',t:'가벼운 산책이나 운동이 오늘 컨디션을 확 살려줄 거예요. 몸을 움직일수록 아이디어도 활발해져요.'},
    {g:'소길',t:'활력 넘치는 하루가 기다리고 있어요. 오늘은 특히 무언가를 시작하기 좋은 에너지가 있어요.'},
    {g:'소길',t:'진심 어린 말 한마디가 관계를 한층 더 깊고 따뜻하게 만들어 줄 거예요. 생각보다 빨리 마음이 통할 거예요.'},
    {g:'소길',t:'오늘 겪는 경험이 나중에 소중한 자산이 될 거예요. 어떤 상황이든 배울 점을 찾아보는 시각을 가져보세요.'},
    {g:'소길',t:'부지런히 움직인 만큼 저녁에는 뿌듯한 성취감이 기다리고 있을 거예요.'},
    {g:'소길',t:'오늘은 계획대로 움직이면 예상보다 빠르게 일이 마무리돼요. 아침에 할 일 목록을 먼저 정리해 보세요.'},
    {g:'소길',t:'건강한 식사와 충분한 수분 섭취가 오늘 에너지의 핵심이에요. 몸이 좋아야 마음도 좋아요.'},
    {g:'평',  t:'욕심을 조금 내려놓으면 마음이 한결 평화로워지는 날이에요. 지금 있는 것들에 잠시 감사해 보세요.'},
    {g:'평',  t:'쉬어가는 것도 앞으로 나아가는 힘의 일부예요. 오늘은 재충전의 날로 삼는 것이 현명해요.'},
    {g:'평',  t:'잠시 멈추고 지금까지의 여정을 돌아보면 의외로 많은 것을 이뤄왔다는 걸 발견할 거예요.'},
    {g:'평',  t:'급하게 결정할 일이 있다면 내일로 미루는 것도 괜찮아요. 호랑이도 한 번쯤은 쉬어가요.'},
    {g:'주의',t:'충동적인 행동은 오늘만큼은 한 박자 쉬고 결정하세요. 순간의 감정이 나중에 후회가 될 수 있어요.'},
    {g:'주의',t:'무리한 승부나 경쟁보다 안전하고 안정적인 선택이 오늘은 더 좋은 결과를 가져와요.'},
    {g:'주의',t:'고집을 내려놓고 상대방의 의견도 들어보는 자세가 필요한 날이에요. 유연함이 오늘의 강점이 돼요.'},
  ],
  '토끼': [
    {g:'대길',t:'부드럽고 따뜻한 기운이 모든 것을 순조롭게 만드는 날! 인간관계에서 큰 기쁨이 찾아올 거예요. 당신의 매력이 오늘 최고로 빛나요.'},
    {g:'대길',t:'좋은 인연과 행운이 동시에 달려오는 최고의 날이에요. 새로운 만남이나 오래된 인연이 삶에 반짝이는 변화를 가져다줄 거예요.'},
    {g:'중길',t:'주변을 세심하게 보살피는 마음이 오늘 복이 되어 돌아올 거예요. 작은 친절이 큰 인연으로 이어질 수 있어요.'},
    {g:'중길',t:'따뜻한 차 한 잔처럼 기분 좋게 흘러가는 하루예요. 서두르지 않아도 해야 할 일이 자연스럽게 마무리돼요.'},
    {g:'중길',t:'가벼운 스트레칭이나 산책이 기분을 환하게 밝혀줄 거예요. 몸을 풀면 마음도 가벼워지는 날이에요.'},
    {g:'중길',t:'기분 좋은 소식이 하루 중 불쑥 찾아올 거예요. 작은 것에도 감사하는 마음이 복을 더 불러요.'},
    {g:'중길',t:'감수성이 풍부해지는 날이에요. 글이나 그림, 음악 같은 창의적인 활동이 오늘 특히 잘 풀릴 거예요.'},
    {g:'소길',t:'작은 행운이 하루 곳곳에 숨어 있는 날이에요. 자세히 들여다보면 일상에서 발견하는 작은 기쁨들이 많아요.'},
    {g:'소길',t:'오늘 베풀면 더 크게 돌아오는 날이에요. 작은 나눔이 인연을 깊게 만들고 기분도 좋게 해줘요.'},
    {g:'소길',t:'예술적 감각이 평소보다 예리하게 살아있는 날이에요. 뭔가를 만들거나 꾸미는 일이 잘 풀릴 거예요.'},
    {g:'소길',t:'상상하던 일이 조금씩 현실에 가까워지는 느낌이 드는 날이에요. 꾸준히 나아가면 반드시 이뤄져요.'},
    {g:'소길',t:'조용한 환경에서 집중하면 평소보다 더 좋은 결과가 나와요. 혼자만의 시간을 충분히 활용해 보세요.'},
    {g:'소길',t:'누군가의 이야기를 진심으로 들어주는 것만으로도 오늘은 충분한 하루예요. 공감의 힘이 빛나는 날이에요.'},
    {g:'소길',t:'오늘 먹는 것 하나하나가 특별하게 맛있게 느껴질 거예요. 천천히 음미하며 먹으면 더 행복해요.'},
    {g:'평',  t:'쉼표가 필요한 날이에요. 억지로 뭔가를 하려 하지 말고, 오늘은 그냥 있는 그대로 쉬어도 좋아요.'},
    {g:'평',  t:'흐름에 맡겨두면 자연스럽게 풀리는 날이에요. 과도하게 계획하거나 조급해하지 않아도 돼요.'},
    {g:'평',  t:'지금 있는 자리가 사실 꽤 괜찮은 자리예요. 비교보다 자기 자신에게 집중하는 날이에요.'},
    {g:'평',  t:'소소한 일상을 즐기는 것이 오늘의 가장 좋은 선택이에요. 크지 않아도 행복한 하루가 될 거예요.'},
    {g:'주의',t:'감정 기복이 커질 수 있는 날이에요. 중요한 결정은 마음이 안정된 뒤로 미루는 게 좋겠어요.'},
    {g:'주의',t:'오늘은 무리한 약속보다 내 시간과 에너지를 먼저 챙기세요. 거절도 배려의 한 형태예요.'},
    {g:'주의',t:'사람들 사이에서 오해가 생기기 쉬운 날이에요. 말보다 글로 남기고, 확인하는 습관을 들여보세요.'},
  ],
  '용': [
    {g:'대길',t:'하늘이 직접 돕는 날! 크게 생각하고 크게 행동하면 그만큼 큰 결과가 따라와요. 오늘 시작하는 일은 반드시 빛날 거예요.'},
    {g:'대길',t:'운이 폭발적으로 상승하는 하루예요. 오랫동안 준비해 온 중요한 일을 오늘 시작하거나 결정하면 큰 성과가 기다려요.'},
    {g:'중길',t:'지금 타고 있는 흐름이 예상보다 강하고 좋아요. 멈추지 말고 계속 나아가면 더 좋은 것들이 따라올 거예요.'},
    {g:'중길',t:'하고자 하는 일에 강한 추진력이 생기는 날이에요. 망설임 없이 실행에 옮기면 예상을 넘어서는 결과가 나올 거예요.'},
    {g:'중길',t:'예상치 못한 곳에서 도움의 손길이 뻗어오는 날이에요. 혼자 해결하려 하지 말고 주변 사람들을 믿어보세요.'},
    {g:'중길',t:'마음속에 품어온 꿈이 한층 더 선명하게 그려지는 날이에요. 구체적인 계획을 세워보면 현실이 조금 더 가까워질 거예요.'},
    {g:'중길',t:'리더로서의 기질이 빛나는 날이에요. 무리를 이끄는 역할이 어울리고, 사람들도 당신을 신뢰해요.'},
    {g:'소길',t:'건강 상태를 한 번 점검해 보면 좋은 날이에요. 좋은 컨디션이 유지될수록 하고 싶은 일도 잘 풀려요.'},
    {g:'소길',t:'마음이 넉넉하고 여유로운 하루예요. 주변 사람들에게 여유를 나눠주면 더 좋은 기운이 돌아올 거예요.'},
    {g:'소길',t:'가족과 나누는 대화에서 의외의 힘과 위안을 얻게 되는 날이에요. 저녁에 함께 시간을 보내보세요.'},
    {g:'소길',t:'평소보다 집중력이 높아지는 날이에요. 오랫동안 미뤄두었던 일을 처리하기 딱 좋은 타이밍이에요.'},
    {g:'소길',t:'작은 목표를 세우고 달성하는 반복이 오늘 큰 만족감을 줄 거예요. 체크리스트를 활용해 보세요.'},
    {g:'소길',t:'뭔가를 배우거나 새로운 정보를 습득하기 좋은 날이에요. 호기심이 생기는 것을 적극적으로 탐구해 보세요.'},
    {g:'소길',t:'창의적인 아이디어가 자연스럽게 떠오르는 날이에요. 메모해 두면 나중에 큰 도움이 될 거예요.'},
    {g:'평',  t:'기분 전환이 필요한 날이에요. 익숙한 루틴에서 조금 벗어나 가볍게 변화를 줘보면 좋겠어요.'},
    {g:'평',  t:'오늘은 쉬면서 에너지를 비축하는 날로 삼는 게 좋아요. 내일의 큰 도약을 위한 충전이에요.'},
    {g:'평',  t:'거창한 계획보다 오늘 할 수 있는 작은 한 가지에 집중해 보세요. 완성의 쾌감이 의욕을 끌어올려 줘요.'},
    {g:'평',  t:'오늘 하루는 조용히 자신을 돌아보는 시간으로 보내도 충분해요.'},
    {g:'주의',t:'자만은 금물이에요. 겸손한 태도를 유지하면 오히려 더 큰 기회가 따라올 거예요.'},
    {g:'주의',t:'서두르면 실수가 생길 수 있는 날이에요. 하나하나 확인하면서 진행하는 습관이 오늘 빛을 발해요.'},
    {g:'주의',t:'무리한 욕심이 오히려 일을 복잡하게 만들 수 있어요. 한 번에 하나씩, 차례대로 처리해 보세요.'},
  ],
  '뱀': [
    {g:'대길',t:'예리한 직감이 활짝 깨어나는 날! 평소에 스쳐 지나치던 기회를 오늘은 정확히 잡아낼 수 있어요. 육감을 믿고 과감히 행동해 보세요.'},
    {g:'대길',t:'깊은 지혜가 큰 행운으로 연결되는 최고의 하루예요. 오랫동안 고민하던 문제가 오늘 드디어 풀릴 실마리를 찾게 될 거예요.'},
    {g:'중길',t:'평소에 갈고닦아 온 감각이 오늘 정확하게 들어맞는 날이에요. 직관을 따라가면 좋은 결과가 기다려요.'},
    {g:'중길',t:'머릿속을 가득 채운 생각들을 정리하기 아주 좋은 날이에요. 종이에 써보면 의외로 빠르게 정리가 돼요.'},
    {g:'중길',t:'논리적이고 지혜로운 판단이 주변 사람들의 신뢰를 얻는 날이에요. 당신의 의견이 오늘 큰 영향력을 발휘해요.'},
    {g:'중길',t:'가까운 사람과 천천히 대화를 나누는 시간이 기다리고 있어요. 깊이 있는 이야기가 관계를 더욱 탄탄하게 해줄 거예요.'},
    {g:'중길',t:'책이나 영상을 통해 새로운 지식을 흡수하기 좋은 날이에요. 습득한 정보가 곧 실질적인 도움이 될 거예요.'},
    {g:'소길',t:'작지만 반가운 소식 하나가 기분을 한층 밝게 만들어 줄 거예요. 작은 것도 소중히 여기는 마음이 복을 불러요.'},
    {g:'소길',t:'오늘은 서두를 필요가 없어요. 여유 있는 페이스로 움직이면 오히려 더 많은 것을 이루게 될 거예요.'},
    {g:'소길',t:'직관이 잘 맞는 날이니 첫 느낌을 믿어보세요. 너무 많이 분석하면 오히려 길을 잃을 수 있어요.'},
    {g:'소길',t:'혼자만의 조용한 시간이 창의적인 아이디어를 키워주는 날이에요. 방해받지 않는 환경을 만들어 보세요.'},
    {g:'소길',t:'세밀한 것에 주의를 기울이면 다른 사람이 놓친 것을 발견하게 되는 날이에요. 꼼꼼함이 강점이에요.'},
    {g:'소길',t:'오늘은 말보다 관찰이 더 많은 것을 알려줄 거예요. 주변을 주의 깊게 살펴보세요.'},
    {g:'소길',t:'좋아하는 것에 집중하는 시간이 스트레스를 풀어주고 새로운 영감을 가져다줄 거예요.'},
    {g:'평',  t:'몸과 마음의 충전이 필요한 날이에요. 무리하지 않고 오늘은 편안하게 보내는 것이 현명해요.'},
    {g:'평',  t:'지금 있는 자리에서 충실하게 하루를 보내는 것으로 충분한 날이에요.'},
    {g:'평',  t:'새로운 것을 시작하기보다 기존의 계획을 차분히 실행하는 데 집중하는 날이에요.'},
    {g:'평',  t:'오늘은 에너지를 아끼며 내일을 위한 준비를 하는 날로 삼으면 좋겠어요.'},
    {g:'주의',t:'말을 아끼고 신중하게 행동하는 것이 오늘 특히 중요해요. 침묵이 때로는 가장 강력한 대답이에요.'},
    {g:'주의',t:'오해가 생기기 쉬운 날이에요. 중요한 내용은 다시 한번 확인하고, 소통을 명확히 해두세요.'},
    {g:'주의',t:'지나치게 의심하거나 분석하면 기회를 놓칠 수 있어요. 어느 정도는 상대방을 믿고 나아가 보세요.'},
  ],
  '말': [
    {g:'대길',t:'활력이 폭발적으로 솟구치는 날! 달리면 달릴수록 행운이 뒤따라와요. 오늘은 망설임 없이 앞으로 질주해 보세요.'},
    {g:'대길',t:'에너지와 행운이 동시에 넘치는 역대급 하루예요. 중요한 만남이나 발표, 도전을 오늘로 잡았다면 최고의 선택이에요.'},
    {g:'중길',t:'움직이면 움직일수록 좋은 에너지가 샘솟는 날이에요. 가만히 있는 것보다 몸을 쓰는 게 훨씬 좋은 결과를 만들어요.'},
    {g:'중길',t:'반가운 새 소식이 기쁨을 가져다주는 날이에요. 오늘 받은 정보나 연락이 좋은 방향으로 이어질 거예요.'},
    {g:'중길',t:'친구나 지인과의 만남이 즐겁고 유익한 날이에요. 가벼운 약속이라도 기꺼이 응해보세요.'},
    {g:'중길',t:'기분 좋은 산책이나 외출이 하루 전체의 분위기를 바꿔줄 거예요. 바깥 공기가 머리를 맑게 해줄 거예요.'},
    {g:'중길',t:'적극적으로 자신의 의견을 표현하면 좋은 반응을 얻는 날이에요. 오늘만큼은 눈치 보지 말고 말해보세요.'},
    {g:'소길',t:'적당히 활동하고 적당히 쉬는 밸런스가 오늘의 핵심이에요. 과하지 않게 즐기는 하루가 될 거예요.'},
    {g:'소길',t:'가벼운 마음으로 시작하면 예상보다 잘 풀리는 날이에요. 무겁게 생각하지 말고 일단 해봐요.'},
    {g:'소길',t:'작은 변화 하나가 기분을 상쾌하게 바꿔주는 날이에요. 헤어스타일을 바꾸거나 새 옷을 입어보는 것도 좋아요.'},
    {g:'소길',t:'오늘 새롭게 만나는 사람이 뜻밖의 귀인이 될 수 있어요. 낯선 사람에게도 밝게 인사해 보세요.'},
    {g:'소길',t:'음악을 들으며 하루를 시작하면 기분이 몇 배 좋아지는 날이에요. 좋아하는 노래를 틀어보세요.'},
    {g:'소길',t:'계획한 일과 즉흥적인 즐거움을 적절히 섞으면 완벽한 하루가 될 거예요.'},
    {g:'소길',t:'몸이 원하는 것을 들어주는 날이에요. 피곤하면 쉬고, 배고프면 잘 먹고, 가고 싶으면 가세요.'},
    {g:'평',  t:'달리던 속도를 조금 줄이고 주변을 둘러보는 날이에요. 지나친 것들을 가볍게 비우면 좋겠어요.'},
    {g:'평',  t:'무리하지 않아도 충분한 하루예요. 오늘은 그냥 있는 것만으로도 충분히 잘 하고 있는 거예요.'},
    {g:'평',  t:'주변 소음에서 벗어나 조용히 자신의 내면에 집중하는 시간을 가져보세요.'},
    {g:'평',  t:'오늘은 방향을 재정비하고 앞으로 나아갈 계획을 차분히 세우는 날로 삼으면 좋겠어요.'},
    {g:'주의',t:'과속은 금물이에요. 빠른 것보다 안전하고 확실한 방법을 선택하는 것이 오늘은 더 현명해요.'},
    {g:'주의',t:'감정이 앞서면 실수가 생기기 쉬운 날이에요. 흥분하거나 충동적인 반응은 잠시 내려놓으세요.'},
    {g:'주의',t:'에너지가 넘치더라도 모든 곳에 쏟아붓지 마세요. 중요한 것에만 집중하는 선택과 집중이 필요한 날이에요.'},
  ],
  '양': [
    {g:'대길',t:'따뜻하고 순수한 마음이 기적 같은 하루를 만드는 날! 진심을 담아 행동하면 주변이 감동받을 거예요. 베풀수록 더 큰 복이 와요.'},
    {g:'대길',t:'베풀면 배로 돌아오는 복이 가득한 하루예요. 오늘 누군가를 도운 일이 나중에 예상치 못한 형태로 크게 돌아올 거예요.'},
    {g:'중길',t:'가족이나 가까운 사람들에게 좋은 일이 생기는 날이에요. 함께 기뻐하고 축하해 주면 그 기쁨이 배가 될 거예요.'},
    {g:'중길',t:'조용한 가운데 소소한 즐거움이 넘치는 날이에요. 억지로 바쁘게 있지 않아도 충분히 행복한 하루예요.'},
    {g:'중길',t:'오늘 건네는 작은 배려가 상대방에게 큰 기쁨이 되는 날이에요. 사소한 것에서 감동을 주는 것이 당신의 재능이에요.'},
    {g:'중길',t:'맛있는 음식이 에너지를 채워주고 기분까지 좋게 만들어 주는 날이에요. 좋아하는 음식을 즐겨보세요.'},
    {g:'중길',t:'창의적인 감성이 풍부하게 흘러넘치는 날이에요. 음악, 그림, 글쓰기 등 무언가를 표현해 보세요.'},
    {g:'소길',t:'마음이 편안하고 기분이 안정된 좋은 흐름이 이어지는 날이에요. 이 기분을 유지하며 하루를 보내 보세요.'},
    {g:'소길',t:'예술적인 감성이 예리하게 깨어있는 날이에요. 주변의 아름다운 것들이 더 선명하게 보일 거예요.'},
    {g:'소길',t:'오늘 당신이 건네는 위로와 공감이 누군가에게 큰 힘이 될 거예요. 먼저 다가가 물어봐 주세요.'},
    {g:'소길',t:'소소한 행복들이 하루 내내 산발적으로 찾아오는 날이에요. 작은 것들을 놓치지 말고 음미해 보세요.'},
    {g:'소길',t:'혼자만의 조용한 시간이 충전의 시간이 되는 날이에요. 좋아하는 것을 즐기며 에너지를 채워보세요.'},
    {g:'소길',t:'오늘 심은 작은 친절이 나중에 꽃이 되어 돌아와요. 당장 보상이 없어도 괜찮아요.'},
    {g:'소길',t:'따뜻한 음료 한 잔과 함께 잠시 멈추는 시간을 가져보세요. 작은 여유가 하루를 풍요롭게 해줘요.'},
    {g:'평',  t:'오늘은 몸을 아끼며 조용히 보내는 것이 좋겠어요. 무리하면 나중에 더 힘들 수 있어요.'},
    {g:'평',  t:'있는 그대로의 오늘을 즐기는 날이에요. 욕심 없이 현재에 충실하면 그것만으로도 충분해요.'},
    {g:'평',  t:'비교보다 자기 자신의 속도로 가는 것이 오늘은 가장 현명한 선택이에요.'},
    {g:'평',  t:'오늘은 감정에 솔직하되 표현은 부드럽게 하는 연습을 해보세요. 관계가 더 부드러워질 거예요.'},
    {g:'주의',t:'감수성이 예민해지는 날이에요. 상처받기 쉬우니 마음의 방어막을 조금 높여두세요.'},
    {g:'주의',t:'과한 걱정이 오히려 에너지를 소모해요. 지금 이 순간에 집중하고 미래는 미래에게 맡겨보세요.'},
    {g:'주의',t:'타인의 감정에 지나치게 휘둘리지 않도록 주의하세요. 당신의 평화가 가장 중요해요.'},
  ],
  '원숭이': [
    {g:'대길',t:'재치와 기지가 번뜩이며 대박을 터뜨리는 날! 순간적으로 떠오르는 아이디어가 황금이 되는 날이에요. 망설이지 말고 바로 실행해 보세요.'},
    {g:'대길',t:'영리한 판단과 재빠른 행동이 큰 행운으로 이어지는 최고의 하루예요. 주변 상황을 빠르게 파악해서 기회를 낚아채 보세요.'},
    {g:'중길',t:'재치 있는 한마디가 분위기를 반전시키고 좋은 결과를 만드는 날이에요. 오늘 당신의 입담이 빛을 발해요.'},
    {g:'중길',t:'새로운 아이디어가 연속으로 떠오르는 날이에요. 모두 메모해 두면 나중에 큰 도움이 될 거예요.'},
    {g:'중길',t:'가벼운 대화가 예상 밖의 좋은 결과로 이어지는 날이에요. 스몰토크도 오늘은 무시하지 마세요.'},
    {g:'중길',t:'익숙한 것에 작은 변화를 주면 기분이 완전히 새로워지는 날이에요. 루틴을 살짝 바꿔보세요.'},
    {g:'중길',t:'멀티태스킹이 오늘은 특히 잘 통하는 날이에요. 여러 가지를 동시에 처리하는 능력이 빛을 발해요.'},
    {g:'소길',t:'유머와 위트로 주변을 즐겁게 만드는 에너지가 넘치는 날이에요. 오늘 당신 주변에 웃음이 끊이지 않을 거예요.'},
    {g:'소길',t:'욕심보다 여유 있는 태도가 오히려 더 좋은 결과를 가져오는 날이에요. 가볍게 가면 더 멀리 가요.'},
    {g:'소길',t:'마음속에 꽃이 피어나는 것 같은 따뜻하고 기분 좋은 하루예요. 이 기분을 소중히 간직해 보세요.'},
    {g:'소길',t:'배우는 즐거움이 있는 날이에요. 어떤 것이든 새롭게 익히려는 호기심이 오늘 특히 좋은 자산이에요.'},
    {g:'소길',t:'임기응변 능력이 오늘 유독 빛나는 날이에요. 예상치 못한 상황에서도 유연하게 대처할 수 있을 거예요.'},
    {g:'소길',t:'주변 사람들과 정보나 아이디어를 나누면 혼자서는 생각 못 한 해결책이 나오는 날이에요.'},
    {g:'소길',t:'오늘 시도해 보고 싶었던 것을 가볍게 실험해 보세요. 결과보다 시도 자체가 의미 있는 날이에요.'},
    {g:'평',  t:'지금 가진 것에 감사하는 시간을 가져보면 마음이 풍요로워지는 날이에요.'},
    {g:'평',  t:'이것저것 벌이는 것보다 한 가지에 집중하는 것이 오늘 더 효율적이에요.'},
    {g:'평',  t:'에너지가 여러 방향으로 분산되지 않도록 오늘 할 일의 우선순위를 먼저 정해보세요.'},
    {g:'평',  t:'오늘은 즉흥보다 계획이 더 잘 통하는 날이에요. 잠깐 생각하고 움직이면 실수가 줄어요.'},
    {g:'주의',t:'지나친 장난이나 가벼운 말이 오해를 낳을 수 있는 날이에요. 상황을 잘 읽고 유머를 조절해 보세요.'},
    {g:'주의',t:'너무 빠르게 판단하지 말고 충분한 정보를 수집한 뒤 결정하는 것이 오늘은 중요해요.'},
    {g:'주의',t:'여러 일을 동시에 시작했다가 하나도 마무리 못 하는 상황이 생길 수 있어요. 선택과 집중이 필요해요.'},
  ],
  '닭': [
    {g:'대길',t:'부지런히 움직인 만큼 황금이 들어오는 날! 아침부터 모든 것이 톱니바퀴처럼 맞아 돌아가는 최고의 하루예요.'},
    {g:'대길',t:'꼼꼼하게 준비한 것이 큰 성과로 정확히 돌아오는 날이에요. 그동안의 노력이 오늘 빛나게 인정받을 거예요.'},
    {g:'중길',t:'세심한 일처리가 주변 사람들의 신뢰를 얻는 날이에요. 작은 것 하나하나를 정성껏 마무리해 보세요.'},
    {g:'중길',t:'오늘 하루는 주변 사람들에게 칭찬과 인정을 받게 될 거예요. 평소의 성실함이 오늘 빛을 발해요.'},
    {g:'중길',t:'가족과 함께하는 식사 시간이 오늘 특히 행복하고 에너지를 주는 시간이 될 거예요.'},
    {g:'중길',t:'아침 일찍 시작하면 하루 전체가 상쾌하게 흘러가는 날이에요. 기상 시간을 조금만 앞당겨 보세요.'},
    {g:'중길',t:'꼼꼼하게 계획을 세우고 실행하면 예상보다 훨씬 좋은 결과가 나오는 날이에요.'},
    {g:'소길',t:'마음을 넉넉하게 갖는 것이 오늘 더 좋은 결과를 만들어요. 완벽함보다 유연함을 발휘해 보세요.'},
    {g:'소길',t:'묵묵히 성실하게 움직인 것들이 조금씩 빛나기 시작하는 날이에요. 아직 결과가 안 보여도 괜찮아요.'},
    {g:'소길',t:'작은 정성이 쌓여 좋은 결과를 만들어 가는 날이에요. 오늘의 한 걸음이 내일의 큰 도약이 될 거예요.'},
    {g:'소길',t:'오늘 성실하게 해낸 일들이 훗날 큰 자산이 될 거예요. 지금 당장 보이지 않아도 가치 있는 하루예요.'},
    {g:'소길',t:'오늘은 하고 싶은 일보다 해야 할 일을 먼저 끝내면 저녁이 훨씬 여유로워질 거예요.'},
    {g:'소길',t:'주변 정리 정돈이 오늘 특히 잘 되는 날이에요. 깨끗하게 정리된 공간이 집중력을 높여줄 거예요.'},
    {g:'소길',t:'건강한 식습관과 규칙적인 생활이 오늘 특히 좋은 기운을 불러올 거예요.'},
    {g:'평',  t:'오늘은 무리하지 않고 충분히 쉬는 것이 내일을 위한 현명한 선택이에요.'},
    {g:'평',  t:'완벽하지 않아도 충분히 잘하고 있어요. 오늘은 스스로를 조금 더 너그럽게 봐주세요.'},
    {g:'평',  t:'지금 해야 할 일을 차근차근 처리하면 하루가 안정적으로 흘러갈 거예요.'},
    {g:'평',  t:'특별한 일 없이 평온하게 흘러가는 날이에요. 이런 평화로운 하루가 사실 가장 소중해요.'},
    {g:'주의',t:'지나친 완벽주의가 스트레스를 만들 수 있는 날이에요. 80점이면 충분한 날도 있어요.'},
    {g:'주의',t:'다른 사람을 너무 강하게 비판하면 오히려 관계가 멀어질 수 있어요. 오늘은 특히 부드럽게 표현해 보세요.'},
    {g:'주의',t:'작은 실수에 너무 자책하지 마세요. 실수는 누구나 하고, 빠르게 수습하는 것이 더 중요해요.'},
  ],
  '개': [
    {g:'대길',t:'신의와 성실함이 가장 큰 행운을 불러오는 날! 진심으로 대한 사람들이 오늘 당신에게 멋진 선물을 가져다줄 거예요.'},
    {g:'대길',t:'든든한 기운이 오늘 모든 어려움을 가뿐히 해결해 주는 특별한 하루예요. 믿음직스러운 모습이 주변 모두의 신뢰를 얻을 거예요.'},
    {g:'중길',t:'진심 어린 모습이 주변 사람들에게 인정받는 날이에요. 오늘 하는 일에 마음을 담으면 그것이 고스란히 전해질 거예요.'},
    {g:'중길',t:'가족이나 가까운 사람들이 오늘 특히 큰 힘이 되어주는 날이에요. 그들의 존재에 감사함을 꼭 표현해 보세요.'},
    {g:'중길',t:'오늘 건네는 따뜻한 말 한마디가 누군가의 하루를 구해줄 수 있어요. 주변을 살피는 마음이 빛나는 날이에요.'},
    {g:'중길',t:'성실하게 움직인 하루가 나중에 큰 복이 되어 돌아오는 날이에요. 묵묵히 자기 자리를 지켜보세요.'},
    {g:'중길',t:'오늘 맺어지는 인연이나 강화되는 관계가 앞으로 오랫동안 소중한 버팀목이 될 거예요.'},
    {g:'소길',t:'가볍게 떠나는 짧은 외출이나 작은 여행이 마음을 환기시켜 줄 거예요. 새로운 풍경이 기분을 새롭게 해줄 거예요.'},
    {g:'소길',t:'건강 상태를 살피는 것이 오늘 특히 중요한 날이에요. 몸이 보내는 신호에 귀를 기울여 보세요.'},
    {g:'소길',t:'진심을 담아 대화하면 상대방과 마음이 통하는 경험을 하게 되는 날이에요.'},
    {g:'소길',t:'오늘 만나는 인연이 내일의 기쁨이 되는 날이에요. 모든 만남에 최선을 다해 대해 보세요.'},
    {g:'소길',t:'오래된 것을 돌보고 보살피는 것이 오늘 특히 빛나는 행동이에요. 사람이든 물건이든 오래 함께한 것들을 소중히 해주세요.'},
    {g:'소길',t:'믿음직스러운 모습이 주변에 안정감을 주는 날이에요. 당신이 있어 모두가 편안함을 느낄 거예요.'},
    {g:'소길',t:'반려동물이나 자연과 함께하는 시간이 오늘 특히 힐링이 되는 날이에요.'},
    {g:'평',  t:'조용하고 평온한 저녁이 오늘 가장 좋은 선물이에요. 하루를 차분하게 마무리해 보세요.'},
    {g:'평',  t:'서두르지 않아도 충분한 하루예요. 오늘은 느리게 가는 것이 오히려 맞는 날이에요.'},
    {g:'평',  t:'익숙한 공간에서 익숙한 사람들과 보내는 평범한 하루가 사실 가장 행복한 날이에요.'},
    {g:'평',  t:'오늘은 새로운 것을 추가하기보다 이미 있는 것들을 잘 돌보는 날이에요.'},
    {g:'주의',t:'지나친 걱정이 실제로 에너지를 낭비하는 날이에요. 통제할 수 없는 일은 내려놓고 지금 할 수 있는 것에 집중하세요.'},
    {g:'주의',t:'혼자 모든 것을 짊어지려 하지 마세요. 주변에 도움을 요청하는 것도 용기 있는 행동이에요.'},
    {g:'주의',t:'타인의 감정 변화에 너무 예민하게 반응하지 않도록 주의하세요. 모든 것이 당신 때문이 아닐 수 있어요.'},
  ],
  '돼지': [
    {g:'대길',t:'여유와 복이 한꺼번에 쏟아지는 날! 입이 떡 벌어질 만큼 좋은 일이 오늘 일어날 수 있어요. 활짝 열린 마음으로 받아들여 보세요.'},
    {g:'대길',t:'좋은 인연과 뜻밖의 재물이 동시에 들어오는 최고의 하루예요. 오늘 만나는 사람, 받는 연락 모두 주의 깊게 살펴보세요.'},
    {g:'중길',t:'좋은 인연이 생각보다 아주 가까이 있는 날이에요. 주변을 한 번 더 따뜻하게 바라보세요.'},
    {g:'중길',t:'기분 좋은 소식이 하루 중 불쑥 찾아오는 날이에요. 소식을 들었을 때 진심으로 기뻐하면 그 기쁨이 더 커질 거예요.'},
    {g:'중길',t:'맛있는 음식이 오늘 하루의 큰 위안이 되어주는 날이에요. 좋아하는 음식을 충분히 즐겨보세요.'},
    {g:'중길',t:'소소한 행운이 하루 내내 꾸준히 찾아오는 날이에요. 사소한 것도 놓치지 말고 감사하는 마음을 가져보세요.'},
    {g:'중길',t:'넉넉한 마음으로 주변을 대하면 그것이 더 큰 복이 되어 돌아오는 날이에요.'},
    {g:'소길',t:'여유로운 마음 속에 진짜 행복이 숨어있는 날이에요. 바쁘게 움직이는 것보다 천천히 즐기는 하루가 더 소중해요.'},
    {g:'소길',t:'무리하지 않아도 충분히 잘 굴러가는 날이에요. 힘 빼고 자연스럽게 흘러가 보세요.'},
    {g:'소길',t:'따뜻한 마음을 나누면 주변에 좋은 기운이 도는 날이에요. 먼저 웃음을 건네보세요.'},
    {g:'소길',t:'자기 자신을 소중히 대하는 것이 오늘 특히 중요한 날이에요. 나를 잘 돌봐야 남도 잘 돌볼 수 있어요.'},
    {g:'소길',t:'맛있는 것을 먹고 좋아하는 일을 하는 것이 오늘의 최고 처방이에요. 소소하지만 확실한 행복을 챙겨보세요.'},
    {g:'소길',t:'사람들과 함께하는 시간이 오늘 특히 즐겁고 에너지를 주는 날이에요. 좋아하는 사람들과 시간을 만들어 보세요.'},
    {g:'소길',t:'오늘은 많이 웃을 수 있는 날이에요. 웃음이 많아질수록 복도 많아진다는 것을 기억하세요.'},
    {g:'평',  t:'따뜻하게 쉬는 것이 오늘의 최고 보약이에요. 무리하지 않고 편안하게 보내세요.'},
    {g:'평',  t:'지금 이 순간이 사실 행복이라는 것을 새삼 느끼게 되는 날이에요.'},
    {g:'평',  t:'욕심보다 현재에 만족하는 것이 오늘의 진정한 행복이에요. 있는 것들에 감사해 보세요.'},
    {g:'평',  t:'특별한 것 없이도 충분히 좋은 하루예요. 그냥 오늘을 그대로 즐겨보세요.'},
    {g:'주의',t:'과식이나 과소비가 후회로 이어질 수 있는 날이에요. 맛있어도, 갖고 싶어도 오늘만큼은 조금 참아보세요.'},
    {g:'주의',t:'게으름이 습관이 되지 않도록 오늘 작은 것이라도 하나 실행해 보세요. 시작이 반이에요.'},
    {g:'주의',t:'중요한 일을 미루다 나중에 몰아치는 상황이 생길 수 있어요. 오늘 조금이라도 미리 해두면 나중이 편해요.'},
  ],
};

// 올해의 띠별 운세 — birth_year % 5 로 인덱스 선택
const YEAR_FORTUNE = {
  '쥐': [
    {g:'대길',t:'재물·건강·인복 삼박자가 완벽히 맞는 해. 용기 있는 도전에 하늘이 응답해요'},
    {g:'중길',t:'노력한 만큼 인정받는 한 해. 새로운 인맥이 미래의 문을 열어줘요'},
    {g:'소길',t:'소소한 행운이 매달 이어지는 해. 가족과의 시간이 가장 큰 보물이에요'},
    {g:'평',  t:'변화 없는 안정 속에 내실을 다지는 해. 조급함을 내려놓으면 충분해요'},
    {g:'주의',t:'건강 관리와 지출 점검이 필요한 해. 하반기부터 서서히 좋아져요'},
  ],
  '소': [
    {g:'대길',t:'꾸준한 노력이 큰 결실을 맺는 해. 주변 모두가 당신을 응원해요'},
    {g:'중길',t:'성실함이 인정받고 새 기회가 열리는 해. 건강도 좋은 흐름이에요'},
    {g:'소길',t:'작은 성취가 쌓여 연말에 뿌듯함을 주는 해. 가족 화목이 최고의 복이에요'},
    {g:'평',  t:'무리 없이 평탄하게 흘러가는 해. 지금 자리에 충실하면 돼요'},
    {g:'주의',t:'체력 소모가 클 수 있는 해. 규칙적인 생활이 가장 좋은 예방이에요'},
  ],
  '호랑이': [
    {g:'대길',t:'용기와 행동력이 큰 성과를 만드는 해. 두려움 없이 나아가세요'},
    {g:'중길',t:'도전이 빛나고 인정받는 한 해. 새로운 분야에서 재능이 발휘돼요'},
    {g:'소길',t:'활력 넘치는 해지만 무리는 금물. 작은 도전들이 모여 큰 성장이 돼요'},
    {g:'평',  t:'욕심을 내려놓고 여유를 찾는 해. 가족과의 시간을 늘리면 좋아요'},
    {g:'주의',t:'과한 자신감이 실수를 부를 수 있는 해. 신중함을 잃지 마세요'},
  ],
  '토끼': [
    {g:'대길',t:'모든 인연이 행운으로 이어지는 해. 부드러움이 세상을 움직여요'},
    {g:'중길',t:'감성과 창의력이 빛나는 한 해. 새로운 취미가 삶을 풍요롭게 해요'},
    {g:'소길',t:'따뜻한 관계가 행복을 채우는 해. 작은 배려들이 복을 불러와요'},
    {g:'평',  t:'내면을 돌보고 쉬어가는 한 해. 무리한 변화보다 안정을 선택하세요'},
    {g:'주의',t:'감정 기복에 주의가 필요한 해. 마음 챙김이 올 한 해의 열쇠예요'},
  ],
  '용': [
    {g:'대길',t:'모든 꿈이 현실이 되는 대운의 해! 크게 꿈꾸고 크게 행동하세요'},
    {g:'중길',t:'리더십이 빛나고 큰 성과를 이루는 해. 주변의 지지를 받아요'},
    {g:'소길',t:'포부를 현실적으로 조정하면 좋은 성과가 있어요. 건강도 챙기세요'},
    {g:'평',  t:'큰 도약보다 내실을 다지는 해. 기반이 단단해지는 한 해예요'},
    {g:'주의',t:'과욕이 화를 부를 수 있는 해. 겸손함을 잃지 않으면 무사해요'},
  ],
  '뱀': [
    {g:'대길',t:'직관과 지혜가 황금을 부르는 해. 내 감각을 믿고 나아가세요'},
    {g:'중길',t:'깊이 있는 통찰로 인정받는 한 해. 조용한 성과가 쌓여가요'},
    {g:'소길',t:'신중한 판단이 안정된 결과를 가져와요. 꾸준함이 빛을 발해요'},
    {g:'평',  t:'생각이 많아지는 해. 행동으로 옮기는 용기가 필요해요'},
    {g:'주의',t:'의심이 과해지기 쉬운 해. 믿음과 소통이 올 한 해의 과제예요'},
  ],
  '말': [
    {g:'대길',t:'달리는 만큼 행운이 따르는 최고의 해! 열정을 마음껏 펼치세요'},
    {g:'중길',t:'활발한 활동이 좋은 기회를 만드는 해. 건강하고 에너지 넘쳐요'},
    {g:'소길',t:'바쁘지만 보람 있는 한 해. 중간중간 쉬어가면 더 멀리 가요'},
    {g:'평',  t:'속도를 줄이고 방향을 점검하는 해. 내실이 다져지는 시간이에요'},
    {g:'주의',t:'무리한 질주가 탈을 낼 수 있는 해. 페이스 조절이 중요해요'},
  ],
  '양': [
    {g:'대길',t:'따뜻한 마음이 복을 불러오는 해. 가족과 사랑이 넘쳐나요'},
    {g:'중길',t:'예술적 재능이 인정받는 한 해. 감성이 풍부해지고 창의력이 빛나요'},
    {g:'소길',t:'소박하지만 따뜻한 행복이 가득한 해. 주변 인연들이 힘이 돼요'},
    {g:'평',  t:'감정을 잘 다스리며 평온한 흐름을 유지하는 해. 건강 챙기세요'},
    {g:'주의',t:'지나친 걱정이 에너지를 소모하는 해. 긍정적인 시각을 가지세요'},
  ],
  '원숭이': [
    {g:'대길',t:'재치와 영리함이 대박을 만드는 해. 아이디어 하나가 인생을 바꿔요'},
    {g:'중길',t:'창의력이 빛나고 새로운 기회가 많은 해. 사람들이 당신을 따르게 돼요'},
    {g:'소길',t:'다양한 시도 속에 숨은 보석을 찾는 해. 집중력을 높이면 더 좋아요'},
    {g:'평',  t:'에너지 분산에 주의하며 한 가지에 집중하는 해. 내실을 다지세요'},
    {g:'주의',t:'경솔한 판단이 문제를 일으킬 수 있는 해. 신중함이 필요해요'},
  ],
  '닭': [
    {g:'대길',t:'부지런함이 황금을 부르는 해. 꼼꼼한 노력이 빛나는 전성기예요'},
    {g:'중길',t:'성실함이 인정받고 승진·성과가 따르는 해. 건강도 좋아요'},
    {g:'소길',t:'꾸준한 노력이 안정된 결과를 가져오는 해. 작은 성취를 즐기세요'},
    {g:'평',  t:'현재 자리에서 최선을 다하는 한 해. 변화보다 안정이 좋아요'},
    {g:'주의',t:'완벽주의가 스트레스를 줄 수 있는 해. 충분함을 인정하는 연습을 하세요'},
  ],
  '개': [
    {g:'대길',t:'성실과 신의가 최고의 행운을 부르는 해. 가족과 동료 모두 당신 편이에요'},
    {g:'중길',t:'신뢰가 새로운 기회를 만드는 한 해. 인간관계가 풍요로워져요'},
    {g:'소길',t:'묵묵한 노력이 인정받는 해. 가족의 화목이 가장 큰 보람이에요'},
    {g:'평',  t:'지금 있는 자리를 소중히 하는 한 해. 큰 변화보다 충실함이 중요해요'},
    {g:'주의',t:'지나친 희생이 나를 지치게 할 수 있는 해. 나를 먼저 돌보세요'},
  ],
  '돼지': [
    {g:'대길',t:'복이 넘치고 재물이 들어오는 풍요로운 해. 베풀수록 더 많이 돌아와요'},
    {g:'중길',t:'좋은 인연과 기쁜 소식이 이어지는 한 해. 낙천적 태도가 복을 불러요'},
    {g:'소길',t:'소소한 즐거움이 가득한 해. 작은 행복을 발견하는 눈이 생겨요'},
    {g:'평',  t:'여유롭게 내실을 다지는 한 해. 무리하지 않아도 충분해요'},
    {g:'주의',t:'낭비와 과욕에 주의가 필요한 해. 저축과 건강 관리를 우선하세요'},
  ],
};
function dayOfYear(d = new Date()) {
  return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
}

app.get('/api/zodiac', requireAuth, async (req, res) => {
  const [rows] = await getPool().query(
    `SELECT id, display_name, icon, photo_url, birth_year, is_pet FROM users
      WHERE family_id = ?
        AND (birth_year IS NOT NULL OR is_pet = 1)
      ORDER BY is_pet ASC, role DESC, id ASC`,
    [req.user.family_id]
  );
  const doy = dayOfYear();
  res.json(rows.map((u) => {
    if (u.is_pet) {
      const fortune = PET_FORTUNE[(doy + u.id) % PET_FORTUNE.length];
      return {
        name: u.display_name, icon: u.icon, photoUrl: u.photo_url,
        year: u.birth_year, zodiac: '펫', grade: '평', fortune, isPet: true,
      };
    }
    const z = zodiacOf(u.birth_year);
    const pool = FORTUNE[z] || [];
    const entry = pool.length ? pool[(doy + u.id) % pool.length] : {g:'평', t:'좋은 하루 되세요'};
    const yearPool = YEAR_FORTUNE[z] || [];
    const yIdx = yearPool.length ? (((u.birth_year || 0) % yearPool.length) + yearPool.length) % yearPool.length : 0;
    const yearEntry = yearPool[yIdx] || {g:'평', t:'올해도 건강하고 행복하세요'};
    return {
      name: u.display_name, icon: u.icon, photoUrl: u.photo_url,
      year: u.birth_year, zodiac: z,
      grade: entry.g, fortune: entry.t,
      yearGrade: yearEntry.g, yearText: yearEntry.t,
      isPet: false,
    };
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
    notifyEvent(req.user, { title, emoji, eventDate, eventTime, location })
      .catch((e) => console.warn('[push] event:', e.message));
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

// ---------- 올해의 목표 API ----------
app.get('/api/goals', requireAuth, async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const cat = ['year','quarter','month'].includes(req.query.category) ? req.query.category : 'year';
    const qtr = Number(req.query.quarter) || null;
    const mon = Number(req.query.month) || null;
    const args1 = [req.user.family_id, year, cat];
    let extraWhere = '';
    if (cat === 'quarter' && qtr) { extraWhere = 'AND g.quarter = ?'; args1.push(qtr); }
    if (cat === 'month' && mon)   { extraWhere = 'AND g.month = ?';   args1.push(mon); }
    const args2 = [req.user.family_id, year, cat, ...args1.slice(3)];
    const [[goals], [cheers]] = await Promise.all([
      getPool().query(
        `SELECT g.id, g.user_id, g.title, g.year, g.category, g.quarter, g.month, g.created_at,
                u.display_name, u.icon, u.photo_url,
                (SELECT progress FROM goal_evidences e WHERE e.goal_id = g.id ORDER BY e.created_at DESC LIMIT 1) AS progress,
                (SELECT COUNT(*) FROM goal_evidences e WHERE e.goal_id = g.id) AS evidence_count,
                (SELECT COUNT(*) FROM goal_cheers c WHERE c.goal_id = g.id) AS cheer_count
           FROM goals g
           JOIN users u ON u.id = g.user_id
          WHERE g.family_id = ? AND g.year = ? AND COALESCE(g.category, 'year') = ? ${extraWhere}
          ORDER BY g.user_id, g.created_at`,
        args1
      ),
      getPool().query(
        `SELECT c.goal_id, c.from_user_id, c.emoji
           FROM goal_cheers c
           JOIN goals g ON g.id = c.goal_id
          WHERE g.family_id = ? AND g.year = ? AND COALESCE(g.category, 'year') = ? ${extraWhere}`,
        args2
      ),
    ]);
    const cheerMap = {};
    for (const c of cheers) {
      if (!cheerMap[c.goal_id]) cheerMap[c.goal_id] = [];
      cheerMap[c.goal_id].push({ fromUserId: c.from_user_id, emoji: c.emoji });
    }
    res.json(goals.map((g) => ({
      id: g.id,
      userId: g.user_id,
      displayName: g.display_name,
      icon: g.icon,
      photoUrl: g.photo_url,
      title: g.title,
      year: g.year,
      progress: Number(g.progress) || 0,
      evidenceCount: Number(g.evidence_count) || 0,
      cheerCount: Number(g.cheer_count) || 0,
      cheers: cheerMap[g.id] || [],
      createdAt: g.created_at,
    })));
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.post('/api/goals', requireAuth, async (req, res) => {
  try {
    const title = (req.body?.title || '').toString().trim().slice(0, 200);
    if (!title) return res.status(400).json({ error: 'no-title' });
    const year = Number(req.body?.year) || new Date().getFullYear();
    const cat = ['year','quarter','month'].includes(req.body?.category) ? req.body.category : 'year';
    const qtr = cat === 'quarter' ? (Number(req.body?.quarter) || null) : null;
    const mon = cat === 'month'   ? (Number(req.body?.month)   || null) : null;
    const [r] = await getPool().query(
      'INSERT INTO goals (family_id, user_id, year, title, category, quarter, month) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.family_id, req.user.id, year, title, cat, qtr, mon]
    );
    res.json({ ok: true, id: r.insertId });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.patch('/api/goals/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
    const title = (req.body.title || '').trim().slice(0, 200);
    if (!title) return res.status(400).json({ error: 'title-required' });
    const [rows] = await getPool().query(
      'SELECT id, user_id FROM goals WHERE id = ? AND family_id = ? LIMIT 1',
      [id, req.user.family_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'not-found' });
    if (rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'forbidden' });
    }
    await getPool().query('UPDATE goals SET title = ? WHERE id = ?', [title, id]);
    res.json({ ok: true, title });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.delete('/api/goals/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
    const [rows] = await getPool().query(
      'SELECT id, user_id FROM goals WHERE id = ? AND family_id = ? LIMIT 1',
      [id, req.user.family_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'not-found' });
    if (rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'forbidden' });
    }
    const [evs] = await getPool().query('SELECT image_url FROM goal_evidences WHERE goal_id = ?', [id]);
    const conn = await getPool().getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM goal_cheers WHERE goal_id = ?', [id]);
      await conn.query('DELETE FROM goal_evidences WHERE goal_id = ?', [id]);
      await conn.query('DELETE FROM goals WHERE id = ?', [id]);
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
    for (const ev of evs) safeUnlinkGoalsFile(ev.image_url);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.get('/api/goals/:id/evidences', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
    const [goal] = await getPool().query(
      'SELECT id FROM goals WHERE id = ? AND family_id = ? LIMIT 1',
      [id, req.user.family_id]
    );
    if (!goal.length) return res.status(404).json({ error: 'not-found' });
    const [evs] = await getPool().query(
      `SELECT e.id, e.user_id, e.image_url, e.caption, e.progress, e.created_at,
              u.display_name, u.icon, u.photo_url AS uploader_photo
         FROM goal_evidences e
         JOIN users u ON u.id = e.user_id
        WHERE e.goal_id = ?
        ORDER BY e.created_at DESC`,
      [id]
    );
    res.json(evs.map((e) => ({
      id: e.id,
      userId: e.user_id,
      displayName: e.display_name,
      icon: e.icon,
      uploaderPhoto: e.uploader_photo,
      imageUrl: e.image_url,
      caption: e.caption,
      progress: e.progress,
      createdAt: e.created_at,
      canDelete: e.user_id === req.user.id || req.user.role === 'admin',
    })));
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.post(
  '/api/goals/:id/evidences',
  requireAuth,
  (req, res, next) => {
    goalsUpload.single('photo')(req, res, (err) => {
      if (err) {
        const msg = err.message === 'invalid-image-type' ? '이미지 파일만 올릴 수 있어요'
          : err.code === 'LIMIT_FILE_SIZE' ? '파일이 너무 커요 (3MB 이하)'
          : (err.message || '업로드 실패');
        return res.status(400).json({ error: 'upload-failed', message: msg });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const goalId = Number(req.params.id);
      if (!Number.isInteger(goalId)) return res.status(400).json({ error: 'bad-id' });
      const [goal] = await getPool().query(
        'SELECT id FROM goals WHERE id = ? AND family_id = ? LIMIT 1',
        [goalId, req.user.family_id]
      );
      if (!goal.length) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(404).json({ error: 'not-found' });
      }
      const progress = [0, 25, 50, 75, 100].includes(Number(req.body?.progress))
        ? Number(req.body.progress) : 0;
      const caption = (req.body?.caption || '').toString().trim().slice(0, 300) || null;
      const imageUrl = req.file
        ? `/uploads/goals/${familySubDir(req)}/${req.file.filename}`
        : null;
      const [r] = await getPool().query(
        'INSERT INTO goal_evidences (goal_id, user_id, image_url, caption, progress) VALUES (?, ?, ?, ?, ?)',
        [goalId, req.user.id, imageUrl, caption, progress]
      );
      res.json({ ok: true, id: r.insertId, imageUrl, caption, progress });
    } catch (e) {
      if (req.file) fs.unlink(req.file.path, () => {});
      res.status(500).json({ error: 'internal', message: e.message });
    }
  }
);

app.delete('/api/goals/:goalId/evidences/:evId', requireAuth, async (req, res) => {
  try {
    const goalId = Number(req.params.goalId);
    const evId = Number(req.params.evId);
    if (!Number.isInteger(goalId) || !Number.isInteger(evId)) return res.status(400).json({ error: 'bad-id' });
    const [rows] = await getPool().query(
      `SELECT e.id, e.user_id, e.image_url FROM goal_evidences e
         JOIN goals g ON g.id = e.goal_id
        WHERE e.id = ? AND e.goal_id = ? AND g.family_id = ? LIMIT 1`,
      [evId, goalId, req.user.family_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'not-found' });
    if (rows[0].user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
    safeUnlinkGoalsFile(rows[0].image_url);
    await getPool().query('DELETE FROM goal_evidences WHERE id = ?', [evId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.post('/api/goals/:id/cheers', requireAuth, async (req, res) => {
  try {
    const goalId = Number(req.params.id);
    if (!Number.isInteger(goalId)) return res.status(400).json({ error: 'bad-id' });
    const emoji = (req.body?.emoji || '👏').toString().trim().slice(0, 10) || '👏';
    const [goal] = await getPool().query(
      'SELECT id FROM goals WHERE id = ? AND family_id = ? LIMIT 1',
      [goalId, req.user.family_id]
    );
    if (!goal.length) return res.status(404).json({ error: 'not-found' });
    await getPool().query(
      'INSERT IGNORE INTO goal_cheers (goal_id, from_user_id, emoji) VALUES (?, ?, ?)',
      [goalId, req.user.id, emoji]
    );
    const [[{ cnt }]] = await getPool().query('SELECT COUNT(*) AS cnt FROM goal_cheers WHERE goal_id = ?', [goalId]);
    res.json({ ok: true, cheerCount: Number(cnt) });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

app.delete('/api/goals/:id/cheers', requireAuth, async (req, res) => {
  try {
    const goalId = Number(req.params.id);
    if (!Number.isInteger(goalId)) return res.status(400).json({ error: 'bad-id' });
    const emoji = (req.query?.emoji || '👏').toString().trim().slice(0, 10) || '👏';
    await getPool().query(
      'DELETE FROM goal_cheers WHERE goal_id = ? AND from_user_id = ? AND emoji = ?',
      [goalId, req.user.id, emoji]
    );
    const [[{ cnt }]] = await getPool().query('SELECT COUNT(*) AS cnt FROM goal_cheers WHERE goal_id = ?', [goalId]);
    res.json({ ok: true, cheerCount: Number(cnt) });
  } catch (e) { res.status(500).json({ error: 'internal', message: e.message }); }
});

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
app.use('/uploads/chat', express.static(CHAT_DIR, {
  maxAge: '7d',
  immutable: true,
  index: false,
  fallthrough: true,
}));
app.use('/uploads/goals', express.static(GOALS_DIR, {
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

// ---------- 푸시 알림 헬퍼 ----------
async function notifyChat(sender, text) {
  const recipients = await familyUserIds(sender.family_id, sender.id);
  if (!recipients.length) return;
  await sendPush(recipients, {
    title: `${sender.display_name}`,
    body: (text || '').slice(0, 120),
    data: { kind: 'chat', path: '/#chat' },
  });
}

async function notifyDiary(author, text) {
  const recipients = await familyUserIds(author.family_id, author.id);
  if (!recipients.length) return;
  await sendPush(recipients, {
    title: `${author.display_name}님이 일기를 썼어요`,
    body: (text || '').slice(0, 120),
    data: { kind: 'diary', path: '/#diary' },
  });
}

async function notifyEvent(creator, ev) {
  const recipients = await familyUserIds(creator.family_id, creator.id);
  if (!recipients.length) return;
  const dateLabel = ev.eventDate || '';
  const timeLabel = ev.eventTime ? ` ${ev.eventTime}` : '';
  await sendPush(recipients, {
    title: `${ev.emoji || '📅'} 새 일정: ${ev.title}`,
    body: `${dateLabel}${timeLabel}${ev.location ? ' · ' + ev.location : ''}`,
    data: { kind: 'event', path: '/#events' },
  });
}

// 매일 09:00 (DEFAULT_TZ 기준) 가족 생일/기념일 체크 후 가족 전체에 푸시.
// 같은 날 중복 발송 방지를 위해 migrations_applied 테이블에 birthday-notified-YYYY-MM-DD 마커 사용.
async function runBirthdayCheck() {
  try {
    const today = todayLocal();
    const marker = `birthday-notified-${today}`;
    const [exists] = await getPool().query(
      'SELECT 1 FROM migrations_applied WHERE name = ? LIMIT 1',
      [marker]
    );
    if (exists.length) return;

    const now = new Date();
    const m = now.getMonth() + 1;
    const d = now.getDate();

    const [families] = await getPool().query('SELECT id FROM families');
    for (const fam of families) {
      const [bdays] = await getPool().query(
        `SELECT id, display_name FROM users
          WHERE family_id = ? AND birth_month = ? AND birth_day = ?`,
        [fam.id, m, d]
      );
      const [annis] = await getPool().query(
        `SELECT title, emoji FROM anniversaries
          WHERE family_id = ? AND month = ? AND day = ?`,
        [fam.id, m, d]
      );
      if (!bdays.length && !annis.length) continue;

      const parts = [];
      if (bdays.length) parts.push(`🎂 ${bdays.map(b => b.display_name).join(', ')} 생일`);
      for (const a of annis) parts.push(`${a.emoji || '🎈'} ${a.title}`);

      const recipients = await familyUserIds(fam.id);
      if (!recipients.length) continue;
      await sendPush(recipients, {
        title: '오늘의 가족 기념일',
        body: parts.join(' · '),
        data: { kind: 'birthday', path: '/#anniversaries' },
      });
    }

    await getPool().query(
      'INSERT IGNORE INTO migrations_applied (name) VALUES (?)',
      [marker]
    );
  } catch (e) {
    console.warn('[push] birthday-check failed:', e.message);
  }
}

function scheduleBirthdayCheck() {
  const tz = process.env.DEFAULT_TZ || 'Asia/Tokyo';
  const targetHour = 9;
  function msUntilNext() {
    const now = new Date();
    const local = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    const target = new Date(local);
    target.setHours(targetHour, 0, 0, 0);
    if (target <= local) target.setDate(target.getDate() + 1);
    return target.getTime() - local.getTime();
  }
  function tick() {
    runBirthdayCheck();
    setTimeout(tick, msUntilNext());
  }
  // 부팅 직후 한 번 체크 (서버 재시작 후 누락 방지) → 다음 09:00 까지 대기 후 반복
  setTimeout(tick, msUntilNext());
  runBirthdayCheck();
}

// ---------- 부팅 ----------
const PORT = Number(process.env.PORT || 3003);
(async () => {
  try {
    await ensureSchema();
    console.log('[db] schema ready');
    await bootstrapAdmin();
    scheduleBirthdayCheck();
  } catch (e) { console.warn('[db] init failed (continuing):', e.message); }
  // socket.io 는 http.Server 에 attach 해야 하므로 express → http.createServer 래핑
  const httpServer = http.createServer(app);
  attachGostopServer(httpServer);
  httpServer.listen(PORT, () => console.log(`familyboard listening on :${PORT}`));
})();
