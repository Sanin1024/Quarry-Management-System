'use strict';
const dbModule = require('../db');
const db = dbModule.init();

console.log('--- Forcing Database Alignment ---');

// Ensure Quarry 1 has data up to May 2026
const r1 = db.prepare("UPDATE weekly_reports SET quarry_id = 1 WHERE week_from < '2026-06-01'").run();
console.log(`Quarry 1 assigned to ${r1.changes} reports.`);

// Ensure Quarry 2 has data from June 2026 onwards
const r2 = db.prepare("UPDATE weekly_reports SET quarry_id = 2 WHERE week_from >= '2026-06-01'").run();
console.log(`Quarry 2 assigned to ${r2.changes} reports.`);

// Verify
const dist = db.prepare('SELECT quarry_id, COUNT(*) as count FROM weekly_reports GROUP BY quarry_id').all();
console.log('\nFinal Database State:');
dist.forEach(d => console.log(`Quarry ID: ${d.quarry_id} | Reports: ${d.count}`));

db.close();