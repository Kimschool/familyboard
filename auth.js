const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('./db');

const TOKEN_TTL_DAYS = 30;

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) throw new Error('JWT_SECRET is not set or too short');
  return s;
}

async function bootstrapAdmin() {
  const [rows] = await getPool().query("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'");
  if (rows[0].c > 0) return;

  const username = (process.env.ADMIN_USERNAME || 'admin').trim();
  const password = process.env.ADMIN_PASSWORD;
  const display  = (process.env.ADMIN_DISPLAY_NAME || '관리자').trim();
  if (!password) {
    console.warn('[auth] ADMIN_PASSWORD not set — admin account not bootstrapped');
    return;
  }
  const hash = bcrypt.hashSync(password, 10);
  await getPool().query(
    'INSERT INTO users (username, display_name, role, password_hash) VALUES (?, ?, ?, ?)',
    [username, display, 'admin', hash]
  );
  console.log(`[auth] admin account created: ${username}`);
}

async function login(username, password) {
  username = (username || '').trim();
  if (!username || !password) return null;
  const [rows] = await getPool().query(
    'SELECT id, username, display_name, role, password_hash FROM users WHERE username = ? LIMIT 1',
    [username]
  );
  if (!rows.length) return null;
  const u = rows[0];
  if (!bcrypt.compareSync(password, u.password_hash)) return null;

  const token = jwt.sign({ uid: u.id, un: u.username }, getSecret(), {
    expiresIn: `${TOKEN_TTL_DAYS}d`,
  });
  const expires = new Date(Date.now() + TOKEN_TTL_DAYS * 86400_000);
  await getPool().query(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
    [token, u.id, expires]
  );
  return { token, user: publicUser(u) };
}

async function logout(token) {
  if (!token) return;
  await getPool().query('DELETE FROM sessions WHERE token = ?', [token]).catch(() => {});
}

async function verify(token) {
  if (!token) return null;
  try { jwt.verify(token, getSecret()); } catch { return null; }

  const [rows] = await getPool().query(
    `SELECT u.id, u.username, u.display_name, u.role, u.birth_year, u.birth_month, u.birth_day, u.is_lunar
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > NOW() LIMIT 1`,
    [token]
  );
  return rows.length ? rows[0] : null;
}

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    role: u.role,
    birthYear: u.birth_year ?? null,
    birthMonth: u.birth_month ?? null,
    birthDay: u.birth_day ?? null,
    isLunar: !!u.is_lunar,
  };
}

function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : req.cookies?.fb_token;
  verify(token).then((u) => {
    if (!u) return res.status(401).json({ error: 'unauthorized' });
    req.user = u;
    next();
  }).catch(() => res.status(401).json({ error: 'unauthorized' }));
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
    next();
  });
}

module.exports = { bootstrapAdmin, login, logout, verify, requireAuth, requireAdmin, publicUser };
