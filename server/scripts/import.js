'use strict';
const fs = require('fs');
const path = require('path');
const dbModule = require('../db');
const calc = require('../calc');

const dataPath = path.join(__dirname, '..', '..', 'data', 'import.txt');
const lines = fs.readFileSync(dataPath, 'utf8').split('\n');

const db = dbModule.init();

const parseAmount = (val) => {
  if (!val) return 0;
  val = String(val).replace(/Rs/g, '').replace(/,/g, '').replace(/\*/g, '').replace(/L/g, '').replace(/#VALUE!/g, '').trim();
  if (!val) return 0;
  const num = Number(val);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
};

const parseQty = (val, allowDecimal = false) => {
  if (!val) return 0;
  val = String(val).replace(/L/gi, '').replace(/\*/g, '').replace(/,/g, '').trim(); // Added comma replacement
  if (!val) return 0;
  const num = Number(val);
  if (isNaN(num)) return 0;
  return allowDecimal ? num : Math.round(num);
};

const parseDate = (val) => {
  if (!val || val === '*') return null;
  const parts = String(val).split('.');
  if (parts.length !== 3) return null;
  let [d, m, y] = parts;
  if (y.length === 2) y = '20' + y;
  return `${y}-${m}-${d}`;
};

const parseDays = (val) => {
  const num = parseInt(String(val).replace(/[^0-9]/g, ''), 10);
  return isNaN(num) ? 0 : num;
};

const insert = db.prepare(`INSERT INTO weekly_reports (
  quarry_id, week_from, week_to, working_days, labourers_count, 
  labour_payment_paise, diesel_paise, spare_parts_paise, fitting_paise, jcb_paise, 
  cutting_wheel_paise, mess_paise, other_paise, 
  first_qty, second_qty, broken_loads, 
  first_rate_paise, second_rate_paise, broken_rate_paise, 
  land_lease_paise, received_paise, remarks, 
  first_revenue_paise, second_revenue_paise, broken_revenue_paise, 
  total_revenue_paise, total_expenses_paise, net_value_paise, short_amount_paise, 
  created_at, updated_at
) VALUES (
  @quarry_id, @week_from, @week_to, @working_days, @labourers_count, 
  @labour_payment_paise, @diesel_paise, @spare_parts_paise, @fitting_paise, @jcb_paise, 
  @cutting_wheel_paise, @mess_paise, @other_paise, 
  @first_qty, @second_qty, @broken_loads, 
  @first_rate_paise, @second_rate_paise, @broken_rate_paise, 
  @land_lease_paise, @received_paise, @remarks, 
  @first_revenue_paise, @second_revenue_paise, @broken_revenue_paise, 
  @total_revenue_paise, @total_expenses_paise, @net_value_paise, @short_amount_paise, 
  @now, @now
)`);

const tx = db.transaction(() => {
  let imported = 0;
  let skipped = 0;

  for (const line of lines) {
    if (!line.trim() || !/^\d+\s*\|/.test(line)) continue;
    
    const row = line.split('|').map(c => c.trim());
    const len = row.length;
    
    let receivedIdx = 23;
    let remarksIdx = 24;
    if (len >= 26) { // Q2 format has Short column at 24, Remarks at 25
      remarksIdx = 25;
    }

    const week_from = parseDate(row[1]);
    const week_to = parseDate(row[2]);
    if (!week_from || !week_to) {
      console.log(`Skipping invalid date line: ${line.substring(0, 50)}...`);
      continue;
    }

    // Skip if already exists
    const existing = db.prepare('SELECT id FROM weekly_reports WHERE quarry_id = 1 AND week_from = ?').get(week_from);
    if (existing) {
      skipped++;
      continue;
    }

    const working_days = parseDays(row[3]);
    const labourers_count = parseQty(row[4]);

    const expenses = {
      labour_payment_paise: parseAmount(row[5]),
      diesel_paise: parseAmount(row[6]),
      spare_parts_paise: parseAmount(row[7]),
      fitting_paise: parseAmount(row[8]),
      jcb_paise: parseAmount(row[9]),
      cutting_wheel_paise: parseAmount(row[10]),
      mess_paise: parseAmount(row[11]),
      other_paise: parseAmount(row[12]),
    };

    const first_qty = parseQty(row[14]);
    const second_qty = parseQty(row[15]);
    const broken_loads = parseQty(row[16], true);

    // Infer rates
    const first_rate_paise = first_qty > 0 ? Math.round(parseAmount(row[17]) / first_qty) : 3800;
    const second_rate_paise = second_qty > 0 ? Math.round(parseAmount(row[18]) / second_qty) : 2800;
    const broken_rate_paise = broken_loads > 0 ? Math.round(parseAmount(row[19]) / broken_loads) : 85000;

    const land_lease_paise = parseAmount(row[21]);
    const received_paise = parseAmount(row[receivedIdx]);
    const remarks = (row[remarksIdx] && row[remarksIdx] !== '*') ? row[remarksIdx] : '';

    const input = { ...expenses, first_qty, second_qty, broken_loads, first_rate_paise, second_rate_paise, broken_rate_paise, land_lease_paise, received_paise };
    const calcData = calc.computeReport(input);

    // Override with exact historical revenues
    calcData.first_revenue_paise = parseAmount(row[17]);
    calcData.second_revenue_paise = parseAmount(row[18]);
    calcData.broken_revenue_paise = parseAmount(row[19]);
    calcData.total_revenue_paise = calcData.first_revenue_paise + calcData.second_revenue_paise + calcData.broken_revenue_paise;
    calcData.net_value_paise = calcData.total_revenue_paise - calcData.total_expenses_paise - calcData.land_lease_paise;
    calcData.short_amount_paise = calcData.net_value_paise - calcData.received_paise;

    const now = new Date().toISOString();
    insert.run({
      quarry_id: 1,
      week_from, week_to, working_days, labourers_count,
      ...calcData,
      remarks,
      now
    });
    imported++;
  }
  console.log(`Import complete! Imported: ${imported}, Skipped (duplicates): ${skipped}`);
});

tx();
db.close();