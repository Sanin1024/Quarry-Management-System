'use strict';
const dbModule = require('../db');
const db = dbModule.init();

console.log('--- Checking Database State ---');

// 1. Check Quarry Names
const quarries = db.prepare('SELECT * FROM quarries').all();
console.log('\nQuarries in Database:');
quarries.forEach(q => console.log(`ID: ${q.id}, Name: ${q.name}`));

// 2. Check Report Distribution
console.log('\nReport Distribution:');
const dist = db.prepare('SELECT quarry_id, COUNT(*) as count, MIN(week_from) as first_week, MAX(week_from) as last_week FROM weekly_reports GROUP BY quarry_id').all();
dist.forEach(d => console.log(`Quarry ID: ${d.quarry_id} | Reports: ${d.count} | Date Range: ${d.first_week} to ${d.last_week}`));

if (dist.length === 1 && dist[0].quarry_id === 1) {
  console.log('\n[ISSUE FOUND] All reports are still attached to Quarry 1! Forcing move to Quarry 2 now...');
  const moveRes = db.prepare("UPDATE weekly_reports SET quarry_id = 2 WHERE week_from >= '2026-06-01'").run();
  console.log(`✅ Moved ${moveRes.changes} reports to Quarry 2.`);
  
  const newDist = db.prepare('SELECT quarry_id, COUNT(*) as count FROM weekly_reports GROUP BY quarry_id').all();
  console.log('\nNew Report Distribution:');
  newDist.forEach(d => console.log(`Quarry ID: ${d.quarry_id} | Reports: ${d.count}`));
}

db.close();