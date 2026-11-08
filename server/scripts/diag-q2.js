'use strict';
const dbModule = require('../db');
const db = dbModule.init();

console.log('--- Simulating API call for Quarry 2 ---');
const reports = db.prepare("SELECT * FROM weekly_reports WHERE quarry_id = 2 ORDER BY week_from DESC").all();

if (reports.length === 0) {
  console.log('ERROR: No reports found for Quarry 2 in the database!');
} else {
  console.log(`Found ${reports.length} reports.`);
  console.log('Labels that should appear on the X-Axis:');
  const chrono = [...reports].reverse();
  for (const r of chrono) {
    console.log(` - ${r.week_from.split('-').reverse().join('-')} | Revenue: ${r.total_revenue_paise/100}`);
  }
}

db.close();