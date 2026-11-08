'use strict';
const dbModule = require('../db');
const db = dbModule.init();

console.log('--- Verifying All Dates in Database ---\n');

// 1. Verify Weekly Reports
const reports = db.prepare('SELECT id, quarry_id, week_from, week_to FROM weekly_reports ORDER BY quarry_id, week_from ASC').all();
console.log(`Total Reports Found: ${reports.length}`);

let errors = 0;
let lastDate = null;
let lastQuarry = null;

for (const r of reports) {
  // Check format
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(r.week_from) || !regex.test(r.week_to)) {
    console.log(`[ERROR] Report ID ${r.id} has invalid date format: ${r.week_from} to ${r.week_to}`);
    errors++;
    continue;
  }

  // Check chronological order
  if (r.week_to < r.week_from) {
    console.log(`[ERROR] Report ID ${r.id}: Week To (${r.week_to}) is before Week From (${r.week_from})`);
    errors++;
  }

  // Check for gaps/overlaps
  if (lastQuarry !== r.quarry_id) {
    console.log(`\n--- Quarry ID ${r.quarry_id} Timeline ---`);
    lastQuarry = r.quarry_id;
    lastDate = r.week_to;
  } else {
    if (lastDate && r.week_from <= lastDate) {
      console.log(`[WARN] Report ID ${r.id} overlaps with previous report. (${r.week_from} <= ${lastDate})`);
    }
    lastDate = r.week_to;
  }
}

if (errors === 0) {
  console.log('\n✅ All report dates are valid and in correct order!\n');
} else {
  console.log(`\n❌ Found ${errors} date errors in reports.\n`);
}

// 2. Verify Rate History
const rates = db.prepare('SELECT * FROM rate_history ORDER BY effective_from ASC').all();
console.log('--- Verifying Rate History Dates ---');
let rateErrors = 0;
for (const r of rates) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(r.effective_from)) {
    console.log(`[ERROR] Rate ID ${r.id} has invalid date format: ${r.effective_from}`);
    rateErrors++;
  }
}

if (rateErrors === 0) {
  console.log('✅ All rate history dates are valid!\n');
} else {
  console.log(`❌ Found ${rateErrors} date errors in rates.\n`);
}

// 3. Print exact timeline for visual verification
console.log('--- Full Timeline of Reports ---');
for (const r of reports) {
  console.log(`Quarry ${r.quarry_id} | ID: ${r.id} | ${r.week_from} to ${r.week_to}`);
}

db.close();