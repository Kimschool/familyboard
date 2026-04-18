require('dotenv').config();
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const { ensureSchema, getPool } = require('./db');
const {
  bootstrapAdmin, login, logout, verify,
  requireAuth, requireAdmin, publicUser,
} = require('./auth');

const app = express();
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false }));

// ---------- 간단 쿠키 파서 ----------
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

// ---------- 캐시 ----------
const cache = new Map();
function cacheGet(key, ttlMs) {
  const v = cache.get(key);
  if (!v) return null;
  if (Date.now() - v.t > ttlMs) { cache.delete(key); return null; }
  return v.data;
}
function cacheSet(key, data) { cache.set(key, { t: Date.now(), data }); }

// ---------- 헬스 ----------
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// ---------- 인증 ----------
app.post('/api/login', async (req, res) => {
  const r = await login(req.body?.username, req.body?.password);
  if (!r) return res.status(401).json({ error: 'invalid' });
  res.setHeader('Set-Cookie',
    `fb_token=${encodeURIComponent(r.token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 86400}`);
  res.json({ ok: true, user: r.user });
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

// ---------- 사용자 관리 (관리자만) ----------
app.get('/api/users', requireAdmin, async (_req, res) => {
  const [rows] = await getPool().query(
    `SELECT id, username, display_name, role, birth_year, birth_month, birth_day, is_lunar
       FROM users ORDER BY role DESC, id ASC`
  );
  res.json(rows.map(publicUser));
});

app.post('/api/users', requireAdmin, async (req, res) => {
  const { username, displayName, password, role, birthYear, birthMonth, birthDay, isLunar } = req.body || {};
  const u = (username || '').trim();
  const d = (displayName || '').trim();
  const p = password || '';
  const r = role === 'admin' ? 'admin' : 'member';

  if (!u || !d || p.length < 4) return res.status(400).json({ error: 'invalid-input' });
  const by = Number(birthYear) || null;
  const bm = Number(birthMonth) || null;
  const bd = Number(birthDay) || null;
  if (bm !== null && !(bm >= 1 && bm <= 12)) return res.status(400).json({ error: 'bad-month' });
  if (bd !== null && !(bd >= 1 && bd <= 31)) return res.status(400).json({ error: 'bad-day' });

  const hash = bcrypt.hashSync(p, 10);
  try {
    const [result] = await getPool().query(
      `INSERT INTO users (username, display_name, role, password_hash, birth_year, birth_month, birth_day, is_lunar)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [u, d, r, hash, by, bm, bd, isLunar ? 1 : 0]
    );
    res.json({ ok: true, id: result.insertId });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'username-exists' });
    throw e;
  }
});

app.patch('/api/users/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });

  const updates = [];
  const args = [];
  const { displayName, password, birthYear, birthMonth, birthDay, isLunar } = req.body || {};

  if (displayName !== undefined) { updates.push('display_name = ?'); args.push(String(displayName).trim()); }
  if (password) { updates.push('password_hash = ?'); args.push(bcrypt.hashSync(password, 10)); }
  if (birthYear !== undefined)  { updates.push('birth_year = ?');  args.push(Number(birthYear) || null); }
  if (birthMonth !== undefined) { updates.push('birth_month = ?'); args.push(Number(birthMonth) || null); }
  if (birthDay !== undefined)   { updates.push('birth_day = ?');   args.push(Number(birthDay) || null); }
  if (isLunar !== undefined)    { updates.push('is_lunar = ?');    args.push(isLunar ? 1 : 0); }

  if (!updates.length) return res.json({ ok: true });
  args.push(id);
  await getPool().query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, args);
  res.json({ ok: true });
});

app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
  if (id === req.user.id) return res.status(400).json({ error: 'cannot-delete-self' });
  await getPool().query('DELETE FROM users WHERE id = ?', [id]);
  await getPool().query('DELETE FROM sessions WHERE user_id = ?', [id]);
  res.json({ ok: true });
});

// ---------- 날씨 (Open-Meteo) ----------
const TZ = process.env.DEFAULT_TZ || 'Asia/Tokyo';
const TZ_ENC = encodeURIComponent(TZ);

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
    const r = await fetch(url);
    const j = await r.json();

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
  } catch (e) {
    res.status(502).json({ error: 'weather-fetch-failed', message: e.message });
  }
});

// ---------- 대기질 ----------
app.get('/api/air', async (_req, res) => {
  try {
    const lat = process.env.DEFAULT_LAT || '35.6895';
    const lon = process.env.DEFAULT_LON || '139.6917';
    const key = `air:${lat},${lon}`;
    const cached = cacheGet(key, 30 * 60 * 1000);
    if (cached) return res.json(cached);

    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
      `&current=pm10,pm2_5,alder_pollen,birch_pollen,grass_pollen&timezone=${TZ_ENC}`;
    const r = await fetch(url);
    const j = await r.json();

    const pm10 = j.current?.pm10 ?? null;
    const pm25 = j.current?.pm2_5 ?? null;
    const pollen = Math.max(
      j.current?.alder_pollen ?? 0,
      j.current?.birch_pollen ?? 0,
      j.current?.grass_pollen ?? 0
    );

    const out = {
      pm10, pm25,
      pm10Level: level(pm10, [30, 80, 150]),
      pm25Level: level(pm25, [15, 35, 75]),
      pollen,
      pollenLevel: level(pollen, [1, 10, 50]),
    };
    cacheSet(key, out);
    res.json(out);
  } catch (e) {
    res.status(502).json({ error: 'air-fetch-failed', message: e.message });
  }
});

function level(v, [g, m, b]) {
  if (v == null) return 'unknown';
  if (v <= g) return 'good';
  if (v <= m) return 'normal';
  if (v <= b) return 'bad';
  return 'worst';
}

// ---------- 환율 ----------
app.get('/api/fx', async (_req, res) => {
  try {
    const key = 'fx:USD';
    const cached = cacheGet(key, 60 * 60 * 1000);
    if (cached) return res.json(cached);

    const r = await fetch('https://open.er-api.com/v6/latest/USD');
    const j = await r.json();
    if (j.result !== 'success') throw new Error('fx-bad-response');

    const krw = j.rates.KRW;
    const jpy = j.rates.JPY;
    const out = {
      ts: j.time_last_update_unix * 1000,
      usdKrw: Math.round(krw),
      usdJpy: Math.round(jpy * 100) / 100,
      jpyKrw: Math.round((krw / jpy) * 100 * 100) / 100,
      rates: j.rates,
      base: 'USD',
    };
    cacheSet(key, out);
    res.json(out);
  } catch (e) {
    res.status(502).json({ error: 'fx-fetch-failed', message: e.message });
  }
});

// ---------- 메모 CRUD ----------
app.get('/api/memos', requireAuth, async (_req, res) => {
  const [rows] = await getPool().query(
    `SELECT m.id, m.content, m.done, m.created_at,
            COALESCE(u.display_name, '') AS created_by_name
       FROM memos m LEFT JOIN users u ON u.id = m.created_by
      ORDER BY m.done ASC, m.id DESC LIMIT 100`
  );
  res.json(rows);
});

app.post('/api/memos', requireAuth, async (req, res) => {
  const content = (req.body?.content || '').toString().trim();
  if (!content) return res.status(400).json({ error: 'content-required' });
  if (content.length > 500) return res.status(400).json({ error: 'too-long' });
  const [r] = await getPool().query(
    'INSERT INTO memos (content, created_by) VALUES (?, ?)', [content, req.user.id]
  );
  res.json({ id: r.insertId, content, done: 0, created_by_name: req.user.display_name });
});

app.patch('/api/memos/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
  const done = req.body?.done ? 1 : 0;
  await getPool().query('UPDATE memos SET done = ? WHERE id = ?', [done, id]);
  res.json({ ok: true });
});

app.delete('/api/memos/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
  await getPool().query('DELETE FROM memos WHERE id = ?', [id]);
  res.json({ ok: true });
});

// ---------- 띠별운세 ----------
const ZODIAC = ['원숭이','닭','개','돼지','쥐','소','호랑이','토끼','용','뱀','말','양'];
// 기준: AD 0년 = 원숭이년 기준 (year % 12 매핑) → 2024 = (2024 % 12 = 8) = 용 ✓
function zodiacOf(year) {
  if (!year) return null;
  const i = ((year % 12) + 12) % 12;
  return ZODIAC[i];
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
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - start) / 86400000);
}

app.get('/api/zodiac', requireAuth, async (_req, res) => {
  const [rows] = await getPool().query(
    `SELECT id, display_name, birth_year, birth_month, birth_day
       FROM users WHERE birth_year IS NOT NULL
       ORDER BY role DESC, id ASC`
  );
  const doy = dayOfYear();
  const out = rows.map((u) => {
    const z = zodiacOf(u.birth_year);
    const pool = FORTUNE[z] || [];
    const fortune = pool.length ? pool[(doy + u.id) % pool.length] : '좋은 하루 되세요';
    return { name: u.display_name, year: u.birth_year, zodiac: z, fortune };
  });
  res.json(out);
});

// ---------- 곧 다가오는 생일 (인증 필요) ----------
app.get('/api/birthdays/soon', requireAuth, async (_req, res) => {
  const [rows] = await getPool().query(
    `SELECT id, display_name, birth_month, birth_day, is_lunar
       FROM users WHERE birth_month IS NOT NULL AND birth_day IS NOT NULL`
  );
  const today = new Date();
  const todayKey = `${today.getMonth() + 1}-${today.getDate()}`;
  const within7 = [];
  let todayMatch = null;
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
  let target = new Date(y, m - 1, d);
  const todayMid = new Date(y, now.getMonth(), now.getDate());
  if (target < todayMid) target = new Date(y + 1, m - 1, d);
  return Math.round((target - todayMid) / 86400000);
}

// ---------- 정적 서빙 ----------
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  maxAge: '1h',
  setHeaders: (res, p) => {
    // 테스트 중: SW / HTML / app.js 는 캐싱 금지 (Cloudflare 우회)
    if (p.endsWith('service-worker.js') || p.endsWith('index.html') || p.endsWith('app.js')) {
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  },
}));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------- 부팅 ----------
const PORT = Number(process.env.PORT || 3003);
(async () => {
  try {
    await ensureSchema();
    console.log('[db] schema ready');
    await bootstrapAdmin();
  } catch (e) {
    console.warn('[db] init failed (continuing):', e.message);
  }
  app.listen(PORT, () => console.log(`familyboard listening on :${PORT}`));
})();
