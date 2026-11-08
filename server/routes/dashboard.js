'use strict';
const express = require('express');
const router = express.Router();

router.get('/summary', (req, res) => {
  const db = req.app.locals.db;
  const { from, to, quarryId } = req.query;
  let where = 'WHERE 1=1'; const params = [];
  if (quarryId) { where += ' AND quarry_id = ?'; params.push(quarryId); }
  if (from && to) { where += ' AND week_from >= ? AND week_to <= ?'; params.push(from, to); }
  const row = db.prepare(`SELECT COUNT(*) as count, SUM(working_days) as total_working_days, SUM(labourers_count) as total_labourers, SUM(first_qty) as total_first_qty, SUM(second_qty) as total_second_qty, SUM(broken_loads) as total_broken_loads, SUM(total_expenses_paise) as total_expenses_paise, SUM(total_revenue_paise) as total_revenue_paise, SUM(net_value_paise) as net_value_paise, SUM(received_paise) as total_received_paise, SUM(short_amount_paise) as total_short_paise FROM weekly_reports ${where}`).get(...params);
  res.json(row || {});
});

router.get('/outstanding', (req, res) => {
  const db = req.app.locals.db;
  const { quarryId } = req.query;
  let where = 'WHERE short_amount_paise > 0'; const params = [];
  if (quarryId) { where += ' AND quarry_id = ?'; params.push(quarryId); }
  const reports = db.prepare(`SELECT id, week_from, week_to, short_amount_paise, received_paise, net_value_paise FROM weekly_reports ${where} ORDER BY week_from ASC`).all(...params);
  res.json(reports);
});

router.get('/breakdown', (req, res) => {
  const db = req.app.locals.db;
  const { from, to, quarryId } = req.query;
  let where = 'WHERE 1=1'; const params = [];
  if (quarryId) { where += ' AND quarry_id = ?'; params.push(quarryId); }
  if (from && to) { where += ' AND week_from >= ? AND week_to <= ?'; params.push(from, to); }
  const row = db.prepare(`SELECT SUM(diesel_paise) as diesel, SUM(spare_parts_paise) as spare_parts, SUM(fitting_paise) as fitting, SUM(jcb_paise) as jcb, SUM(cutting_wheel_paise) as cutting_wheel, SUM(mess_paise) as mess, SUM(other_paise) as other, SUM(labour_payment_paise) as labour FROM weekly_reports ${where}`).get(...params);
  res.json(row || {});
});

router.get('/quarries', (req, res) => {
  const quarries = req.app.locals.db.prepare('SELECT * FROM quarries ORDER BY name ASC').all();
  res.json(quarries);
});

router.post('/quarries', (req, res) => {
  const db = req.app.locals.db;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Quarry name is required' });
  try {
    const result = db.prepare('INSERT INTO quarries (name, created_at) VALUES (?, ?)').run(name, new Date().toISOString());
    res.status(201).json({ id: result.lastInsertRowid, name });
  } catch (err) { res.status(400).json({ error: 'Quarry name already exists' }); }
});

module.exports = router;