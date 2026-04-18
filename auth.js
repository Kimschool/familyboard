const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getPool } = require('./db');

const TOKEN_TTL_DAYS = 30;
const INVITE_TTL_DAYS = 14;

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

  const [f] = await getPool().query('SELECT id FROM families ORDER BY id ASC LIMIT 1');
  if (!f.length) { console.warn('[auth] no family found; skip admin bootstrap'); return; }

  const hash = bcrypt.hashSync(password, 10);
  await getPool().query(
    `INSERT INTO users (family_id, username, display_name, role, icon, password_hash)
     VALUES (?, ?, ?, 'admin', 'star', ?)`,
    [f[0].id, username, display, hash]
  );
  console.log(`[auth] admin account created: ${username}`);
}

// --- login: alias + username/id + password ---
async function login({ alias, userId, username, password }) {
  password = password || '';
  alias = (alias || '').trim();
  if (!alias || !password) return null;

  const [frows] = await getPool().query('SELECT id FROM families WHERE alias = ? LIMIT 1', [alias]);
  if (!frows.length) return null;
  const familyId = frows[0].id;

  let row;
  if (userId) {
    const [r] = await getPool().query(
      'SELECT id, username, display_name, role, icon, password_hash FROM users WHERE family_id = ? AND id = ? LIMIT 1',
      [familyId, Number(userId)]
    );
    row = r[0];
  } else if (username) {
    const [r] = await getPool().query(
      'SELECT id, username, display_name, role, icon, password_hash FROM users WHERE family_id = ? AND username = ? LIMIT 1',
      [familyId, (username || '').trim()]
    );
    row = r[0];
  }
  if (!row || !row.password_hash) return null;
  if (!bcrypt.compareSync(password, row.password_hash)) return null;

  return issueToken(row.id);
}

async function issueToken(userId) {
  const jti = crypto.randomBytes(16).toString('hex');
  const token = jwt.sign({ uid: userId, jti }, getSecret(), {
    expiresIn: `${TOKEN_TTL_DAYS}d`,
  });
  const expires = new Date(Date.now() + TOKEN_TTL_DAYS * 86400_000);
  await getPool().query(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?) ' +
    'ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at)',
    [token, userId, expires]
  );
  return { token };
}

async function logout(token) {
  if (!token) return;
  await getPool().query('DELETE FROM sessions WHERE token = ?', [token]).catch(() => {});
}

async function verify(token) {
  if (!token) return null;
  try { jwt.verify(token, getSecret()); } catch { return null; }

  const [rows] = await getPool().query(
    `SELECT u.id, u.family_id, u.username, u.display_name, u.role, u.icon,
            u.birth_year, u.birth_month, u.birth_day, u.is_lunar, u.photo_url,
            f.alias AS family_alias, f.display_name AS family_name
       FROM sessions s
       JOIN users    u ON u.id = s.user_id
       JOIN families f ON f.id = u.family_id
      WHERE s.token = ? AND s.expires_at > NOW() LIMIT 1`,
    [token]
  );
  return rows.length ? rows[0] : null;
}

function publicUser(u) {
  return {
    id: u.id,
    familyId: u.family_id ?? u.familyId ?? null,
    familyAlias: u.family_alias ?? u.familyAlias ?? null,
    familyName:  u.family_name  ?? u.familyName  ?? null,
    username: u.username,
    displayName: u.display_name ?? u.displayName,
    role: u.role,
    icon: u.icon || 'star',
    birthYear:  u.birth_year  ?? u.birthYear  ?? null,
    birthMonth: u.birth_month ?? u.birthMonth ?? null,
    birthDay:   u.birth_day   ?? u.birthDay   ?? null,
    isLunar: !!(u.is_lunar ?? u.isLunar),
    photoUrl:  u.photo_url   ?? u.photoUrl   ?? null,
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

function newInviteToken() {
  return crypto.randomBytes(24).toString('base64url');
}

module.exports = {
  bootstrapAdmin, login, logout, verify, issueToken,
  requireAuth, requireAdmin, publicUser,
  newInviteToken, INVITE_TTL_DAYS,
};
