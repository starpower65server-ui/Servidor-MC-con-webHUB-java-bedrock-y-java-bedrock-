const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'mcmanager.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let db = null;

/**
 * Initialize the database. Must be called before any queries.
 */
async function initDb() {
  const SQL = await initSqlJs();

  // Load existing DB or create new one
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      version TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'vanilla',
      edition TEXT NOT NULL DEFAULT 'java',
      port INTEGER NOT NULL,
      path TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'offline',
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Migration: add edition column to existing databases that don't have it
  try {
    db.run(`ALTER TABLE servers ADD COLUMN edition TEXT NOT NULL DEFAULT 'java'`);
    console.log('[DB] Migration: added edition column to servers table');
  } catch (e) {
    // Column already exists — ignore
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Auto-seed default admin account if no users exist
  const userCount = db.prepare("SELECT COUNT(*) as count FROM users");
  let count = 0;
  if (userCount.step()) {
    count = userCount.getAsObject().count;
  }
  userCount.free();

  if (count === 0) {
    const crypto = require('crypto');
    const adminId = crypto.randomUUID();
    const passwordHash = crypto.createHash('sha256').update('admin').digest('hex');
    db.run("INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)", [adminId, 'admin', passwordHash, 'admin']);
    console.log('[Auth] Initialized default admin account (admin / admin)');
  }

  save();
  return db;
}

/**
 * Save database to disk.
 */
function save() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

/**
 * Run a SQL statement (INSERT, UPDATE, DELETE).
 */
function run(sql, params = []) {
  db.run(sql, params);
  save();
}

/**
 * Get a single row.
 */
function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

/**
 * Get all rows.
 */
function all(sql, params = []) {
  const results = [];
  const stmt = db.prepare(sql);
  stmt.bind(params);
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

/**
 * Get a setting value by key.
 */
function getSetting(key, defaultValue = null) {
  const row = get('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : defaultValue;
}

/**
 * Set or update a setting value.
 */
function setSetting(key, value) {
  run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
}

module.exports = { initDb, run, get, all, save, getSetting, setSetting };
