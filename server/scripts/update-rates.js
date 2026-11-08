'use strict';
const dbModule = require('../db');
const db = dbModule.init();

const ratesToAdd = [
  // From 01.06.2026 to 17.08.2026
  { product: 'first_quality',  rate_paise: 4000,   effective_from: '2026-06-01', note: 'Historical rate change' },
  { product: 'second_quality', rate_paise: 3000,   effective_from: '2026-06-01', note: 'Historical rate change' },
  { product: 'broken_load',    rate_paise: 100000, effective_from: '2026-06-01', note: 'Historical rate change' },
  
  // Revised pricing from 18.08.2026
  { product: 'first_quality',  rate_paise: 4200,   effective_from: '2026-08-18', note: 'Revised pricing' },
  { product: 'second_quality', rate_paise: 3100,   effective_from: '2026-08-18', note: 'Revised pricing' },
  { product: 'broken_load',    rate_paise: 110000, effective_from: '2026-08-18', note: 'Revised pricing' },
];

const stmt = db.prepare('INSERT OR IGNORE INTO rate_history (quarry_id, product, rate_paise, effective_from, created_at, note) VALUES (1, ?, ?, ?, ?, ?)');
const tx = db.transaction(() => {
  for (const r of ratesToAdd) {
    const info = stmt.run(r.product, r.rate_paise, r.effective_from, new Date().toISOString(), r.note);
    if (info.changes > 0) console.log(`Added: ${r.product} @ ${r.rate_paise/100} effective ${r.effective_from}`);
    else console.log(`Skipped (already exists): ${r.product} effective ${r.effective_from}`);
  }
});
tx();
db.close();