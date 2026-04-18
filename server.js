require('dotenv').config();
const express = require('express');
const path = require('path');
const { ensureSchema, getPool } = require('./db');
const { login, verify, requireAuth } = require('./auth');

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
  const pw = (req.body?.password || '').toString();
  const token = await login(pw);
  if (!token) return res.status(401).json({ error: 'invalid' });
  res.setHeader('Set-Cookie', `fb_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 86400}`);
  res.json({ ok: true });
});

app.get('/api/me', async (req, res) => {
  const token = req.cookies?.fb_token;
  const u = await verify(token);
  res.json({ authed: !!u });
});

app.post('/api/logout', (_req, res) => {
  res.setHeader('Set-Cookie', 'fb_token=; Path=/; Max-Age=0');
  res.json({ ok: true });
});

// ---------- 날씨 (Open-Meteo, 무료/키없음) ----------
app.get('/api/weather', async (_req, res) => {
  try {
    const lat = process.env.DEFAULT_LAT || '37.5665';
    const lon = process.env.DEFAULT_LON || '126.9780';
    const key = `weather:${lat},${lon}`;
    const cached = cacheGet(key, 10 * 60 * 1000);
    if (cached) return res.json(cached);

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
      `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max` +
      `&timezone=Asia%2FSeoul&forecast_days=1`;
    const r = await fetch(url);
    const j = await r.json();

    const out = {
      city: process.env.DEFAULT_CITY || '서울',
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

// ---------- 대기질 (Open-Meteo Air Quality) ----------
app.get('/api/air', async (_req, res) => {
  try {
    const lat = process.env.DEFAULT_LAT || '37.5665';
    const lon = process.env.DEFAULT_LON || '126.9780';
    const key = `air:${lat},${lon}`;
    const cached = cacheGet(key, 30 * 60 * 1000);
    if (cached) return res.json(cached);

    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
      `&current=pm10,pm2_5,alder_pollen,birch_pollen,grass_pollen&timezone=Asia%2FSeoul`;
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
      pm10,
      pm25,
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

// ---------- 환율 (open.er-api.com, 무료/키없음) ----------
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
      jpyKrw: Math.round((krw / jpy) * 100 * 100) / 100, // 100엔 기준
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
    'SELECT id, content, done, created_at FROM memos ORDER BY done ASC, id DESC LIMIT 50'
  );
  res.json(rows);
});

app.post('/api/memos', requireAuth, async (req, res) => {
  const content = (req.body?.content || '').toString().trim();
  if (!content) return res.status(400).json({ error: 'content-required' });
  if (content.length > 500) return res.status(400).json({ error: 'too-long' });
  const [r] = await getPool().query('INSERT INTO memos (content) VALUES (?)', [content]);
  res.json({ id: r.insertId, content, done: 0 });
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

// ---------- 생일 CRUD ----------
app.get('/api/birthdays', requireAuth, async (_req, res) => {
  const [rows] = await getPool().query(
    'SELECT id, name, month, day, is_lunar, note FROM birthdays ORDER BY month, day'
  );
  res.json(rows);
});

app.post('/api/birthdays', requireAuth, async (req, res) => {
  const name = (req.body?.name || '').toString().trim();
  const month = Number(req.body?.month);
  const day = Number(req.body?.day);
  const is_lunar = req.body?.is_lunar ? 1 : 0;
  const note = (req.body?.note || '').toString().trim() || null;
  if (!name || !(month >= 1 && month <= 12) || !(day >= 1 && day <= 31)) {
    return res.status(400).json({ error: 'bad-input' });
  }
  const [r] = await getPool().query(
    'INSERT INTO birthdays (name, month, day, is_lunar, note) VALUES (?, ?, ?, ?, ?)',
    [name, month, day, is_lunar, note]
  );
  res.json({ id: r.insertId });
});

app.delete('/api/birthdays/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad-id' });
  await getPool().query('DELETE FROM birthdays WHERE id = ?', [id]);
  res.json({ ok: true });
});

// "오늘/곧 다가오는" 생일 (인증 없이도 볼 수 있게 — 배너용)
app.get('/api/birthdays/soon', async (_req, res) => {
  try {
    const [rows] = await getPool().query(
      'SELECT name, month, day, is_lunar, note FROM birthdays'
    );
    const today = new Date();
    const todayKey = `${today.getMonth() + 1}-${today.getDate()}`;
    const within7 = [];
    let todayMatch = null;
    for (const r of rows) {
      const k = `${r.month}-${r.day}`;
      if (k === todayKey) todayMatch = r;
      const daysLeft = daysUntil(r.month, r.day);
      if (daysLeft > 0 && daysLeft <= 7) within7.push({ ...r, daysLeft });
    }
    within7.sort((a, b) => a.daysLeft - b.daysLeft);
    res.json({ today: todayMatch, upcoming: within7 });
  } catch (e) {
    res.json({ today: null, upcoming: [] });
  }
});

function daysUntil(m, d) {
  const now = new Date();
  const y = now.getFullYear();
  let target = new Date(y, m - 1, d);
  if (target < new Date(y, now.getMonth(), now.getDate())) {
    target = new Date(y + 1, m - 1, d);
  }
  const diff = target - new Date(y, now.getMonth(), now.getDate());
  return Math.round(diff / 86400000);
}

// ---------- 정적 서빙 ----------
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  maxAge: '1h',
  setHeaders: (res, p) => {
    if (p.endsWith('service-worker.js')) res.setHeader('Cache-Control', 'no-cache');
  },
}));

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------- 부팅 ----------
const PORT = Number(process.env.PORT || 3003);
(async () => {
  try {
    await ensureSchema();
    console.log('[db] schema ready');
  } catch (e) {
    console.warn('[db] schema init failed (continuing):', e.message);
  }
  app.listen(PORT, () => console.log(`familyboard listening on :${PORT}`));
})();
