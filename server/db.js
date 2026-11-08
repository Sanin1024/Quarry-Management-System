'use strict';
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR  = path.join(__dirname, '..', 'data');
const LOG_DIR   = path.join(__dirname, '..', 'logs');
const DB_PATH   = path.join(DATA_DIR, 'quarry.db');
const SCHEMA_VERSION = 4; // Upgraded for FK and Index migration

const SEED_RATES = [
  { product: 'first_quality',   rate_paise: 3800,  effective_from: '2000-01-01', note: 'Default seed rate' },
  { product: 'second_quality',  rate_paise: 2800,  effective_from: '2000-01-01', note: 'Default seed rate' },
  { product: 'broken_load',     rate_paise: 85000, effective_from: '2000-01-01', note: 'Default seed rate' },
];

function ensureDirs() {
  for (const dir of [DATA_DIR, LOG_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

function open() {
  ensureDirs();
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function createSchema(db) {
  // Schema includes explicit Foreign Key clauses
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL, applied_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS quarries (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rate_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT, quarry_id INTEGER NOT NULL DEFAULT 1,
      product TEXT NOT NULL, rate_paise INTEGER NOT NULL, effective_from TEXT NOT NULL, created_at TEXT NOT NULL, note TEXT,
      FOREIGN KEY (quarry_id) REFERENCES quarries(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS weekly_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT, quarry_id INTEGER NOT NULL DEFAULT 1,
      week_from TEXT NOT NULL, week_to TEXT NOT NULL, working_days INTEGER NOT NULL DEFAULT 0, labourers_count INTEGER NOT NULL DEFAULT 0,
      labour_payment_paise INTEGER NOT NULL DEFAULT 0, diesel_paise INTEGER NOT NULL DEFAULT 0, spare_parts_paise INTEGER NOT NULL DEFAULT 0, fitting_paise INTEGER NOT NULL DEFAULT 0, jcb_paise INTEGER NOT NULL DEFAULT 0, cutting_wheel_paise INTEGER NOT NULL DEFAULT 0, mess_paise INTEGER NOT NULL DEFAULT 0, other_paise INTEGER NOT NULL DEFAULT 0,
      first_qty INTEGER NOT NULL DEFAULT 0, second_qty INTEGER NOT NULL DEFAULT 0, broken_loads REAL NOT NULL DEFAULT 0,
      first_rate_paise INTEGER NOT NULL, second_rate_paise INTEGER NOT NULL, broken_rate_paise INTEGER NOT NULL,
      land_lease_paise INTEGER NOT NULL DEFAULT 0, received_paise INTEGER NOT NULL DEFAULT 0, remarks TEXT NOT NULL DEFAULT '',
      first_revenue_paise INTEGER NOT NULL DEFAULT 0, second_revenue_paise INTEGER NOT NULL DEFAULT 0, broken_revenue_paise INTEGER NOT NULL DEFAULT 0, total_revenue_paise INTEGER NOT NULL DEFAULT 0, total_expenses_paise INTEGER NOT NULL DEFAULT 0, net_value_paise INTEGER NOT NULL DEFAULT 0, short_amount_paise INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, CHECK (week_to >= week_from),
      FOREIGN KEY (quarry_id) REFERENCES quarries(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS deleted_reports (id INTEGER PRIMARY KEY AUTOINCREMENT, report_json TEXT NOT NULL, deleted_at TEXT NOT NULL, expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS daily_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, quarry_id INTEGER NOT NULL DEFAULT 1,
      log_date TEXT NOT NULL, first_qty INTEGER DEFAULT 0, second_qty INTEGER DEFAULT 0, broken_loads REAL DEFAULT 0,
      labour_payment_paise INTEGER DEFAULT 0, diesel_paise INTEGER DEFAULT 0, spare_parts_paise INTEGER DEFAULT 0, fitting_paise INTEGER DEFAULT 0, jcb_paise INTEGER DEFAULT 0, cutting_wheel_paise INTEGER DEFAULT 0, mess_paise INTEGER DEFAULT 0, other_paise INTEGER DEFAULT 0,
      remarks TEXT, created_at TEXT NOT NULL,
      FOREIGN KEY (quarry_id) REFERENCES quarries(id) ON DELETE CASCADE
    );
  `);
}

function migrateSchema(db) {
  const row = db.prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1').get();
  const currentVer = row ? row.version : 0;

  if (currentVer < 4) {
    console.log('Running migration to v4: Adding composite indexes...');
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_reports_quarry_week ON weekly_reports(quarry_id, week_from DESC);
      CREATE INDEX IF NOT EXISTS idx_weekly_reports_quarry_id ON weekly_reports(quarry_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_unique ON rate_history(quarry_id, product, effective_from);
      CREATE INDEX IF NOT EXISTS idx_daily_logs_quarry_id ON daily_logs(quarry_id);
      CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON daily_logs(log_date);
      CREATE INDEX IF NOT EXISTS idx_deleted_reports_expires ON deleted_reports(expires_at);
    `);
    db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(4, new Date().toISOString());
  }
}

function seedData(db) {
  const qCount = db.prepare('SELECT COUNT(*) AS n FROM quarries').get().n;
  if (qCount === 0) {
    const now = new Date().toISOString();
    db.prepare('INSERT INTO quarries (name, created_at) VALUES (?, ?)').run('Quarry 1', now);
    db.prepare('INSERT INTO quarries (name, created_at) VALUES (?, ?)').run('Quarry 2', now);
  }
  const rCount = db.prepare('SELECT COUNT(*) AS n FROM rate_history WHERE quarry_id = 1').get().n;
  if (rCount === 0) {
    const now = new Date().toISOString();
    const stmt = db.prepare('INSERT INTO rate_history (quarry_id, product, rate_paise, effective_from, created_at, note) VALUES (1, ?, ?, ?, ?, ?)');
    const tx = db.transaction((rows) => { for (const r of rows) stmt.run(r.product, r.rate_paise, r.effective_from, now, r.note); });
    tx(SEED_RATES);
  }
  const sCount = db.prepare("SELECT COUNT(*) AS n FROM app_settings").get().n;
  if (sCount === 0) {
    db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?)').run('default_land_lease_paise', '500000');
    db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?)').run('overlap_policy', 'warn');
  }
}

function getEffectiveRates(db, quarryId, weekFromISO) {
  // P3 FIX: Optimized N+1 query into a single window-function query
  const rows = db.prepare(`
    WITH ranked_rates AS (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY product ORDER BY effective_from DESC, id DESC) as rn
      FROM rate_history WHERE quarry_id = ? AND effective_from <= ?
    ) SELECT * FROM ranked_rates WHERE rn = 1
  `).all(quarryId, weekFromISO);

  const result = {};
  for (const row of rows) {
    result[row.product] = { rate_paise: row.rate_paise, effective_from: row.effective_from };
  }
  
  // Fallback for missing products
  const products = ['first_quality', 'second_quality', 'broken_load'];
  for (const p of products) {
    if (!result[p]) {
      const earliest = db.prepare(`SELECT rate_paise, effective_from FROM rate_history WHERE quarry_id = ? AND product = ? ORDER BY effective_from ASC, id ASC LIMIT 1`).get(quarryId, p);
      if (earliest) result[p] = { rate_paise: earliest.rate_paise, effective_from: earliest.effective_from, fallback: true };
      else result[p] = null;
    }
  }
  return result;
}

function init() {
  const db = open();
  createSchema(db);
  migrateSchema(db);
  seedData(db);
  return db;
}

module.exports = { DB_PATH, DATA_DIR, SCHEMA_VERSION, SEED_RATES, open, init, createSchema, seedData, getEffectiveRates };