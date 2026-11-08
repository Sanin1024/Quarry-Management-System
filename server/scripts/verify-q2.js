'use strict';
const dbModule = require('../db');
const db = dbModule.init();
const calc = require('../calc');

const reports = db.prepare("SELECT * FROM weekly_reports WHERE quarry_id = 2 ORDER BY week_from ASC").all();
console.log('--- Quarry 2 Data Verification ---');
console.log('Total Reports:', reports.length);

reports.forEach((r, i) => {
  console.log(`\nRow ${i + 1}: ${r.week_from} to ${r.week_to}`);
  console.log(`  Working Days: ${r.working_days}, Labourers: ${r.labourers_count}`);
  console.log(`  Expenses: Labour ${calc.formatRupees(r.labour_payment_paise)}, Diesel ${calc.formatRupees(r.diesel_paise)}`);
  console.log(`  Total Expenses: ${calc.formatRupees(r.total_expenses_paise)}`);
  console.log(`  Production: 1st(${r.first_qty}), 2nd(${r.second_qty}), Broken(${r.broken_loads})`);
  console.log(`  Total Revenue: ${calc.formatRupees(r.total_revenue_paise)}`);
  console.log(`  Net Value: ${calc.formatRupees(r.net_value_paise)}`);
  console.log(`  Received: ${calc.formatRupees(r.received_paise)}, Short: ${calc.formatRupees(r.short_amount_paise)}`);
});

db.close();