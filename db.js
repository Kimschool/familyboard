const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

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
    CREATE TABLE IF NOT EXISTS families (
      id INT AUTO_INCREMENT PRIMARY KEY,
      alias VARCHAR(50) NOT NULL UNIQUE,
      display_name VARCHAR(100) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      family_id INT NOT NULL,
      username VARCHAR(50) NOT NULL,
      display_name VARCHAR(50) NOT NULL,
      role ENUM('admin','member') NOT NULL DEFAULT 'member',
      icon VARCHAR(30) NOT NULL DEFAULT 'star',
      password_hash VARCHAR(255) NULL,
      invite_token VARCHAR(100) NULL,
      invite_expires_at DATETIME NULL,
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
      family_id INT NOT NULL,
      content VARCHAR(500) NOT NULL,
      done TINYINT(1) NOT NULL DEFAULT 0,
      created_by INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_memos_family (family_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token VARCHAR(512) PRIMARY KEY,
      user_id INT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      INDEX idx_user (user_id),
      INDEX idx_exp (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ---------- 마이그레이션 (기존 users → 새 스키마) ----------
  await ensureColumn('users', 'family_id', 'INT NULL');
  await ensureColumn('users', 'icon', "VARCHAR(30) NOT NULL DEFAULT 'star'");
  await ensureColumn('users', 'invite_token', 'VARCHAR(100) NULL');
  await ensureColumn('users', 'invite_expires_at', 'DATETIME NULL');
  await changeColumn('users', 'password_hash', 'VARCHAR(255) NULL'); // 초대대기 허용
  await ensureColumn('memos', 'family_id', 'INT NULL');
  await ensureColumn('memos', 'important', 'TINYINT(1) NOT NULL DEFAULT 0');
  await ensureColumn('users', 'mood', 'VARCHAR(20) NULL');
  await ensureColumn('users', 'mood_date', 'DATE NULL');
  await ensureColumn('users', 'phone', 'VARCHAR(30) NULL');
  await ensureColumn('families', 'notice', 'VARCHAR(500) NULL');
  await ensureColumn('families', 'notice_updated_at', 'DATETIME NULL');
  await ensureColumn('families', 'notice_updated_by', 'INT NULL');

  await p.query(`
    CREATE TABLE IF NOT EXISTS birthday_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      family_id INT NOT NULL,
      target_user_id INT NOT NULL,
      author_user_id INT NOT NULL,
      message VARCHAR(500) NOT NULL,
      year INT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_year_target_author (year, target_user_id, author_user_id),
      INDEX idx_target_year (target_user_id, year),
      INDEX idx_family (family_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS emergency_contacts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      family_id INT NOT NULL,
      name VARCHAR(50) NOT NULL,
      phone VARCHAR(30) NOT NULL,
      icon VARCHAR(30) NOT NULL DEFAULT 'heart',
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_family_sort (family_id, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS answer_reactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      answer_id INT NOT NULL,
      user_id INT NOT NULL,
      emoji VARCHAR(10) NOT NULL DEFAULT '❤️',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_answer (answer_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  // 기존 하트 전용 → 이모지 포함 버전 업그레이드
  await ensureColumn('answer_reactions', 'emoji', "VARCHAR(10) NOT NULL DEFAULT '❤️'");
  await dropIndexIfExists('answer_reactions', 'uq_answer_user');
  await ensureUniqueIndex('answer_reactions', 'uq_ans_user_emoji', ['answer_id', 'user_id', 'emoji']);

  // 기본 가족 보장
  const [f] = await p.query('SELECT id FROM families LIMIT 1');
  let defaultFamilyId;
  if (f.length === 0) {
    const alias = (process.env.ADMIN_FAMILY_ALIAS || 'family').trim();
    const displayName = (process.env.ADMIN_FAMILY_NAME || '우리 가족').trim();
    const [r] = await p.query(
      'INSERT INTO families (alias, display_name) VALUES (?, ?)',
      [alias, displayName]
    );
    defaultFamilyId = r.insertId;
    console.log(`[db] default family created: ${alias} (#${defaultFamilyId})`);
  } else {
    defaultFamilyId = f[0].id;
  }

  // family_id 가 null 인 레거시 row 들을 기본 가족에 편입
  await p.query('UPDATE users SET family_id = ? WHERE family_id IS NULL', [defaultFamilyId]);
  await p.query('UPDATE memos SET family_id = ? WHERE family_id IS NULL', [defaultFamilyId]);

  // 인덱스 재조정: 레거시 UNIQUE(username) 있으면 제거, (family_id, username) UNIQUE 보장
  await dropIndexIfExists('users', 'username');
  await ensureUniqueIndex('users', 'uniq_family_username', ['family_id', 'username']);
  await ensureUniqueIndex('users', 'uniq_family_display',  ['family_id', 'display_name']);
  await ensureIndex('users', 'idx_invite', ['invite_token']);

  // family_id NOT NULL 강제
  await changeColumn('users', 'family_id', 'INT NOT NULL');
  await changeColumn('memos', 'family_id', 'INT NOT NULL');

  // 레거시 birthdays 제거
  await dropLegacyTable('birthdays');

  // ---------- 오늘의 질문 ----------
  await p.query(`
    CREATE TABLE IF NOT EXISTS daily_questions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      family_id INT NOT NULL,
      question_date DATE NOT NULL,
      question_text VARCHAR(300) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_family_date (family_id, question_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS daily_answers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      question_id INT NOT NULL,
      user_id INT NOT NULL,
      answer_text VARCHAR(1000) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_question_user (question_id, user_id),
      INDEX idx_question (question_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ---------- 1회성 마이그레이션 ----------
  await p.query(`
    CREATE TABLE IF NOT EXISTS migrations_applied (
      name VARCHAR(100) PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await runOnceMigrations();

  // 레거시 sessions 컬럼 (user_key) 감지 시 재생성
  const [sc] = await p.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE table_schema = DATABASE() AND table_name = 'sessions'`
  );
  const cols = new Set(sc.map(r => (r.COLUMN_NAME || r.column_name).toLowerCase()));
  if (cols.has('user_key') && !cols.has('user_id')) {
    await p.query('DROP TABLE sessions');
    await p.query(`
      CREATE TABLE sessions (
        token VARCHAR(512) PRIMARY KEY,
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

async function changeColumn(table, column, definition) {
  const [rows] = await getPool().query(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column]
  );
  if (rows[0].c > 0) {
    await getPool().query(`ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ${definition}`);
  }
}

async function dropIndexIfExists(table, indexName) {
  const [rows] = await getPool().query(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.STATISTICS
      WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [table, indexName]
  );
  if (rows[0].c > 0) {
    await getPool().query(`ALTER TABLE \`${table}\` DROP INDEX \`${indexName}\``);
  }
}

async function ensureUniqueIndex(table, indexName, columns) {
  const [rows] = await getPool().query(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.STATISTICS
      WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [table, indexName]
  );
  if (rows[0].c === 0) {
    const cols = columns.map((c) => `\`${c}\``).join(', ');
    await getPool().query(`ALTER TABLE \`${table}\` ADD UNIQUE INDEX \`${indexName}\` (${cols})`);
  }
}

async function ensureIndex(table, indexName, columns) {
  const [rows] = await getPool().query(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.STATISTICS
      WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [table, indexName]
  );
  if (rows[0].c === 0) {
    const cols = columns.map((c) => `\`${c}\``).join(', ');
    await getPool().query(`ALTER TABLE \`${table}\` ADD INDEX \`${indexName}\` (${cols})`);
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

async function runOnceMigrations() {
  const p = getPool();
  const [rows] = await p.query('SELECT name FROM migrations_applied');
  const applied = new Set(rows.map(r => r.name));

  // 1) star 아이콘 일괄 다변화 (기존 사용자)
  if (!applied.has('2026_vary_icons')) {
    await p.query(`
      UPDATE users SET icon = CASE
        WHEN display_name LIKE '%외할아버지%' THEN 'grandpaOut'
        WHEN display_name LIKE '%외할머니%'  THEN 'grandmaOut'
        WHEN display_name LIKE '%할아버지%'  THEN 'grandpa'
        WHEN display_name LIKE '%할머니%'    THEN 'grandma'
        WHEN display_name LIKE '%엄마%'      THEN 'mom'
        WHEN display_name LIKE '%아빠%'      THEN 'dad'
        WHEN username = 'jeonghwa'           THEN 'grandma'
        WHEN username = 'hyunjoo'            THEN 'aunt'
        WHEN username = 'mari'               THEN 'daughter'
        WHEN display_name LIKE '%마리%'      THEN 'daughter'
        WHEN username LIKE '%bidan%' OR display_name LIKE '%비단%' THEN 'dog'
        WHEN (id % 8) = 0 THEN 'smile'
        WHEN (id % 8) = 1 THEN 'love'
        WHEN (id % 8) = 2 THEN 'flower'
        WHEN (id % 8) = 3 THEN 'cool'
        WHEN (id % 8) = 4 THEN 'angel'
        WHEN (id % 8) = 5 THEN 'heart'
        WHEN (id % 8) = 6 THEN 'sun'
        ELSE 'rainbow'
      END WHERE icon = 'star'
    `);
    await p.query("INSERT INTO migrations_applied (name) VALUES ('2026_vary_icons')");
    console.log('[migration] 2026_vary_icons applied');
  }

  // 2) jeonghwa / hyunjoo admin 승격 + 비번 12345, admin 계정 삭제
  if (!applied.has('2026_reassign_admin')) {
    const hash = bcrypt.hashSync('12345', 10);
    await p.query(
      `UPDATE users SET role = 'admin', password_hash = ?, invite_token = NULL, invite_expires_at = NULL
         WHERE username IN ('jeonghwa', 'hyunjoo')`,
      [hash]
    );
    const [promoted] = await p.query(
      `SELECT COUNT(*) AS c FROM users WHERE username IN ('jeonghwa','hyunjoo') AND role = 'admin'`
    );
    if (promoted[0].c >= 1) {
      const [adminRows] = await p.query("SELECT id FROM users WHERE username = 'admin' LIMIT 1");
      if (adminRows.length) {
        await p.query('DELETE FROM sessions WHERE user_id = ?', [adminRows[0].id]);
        await p.query('DELETE FROM users WHERE id = ?', [adminRows[0].id]);
      }
    }
    await p.query("INSERT INTO migrations_applied (name) VALUES ('2026_reassign_admin')");
    console.log('[migration] 2026_reassign_admin applied');
  }
}

module.exports = { getPool, ensureSchema };
