'use strict';
const express = require('express');
const router = express.Router();

router.get('/export-json', (req, res) => {
  const db = req.app.locals.db;
  const data = {
    quarries: db.prepare('SELECT * FROM quarries').all(),
    rate_history: db.prepare('SELECT * FROM rate_history').all(),
    weekly_reports: db.prepare('SELECT * FROM weekly_reports').all(),
    daily_logs: db.prepare('SELECT * FROM daily_logs').all(),
    app_settings: db.prepare('SELECT * FROM app_settings').all(),
  };
  res.setHeader('Content-Disposition', `attachment; filename=quarry_backup_${Date.now()}.json`);
  res.json(data);
});

router.post('/import-json', (req, res) => {
  const db = req.app.locals.db;
  const data = req.body;
  if (!data || !data.weekly_reports) return res.status(400).json({ error: 'Invalid backup file' });
  
  const tx = db.transaction(() => {
    db.exec('DELETE FROM weekly_reports; DELETE FROM rate_history; DELETE FROM quarries; DELETE FROM daily_logs; DELETE FROM app_settings;');
    
    const insertQ = db.prepare('INSERT INTO quarries (id, name, created_at) VALUES (@id, @name, @created_at)');
    data.quarries.forEach(r => insertQ.run(r));
    
    const insertR = db.prepare('INSERT INTO rate_history (id, quarry_id, product, rate_paise, effective_from, created_at, note) VALUES (@id, @quarry_id, @product, @rate_paise, @effective_from, @created_at, @note)');
    data.rate_history.forEach(r => insertR.run(r));
    
    const insertW = db.prepare(`INSERT INTO weekly_reports (id, quarry_id, week_from, week_to, working_days, labourers_count, labour_payment_paise, diesel_paise, spare_parts_paise, fitting_paise, jcb_paise, cutting_wheel_paise, mess_paise, other_paise, first_qty, second_qty, broken_loads, first_rate_paise, second_rate_paise, broken_rate_paise, land_lease_paise, received_paise, remarks, first_revenue_paise, second_revenue_paise, broken_revenue_paise, total_revenue_paise, total_expenses_paise, net_value_paise, short_amount_paise, created_at, updated_at) VALUES (@id, @quarry_id, @week_from, @week_to, @working_days, @labourers_count, @labour_payment_paise, @diesel_paise, @spare_parts_paise, @fitting_paise, @jcb_paise, @cutting_wheel_paise, @mess_paise, @other_paise, @first_qty, @second_qty, @broken_loads, @first_rate_paise, @second_rate_paise, @broken_rate_paise, @land_lease_paise, @received_paise, @remarks, @first_revenue_paise, @second_revenue_paise, @broken_revenue_paise, @total_revenue_paise, @total_expenses_paise, @net_value_paise, @short_amount_paise, @created_at, @updated_at)`);
    data.weekly_reports.forEach(r => insertW.run(r));
    
    if (data.daily_logs) {
      const insertD = db.prepare('INSERT INTO daily_logs (id, quarry_id, log_date, first_qty, second_qty, broken_loads, labour_payment_paise, diesel_paise, spare_parts_paise, fitting_paise, jcb_paise, cutting_wheel_paise, mess_paise, other_paise, remarks, created_at) VALUES (@id, @quarry_id, @log_date, @first_qty, @second_qty, @broken_loads, @labour_payment_paise, @diesel_paise, @spare_parts_paise, @fitting_paise, @jcb_paise, @cutting_wheel_paise, @mess_paise, @other_paise, @remarks, @created_at)');
      data.daily_logs.forEach(r => insertD.run(r));
    }
  });
  tx();
  res.json({ message: 'Data imported successfully' });
});

module.exports = router;