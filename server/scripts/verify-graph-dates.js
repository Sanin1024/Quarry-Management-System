'use strict';
const dbModule = require('../db');
const db = dbModule.init();

console.log('--- Verifying Graph X-Axis Dates ---\n');

// Fetch reports exactly as the API does for the dashboard
const reports = db.prepare('SELECT id, quarry_id, week_from, week_to FROM weekly_reports ORDER BY week_from DESC').all();

// Reverse them to chronological order (exactly like the frontend does for the graph)
const chrono = [...reports].reverse();

let lastDate = null;
let errors = 0;

console.log('Order | Graph Label (DD-MM-YYYY) | Actual Week Span');
console.log('----------------------------------------------------');

for (let i = 0; i < chrono.length; i++) {
  const r = chrono[i];
  // Format exactly like the frontend
  const label = r.week_from.split('-').reverse().join('-');
  const from = r.week_from.split('-').reverse().join('-');
  const to = r.week_to.split('-').reverse().join('-');
  
  console.log(`${i + 1}.    | ${label}             | ${from} to ${to}`);

  // Check if dates are decreasing (out of order)
  if (lastDate && r.week_from < lastDate) {
    console.log(`[ERROR] Chronological order broken here! ${r.week_from} is before ${lastDate}`);
    errors++;
  }
  lastDate = r.week_from;
}

if (errors === 0) {
  console.log('\n✅ Success! All dates on the graph are in perfect chronological order.');
} else {
  console.log(`\n❌ Found ${errors} chronological errors. The graph might look scrambled.`);
}

db.close();