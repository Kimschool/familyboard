const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('./db');

const TOKEN_TTL_DAYS = 30;

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) throw new Error('JWT_SECRET is not set or too short');
  return s;
}

let familyHash = null;
function getFamilyHash() {
  if (familyHash) return familyHash;
  const pw = process.env.FAMILY_PASSWORD || 'family1234';
  familyHash = bcrypt.hashSync(pw, 10);
  return familyHash;
}

async function login(password) {
  const ok = bcrypt.compareSync(password || '', getFamilyHash());
  if (!ok) return null;

  const token = jwt.sign({ u: 'family' }, getSecret(), {
    expiresIn: `${TOKEN_TTL_DAYS}d`,
  });
  const expires = new Date(Date.now() + TOKEN_TTL_DAYS * 86400_000);
  await getPool().query(
    'INSERT INTO sessions (token, user_key, expires_at) VALUES (?, ?, ?)',
    [token, 'family', expires]
  );
  return token;
}

async function verify(token) {
  if (!token) return null;
  try {
    jwt.verify(token, getSecret());
  } catch {
    return null;
  }
  const [rows] = await getPool().query(
    'SELECT token FROM sessions WHERE token = ? AND expires_at > NOW()',
    [token]
  );
  return rows.length ? { u: 'family' } : null;
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

module.exports = { login, verify, requireAuth };
