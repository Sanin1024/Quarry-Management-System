'use strict';
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const { quarryId, from, to } = req.query;
  let where = 'WHERE 1=1';
  const params = [];
  if (quarryId) { where += ' AND quarry_id = ?'; params.push(quarryId); }
  if (from && to) { where += ' AND log_date >= ? AND log_date <= ?'; params.push(from, to); }
  const logs = db.prepare(`SELECT * FROM daily_logs ${where} ORDER BY log_date DESC`).all(...params);
  res.json(logs);
});

router.post('/', (req, res) => {
  const db = req.app.locals.db;
  const { quarry_id, log_date, first_qty, second_qty, broken_loads, labour_payment, diesel, spare_parts, fitting, jcb, cutting_wheel, mess, other, remarks } = req.body;
  if (!log_date) return res.status(400).json({ error: 'Date is required' });
  
  const paise = (v) => Math.round((Number(v) || 0) * 100);
  const now = new Date().toISOString();
  
  db.prepare(`INSERT INTO daily_logs (quarry_id, log_date, first_qty, second_qty, broken_loads, labour_payment_paise, diesel_paise, spare_parts_paise, fitting_paise, jcb_paise, cutting_wheel_paise, mess_paise, other_paise, remarks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(Number(quarry_id)||1, log_date, Number(first_qty)||0, Number(second_qty)||0, Number(broken_loads)||0, paise(labour_payment), paise(diesel), paise(spare_parts), paise(fitting), paise(jcb), paise(cutting_wheel), paise(mess), paise(other), remarks||'', now);
  res.status(201).json({ message: 'Daily log saved' });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM daily_logs WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;