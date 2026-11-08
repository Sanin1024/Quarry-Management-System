'use strict';
const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const calc = require('../calc');

function buildFilter(req) {
  const { from, to, quarryId } = req.query;
  let where = 'WHERE 1=1'; const params = [];
  if (quarryId && quarryId !== 'all') { where += ' AND quarry_id = ?'; params.push(quarryId); }
  if (from && to) { where += ' AND week_from >= ? AND week_to <= ?'; params.push(from, to); }
  return { where, params };
}

router.get('/xlsx', async (req, res) => {
  const db = req.app.locals.db;
  const { where, params } = buildFilter(req);
  const reports = db.prepare(`SELECT * FROM weekly_reports ${where} ORDER BY week_from ASC`).all(...params);
  if (reports.length === 0) return res.status(404).json({ error: 'No reports found for export' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=Quarry_Reports_${Date.now()}.xlsx`);

  // P3 FIX: Use streaming workbook writer to optimize event loop latency
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
  const sheet1 = workbook.addWorksheet('Weekly Report Details');
  
  const headers = ['Sr.', 'Week From', 'Week To', 'Days', 'Lab.', 'Labour ₹', 'Diesel ₹', 'Spare Parts ₹', 'Fitting ₹', 'JCB ₹', 'Cutting Wheel ₹', 'Mess ₹', 'Other ₹', 'Total Exp. ₹', '1st Qty', '1st Rate ₹', '1st Rev ₹', '2nd Qty', '2nd Rate ₹', '2nd Rev ₹', 'Broken Qty', 'Broken Rate ₹', 'Broken Rev ₹', 'Total Rev ₹', 'Land Lease ₹', 'Net Val ₹', 'Received ₹', 'Short ₹', 'Remarks'];
  sheet1.addRow(headers).commit();
  
  reports.forEach((r, i) => {
    sheet1.addRow([
      i + 1, calc.formatDisplayDate(r.week_from), calc.formatDisplayDate(r.week_to), r.working_days, r.labourers_count,
      r.labour_payment_paise/100, r.diesel_paise/100, r.spare_parts_paise/100, r.fitting_paise/100, r.jcb_paise/100, r.cutting_wheel_paise/100, r.mess_paise/100, r.other_paise/100,
      r.total_expenses_paise/100, r.first_qty, r.first_rate_paise/100, r.first_revenue_paise/100, r.second_qty, r.second_rate_paise/100, r.second_revenue_paise/100,
      r.broken_loads, r.broken_rate_paise/100, r.broken_revenue_paise/100, r.total_revenue_paise/100, r.land_lease_paise/100, r.net_value_paise/100, r.received_paise/100, r.short_amount_paise/100, r.remarks
    ]).commit();
  });

  const totalRow = sheet1.addRow([ 'TOTALS', '', '', reports.reduce((s,r)=>s+r.working_days,0), '', 
    reports.reduce((s,r)=>s+r.labour_payment_paise/100,0), reports.reduce((s,r)=>s+r.diesel_paise/100,0), reports.reduce((s,r)=>s+r.spare_parts_paise/100,0), 
    reports.reduce((s,r)=>s+r.fitting_paise/100,0), reports.reduce((s,r)=>s+r.jcb_paise/100,0), reports.reduce((s,r)=>s+r.cutting_wheel_paise/100,0), 
    reports.reduce((s,r)=>s+r.mess_paise/100,0), reports.reduce((s,r)=>s+r.other_paise/100,0), reports.reduce((s,r)=>s+r.total_expenses_paise/100,0),
    reports.reduce((s,r)=>s+r.first_qty,0), '', reports.reduce((s,r)=>s+r.first_revenue_paise/100,0), reports.reduce((s,r)=>s+r.second_qty,0), '', reports.reduce((s,r)=>s+r.second_revenue_paise/100,0),
    reports.reduce((s,r)=>s+r.broken_loads,0), '', reports.reduce((s,r)=>s+r.broken_revenue_paise/100,0), reports.reduce((s,r)=>s+r.total_revenue_paise/100,0), reports.reduce((s,r)=>s+r.land_lease_paise/100,0), 
    reports.reduce((s,r)=>s+r.net_value_paise/100,0), reports.reduce((s,r)=>s+r.received_paise/100,0), reports.reduce((s,r)=>s+r.short_amount_paise/100,0), ''
  ]);
  totalRow.font = { bold: true };
  totalRow.border = { top: { style: 'thin' } };
  totalRow.commit();
  sheet1.commit();

  const sheet2 = workbook.addWorksheet('Summary');
  sheet2.addRow(['Quarry Weekly Report Summary']).commit();
  sheet2.addRow(['Date Range', req.query.from ? `${calc.formatDisplayDate(req.query.from)} to ${calc.formatDisplayDate(req.query.to)}` : 'All Dates']).commit();
  sheet2.addRow(['Number of Reports', reports.length]).commit();
  sheet2.addRow([]).commit(); sheet2.addRow(['Metric', 'Value (₹)']).commit();
  sheet2.addRow(['Total Labour Payment', reports.reduce((s,r)=>s+r.labour_payment_paise/100,0)]).commit();
  sheet2.addRow(['Total Operating Expenses', reports.reduce((s,r)=>s+r.total_expenses_paise/100,0)]).commit();
  sheet2.addRow(['Total Revenue', reports.reduce((s,r)=>s+r.total_revenue_paise/100,0)]).commit();
  sheet2.addRow(['Total Land Lease', reports.reduce((s,r)=>s+r.land_lease_paise/100,0)]).commit();
  sheet2.addRow(['Total Net Value', reports.reduce((s,r)=>s+r.net_value_paise/100,0)]).commit();
  sheet2.addRow(['Total Amount Received', reports.reduce((s,r)=>s+r.received_paise/100,0)]).commit();
  sheet2.addRow(['Total Short Amount', reports.reduce((s,r)=>s+r.short_amount_paise/100,0)]).commit();
  sheet2.commit();

  await workbook.commit();
});

router.get('/csv', (req, res) => {
  const db = req.app.locals.db;
  const { where, params } = buildFilter(req);
  const reports = db.prepare(`SELECT * FROM weekly_reports ${where} ORDER BY week_from ASC`).all(...params);
  if (reports.length === 0) return res.status(404).json({ error: 'No reports found for export' });

  const headers = ['Sr.', 'Week From', 'Week To', 'Days', 'Lab.', 'Labour ₹', 'Diesel ₹', 'Spare Parts ₹', 'Fitting ₹', 'JCB ₹', 'Cutting Wheel ₹', 'Mess ₹', 'Other ₹', 'Total Exp. ₹', '1st Qty', '1st Rate ₹', '1st Rev ₹', '2nd Qty', '2nd Rate ₹', '2nd Rev ₹', 'Broken Qty', 'Broken Rate ₹', 'Broken Rev ₹', 'Total Rev ₹', 'Land Lease ₹', 'Net Val ₹', 'Received ₹', 'Short ₹', 'Remarks'];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=Quarry_Reports_${Date.now()}.csv`);
  res.write('\ufeff'); res.write(headers.join(',') + '\n');

  reports.forEach((r, i) => {
    const row = [
      i + 1, calc.formatDisplayDate(r.week_from), calc.formatDisplayDate(r.week_to), r.working_days, r.labourers_count,
      r.labour_payment_paise/100, r.diesel_paise/100, r.spare_parts_paise/100, r.fitting_paise/100, r.jcb_paise/100, r.cutting_wheel_paise/100, r.mess_paise/100, r.other_paise/100,
      r.total_expenses_paise/100, r.first_qty, r.first_rate_paise/100, r.first_revenue_paise/100, r.second_qty, r.second_rate_paise/100, r.second_revenue_paise/100,
      r.broken_loads, r.broken_rate_paise/100, r.broken_revenue_paise/100, r.total_revenue_paise/100, r.land_lease_paise/100, r.net_value_paise/100, r.received_paise/100, r.short_amount_paise/100, `"${r.remarks.replace(/"/g, '""')}"`
    ];
    res.write(row.join(',') + '\n');
  });
  res.end();
});

module.exports = router;