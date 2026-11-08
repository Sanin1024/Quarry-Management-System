'use strict';
const dbModule = require('../db');
const db = dbModule.init();

console.log('--- Moving Reports to Quarry 2 ---');

// 1. Move all reports starting from 2026-06-01 to Quarry 2
const moveResult = db.prepare("UPDATE weekly_reports SET quarry_id = 2 WHERE week_from >= '2026-06-01' AND quarry_id = 1").run();
console.log(`✅ Moved ${moveResult.changes} reports to Quarry 2.`);

// 2. Ensure Quarry 2 has the correct rate history
const checkRate = db.prepare("SELECT id FROM rate_history WHERE quarry_id = 2").get();
if (!checkRate) {
  console.log('Seeding rate history for Quarry 2...');
  const now = new Date().toISOString();
  const rates = [
    { product: 'first_quality',  rate_paise: 4000,   effective_from: '2000-01-01', note: 'Default seed rate' },
    { product: 'second_quality', rate_paise: 3000,   effective_from: '2000-01-01', note: 'Default seed rate' },
    { product: 'broken_load',    rate_paise: 100000, effective_from: '2000-01-01', note: 'Default seed rate' },
    { product: 'first_quality',  rate_paise: 4000,   effective_from: '2026-06-01', note: 'Quarry 2 start rate' },
    { product: 'second_quality', rate_paise: 3000,   effective_from: '2026-06-01', note: 'Quarry 2 start rate' },
    { product: 'broken_load',    rate_paise: 100000, effective_from: '2026-06-01', note: 'Quarry 2 start rate' },
    { product: 'first_quality',  rate_paise: 4200,   effective_from: '2026-08-18', note: 'Revised pricing' },
    { product: 'second_quality', rate_paise: 3100,   effective_from: '2026-08-18', note: 'Revised pricing' },
    { product: 'broken_load',    rate_paise: 110000, effective_from: '2026-08-18', note: 'Revised pricing' },
  ];
  const stmt = db.prepare('INSERT OR IGNORE INTO rate_history (quarry_id, product, rate_paise, effective_from, created_at, note) VALUES (2, ?, ?, ?, ?, ?)');
  const tx = db.transaction(() => { for (const r of rates) stmt.run(r.product, r.rate_paise, r.effective_from, now, r.note); });
  tx();
  console.log('✅ Rate history created for Quarry 2.');
} else {
  console.log('Quarry 2 already has rate history. Skipping seed.');
}

db.close();