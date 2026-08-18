/**
 * SQLite 数据库初始化与连接
 * 使用 Node 22 内置的 node:sqlite 模块(无需原生编译)
 */
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'app.db');

let db: DatabaseSync;

function getDb(): DatabaseSync {
  if (db) return db;
  // 确保 data 目录存在
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  initSchema(db);
  return db;
}

function initSchema(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT '学生',
      streak_days INTEGER DEFAULT 0,
      last_active TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS knowledge_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      chapter TEXT NOT NULL,
      grade INTEGER NOT NULL,
      subject TEXT NOT NULL DEFAULT 'math'
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      answer TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'fill',
      options TEXT,
      knowledge_points TEXT,
      tags TEXT,
      subject TEXT NOT NULL DEFAULT 'math'
    );

    CREATE TABLE IF NOT EXISTS solution_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      question_id INTEGER,
      question_text TEXT NOT NULL,
      steps TEXT NOT NULL,
      is_correct INTEGER DEFAULT 0,
      subject TEXT NOT NULL DEFAULT 'math',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS error_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      question TEXT NOT NULL,
      student_steps TEXT NOT NULL,
      diagnosis_type TEXT NOT NULL,
      core_error TEXT NOT NULL,
      guidance TEXT,
      knowledge_points TEXT,
      tags TEXT,
      subject TEXT NOT NULL DEFAULT 'math',
      mastery INTEGER DEFAULT 50,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      subject TEXT NOT NULL DEFAULT 'math',
      UNIQUE(name, subject)
    );

    CREATE TABLE IF NOT EXISTS student_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      weight INTEGER DEFAULT 50,
      error_count INTEGER DEFAULT 1,
      last_updated TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (tag_id) REFERENCES tags(id),
      UNIQUE(student_id, tag_id)
    );

    CREATE INDEX IF NOT EXISTS idx_error_student ON error_records(student_id);
    CREATE INDEX IF NOT EXISTS idx_student_tags ON student_tags(student_id, tag_id);
  `);

  // 迁移:为已存在的旧表补充 subject 列(必须在依赖 subject 列的索引之前执行)
  migrateAddSubject(database);

  // 迁移:为 error_records 表补充 reasoning 和 error_step 列(让错题本展示AI识别错误的推理过程与出错步骤)
  migrateAddReasoningAndErrorStep(database);

  // subject 相关索引(迁移完成后再创建,避免旧表无该列时报错)
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject);
    CREATE INDEX IF NOT EXISTS idx_error_subject ON error_records(subject);
  `);
}

// 为 error_records 表补充 reasoning(AI推理过程)和 error_step(出错步骤号)列
function migrateAddReasoningAndErrorStep(database: DatabaseSync) {
  if (!columnExists(database, 'error_records', 'reasoning')) {
    database.exec(`ALTER TABLE error_records ADD COLUMN reasoning TEXT`);
  }
  if (!columnExists(database, 'error_records', 'error_step')) {
    database.exec(`ALTER TABLE error_records ADD COLUMN error_step INTEGER`);
  }
}

// 检查列是否存在
function columnExists(database: DatabaseSync, table: string, col: string): boolean {
  const rows = database.prepare(`PRAGMA table_info(${table})`).all() as any[];
  return rows.some(r => r.name === col);
}

// 为旧表补充 subject 列(已有数据库兼容)
function migrateAddSubject(database: DatabaseSync) {
  const tables = ['knowledge_points', 'questions', 'solution_records', 'error_records', 'tags'];
  for (const t of tables) {
    if (!columnExists(database, t, 'subject')) {
      database.exec(`ALTER TABLE ${t} ADD COLUMN subject TEXT NOT NULL DEFAULT 'math'`);
    }
  }
  // 旧 tags 表唯一约束是 name UNIQUE,需重建为 UNIQUE(name, subject) 以支持跨学科同名标签
  rebuildTagsTable(database);
}

// 重建 tags 表:将单列唯一约束升级为 (name, subject) 联合唯一
function rebuildTagsTable(database: DatabaseSync) {
  const row = database.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='tags'").get() as { sql: string } | undefined;
  if (!row || !row.sql) return;
  // 仅当旧表仍是单列 name UNIQUE(不含 subject 联合唯一)时重建
  if (row.sql.includes('UNIQUE(name)') || (row.sql.includes('name TEXT UNIQUE') && !row.sql.includes('UNIQUE(name, subject)'))) {
    // 临时关闭外键检查:DROP TABLE tags 时 SQLite 会隐式 DELETE 全部行,
    // 若 student_tags 仍引用这些 tag 会触发 FK 约束失败。
    // PRAGMA foreign_keys 不能在事务内切换,node:sqlite 默认 autocommit 故可安全切换。
    database.exec('PRAGMA foreign_keys = OFF');
    try {
      database.exec(`
        CREATE TABLE IF NOT EXISTS tags_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          subject TEXT NOT NULL DEFAULT 'math',
          UNIQUE(name, subject)
        );
        INSERT OR IGNORE INTO tags_new (id, name, subject)
          SELECT id, name, COALESCE(subject, 'math') FROM tags;
        DROP TABLE tags;
        ALTER TABLE tags_new RENAME TO tags;
      `);
    } finally {
      database.exec('PRAGMA foreign_keys = ON');
    }
  }
}

// 确保存在默认学生,返回学生 id
export function ensureDefaultStudent(): number {
  const database = getDb();
  let row = database.prepare('SELECT id FROM students WHERE id = 1').get() as { id: number } | undefined;
  if (!row) {
    const info = database.prepare('INSERT INTO students (id, name) VALUES (1, ?)').run('学生');
    return Number(info.lastInsertRowid);
  }
  return row.id;
}

// 事务辅助(node:sqlite 无内置 transaction 方法)
export function transaction<T>(fn: () => T): T {
  const database = getDb();
  database.exec('BEGIN');
  try {
    const result = fn();
    database.exec('COMMIT');
    return result;
  } catch (err) {
    database.exec('ROLLBACK');
    throw err;
  }
}

export { getDb };
