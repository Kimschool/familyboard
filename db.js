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
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      display_name VARCHAR(50) NOT NULL,
      role ENUM('admin','member') NOT NULL DEFAULT 'member',
      password_hash VARCHAR(255) NOT NULL,
      birth_year INT NULL,
      birth_month TINYINT NULL,
      birth_day TINYINT NULL,
      is_lunar TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS memos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      content VARCHAR(500) NOT NULL,
      done TINYINT(1) NOT NULL DEFAULT 0,
      created_by INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token VARCHAR(255) PRIMARY KEY,
      user_id INT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      INDEX idx_user (user_id),
      INDEX idx_exp (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 이전 스키마에서 넘어온 경우를 대비한 컬럼 보정
  await ensureColumn('memos', 'created_by', 'INT NULL');
  await dropLegacyTable('birthdays'); // 초기 배포 후 users로 통합

  // 레거시 sessions 테이블 (user_key 컬럼) 감지 시 재생성
  const [sc] = await getPool().query(
    `SELECT column_name FROM INFORMATION_SCHEMA.COLUMNS
      WHERE table_schema = DATABASE() AND table_name = 'sessions'`
  );
  const cols = new Set(sc.map(r => (r.column_name || r.COLUMN_NAME).toLowerCase()));
  if (cols.has('user_key') && !cols.has('user_id')) {
    await getPool().query('DROP TABLE sessions');
    await getPool().query(`
      CREATE TABLE sessions (
        token VARCHAR(255) PRIMARY KEY,
        user_id INT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        INDEX idx_user (user_id),
        INDEX idx_exp (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }
}

async function ensureColumn(table, column, definition) {
  const [rows] = await getPool().query(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column]
  );
  if (rows[0].c === 0) {
    await getPool().query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  }
}

async function dropLegacyTable(table) {
  const [rows] = await getPool().query(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [table]
  );
  if (rows[0].c > 0) await getPool().query(`DROP TABLE \`${table}\``);
}

module.exports = { getPool, ensureSchema };
