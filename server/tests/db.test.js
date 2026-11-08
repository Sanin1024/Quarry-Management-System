'use strict';
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Database = require('better-sqlite3');
const dbModule = require('../db');

let tmpRoot;
let activeDb = null;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qrm-test-'));
  Object.defineProperty(dbModule, 'DATA_DIR', { value: tmpRoot, writable: true, configurable: true });
});

afterEach(() => {
  if (activeDb) {
    try { activeDb.close(); } catch {}
    activeDb = null;
  }
  for (const f of fs.readdirSync(tmpRoot)) {
    try { fs.unlinkSync(path.join(tmpRoot, f)); } catch {}
  }
  try { fs.rmdirSync(tmpRoot); } catch {}
});

function freshDb() {
  const dbPath = path.join(tmpRoot, 'test.db');
  activeDb = new Database(dbPath);
  const db = activeDb;
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  dbModule.createSchema(db);
  dbModule.seedData(db);
  return db;
}

test('Seed rates are inserted on first init', () => {
  const db = freshDb();
  const rows = db.prepare('SELECT product, rate_paise, effective_from FROM rate_history ORDER BY product').all();
  assert.deepEqual(rows.map(r => ({ product: r.product, rate_paise: r.rate_paise })), [
    { product: 'broken_load', rate_paise: 85000 },
    { product: 'first_quality', rate_paise: 3800 },
    { product: 'second_quality', rate_paise: 2800 }
  ]);
});

test('getEffectiveRates picks the latest rate on or before week_from', () => {
  const db = freshDb();
  db.prepare(`INSERT INTO rate_history (product, rate_paise, effective_from, created_at, note) VALUES ('first_quality', 4200, '2026-06-01', ?, 'price rise')`).run(new Date().toISOString());
  const before = dbModule.getEffectiveRates(db, 1, '2026-05-15');
  const after  = dbModule.getEffectiveRates(db, 1, '2026-06-01');
  assert.equal(before.first_quality.rate_paise, 3800);
  assert.equal(after.first_quality.rate_paise, 4200);
});

test('Changing a rate does not affect an already-saved report', () => {
  const db = freshDb();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO weekly_reports (quarry_id, week_from, week_to, working_days, labourers_count, labour_payment_paise, diesel_paise, spare_parts_paise, fitting_paise, jcb_paise, cutting_wheel_paise, mess_paise, other_paise, first_qty, second_qty, broken_loads, first_rate_paise, second_rate_paise, broken_rate_paise, land_lease_paise, received_paise, remarks, first_revenue_paise, second_revenue_paise, broken_revenue_paise, total_revenue_paise, total_expenses_paise, net_value_paise, short_amount_paise, created_at, updated_at) VALUES (1, '2026-11-03','2026-11-08', 6, 10, 6000000, 2500000, 800000, 300000, 1200000, 600000, 900000, 200000, 12000, 5000, 20, 3800, 2800, 85000, 5000000, 40000000, '', 45600000, 14000000, 1700000, 61300000, 12500000, 43800000, 3800000, ?, ?)`).run(now, now);
  db.prepare(`INSERT INTO rate_history (product, rate_paise, effective_from, created_at, note) VALUES ('first_quality', 9999, '2026-11-10', ?, 'huge rise')`).run(now);
  const r = db.prepare('SELECT first_rate_paise, first_revenue_paise FROM weekly_reports WHERE id = 1').get();
  assert.equal(r.first_rate_paise, 3800);
  assert.equal(r.first_revenue_paise, 45600000);
});