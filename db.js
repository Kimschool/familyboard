const mysql = require('mysql2/promise');

let pool = null;

function getPool() {
  if (pool) return pool;
  pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3307),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
  });
  return pool;
}

async function ensureSchema() {
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS memos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      content VARCHAR(500) NOT NULL,
      done TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS birthdays (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      month TINYINT NOT NULL,
      day TINYINT NOT NULL,
      is_lunar TINYINT(1) NOT NULL DEFAULT 0,
      note VARCHAR(200) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token VARCHAR(255) PRIMARY KEY,
      user_key VARCHAR(50) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

module.exports = { getPool, ensureSchema };
