'use strict';
const dbModule = require('../db');
const db = dbModule.init();

const today = new Date().toISOString().split('T')[0];
const ratesToAdd = [
  { product: 'first_quality',  rate_paise: 4200,   effective_from: today },
  { product: 'second_quality', rate_paise: 3100,   effective_from: today },
  { product: 'broken_load',    rate_paise: 110000, effective_from: today },
];

// Apply to both Main Quarry (1) and Second Quarry (2)
const quarryIds = [1, 2];

const deleteStmt = db.prepare('DELETE FROM rate_history WHERE quarry_id = ? AND product = ? AND effective_from = ?');
const insertStmt = db.prepare('INSERT INTO rate_history (quarry_id, product, rate_paise, effective_from, created_at, note) VALUES (?, ?, ?, ?, ?, ?)');

const tx = db.transaction(() => {
  for (const qId of quarryIds) {
    for (const r of ratesToAdd) {
      // Remove any existing rate for today to avoid duplicates, then insert
      deleteStmt.run(qId, r.product, r.effective_from);
      insertStmt.run(qId, r.product, r.rate_paise, r.effective_from, new Date().toISOString(), 'Current active price update');
      console.log(`Set [Quarry ${qId}] ${r.product} to ${r.rate_paise/100} effective ${today}`);
    }
  }
});

tx();
db.close();