'use strict';
const express = require('express');
const router = express.Router();
const dbModule = require('../db');

router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const { quarryId } = req.query;
  const params = [];
  let where = '';
  if (quarryId) { where = 'WHERE quarry_id = ?'; params.push(quarryId); }
  const rates = db.prepare(`SELECT * FROM rate_history ${where} ORDER BY effective_from DESC, id DESC`).all(...params);
  res.json(rates);
});

router.post('/', (req, res) => {
  const db = req.app.locals.db;
  const { product, rate, effective_from, note, quarry_id } = req.body;
  try {
    const rate_paise = Math.round(Number(rate) * 100);
    if (!product || !effective_from) throw new Error('Product and effective date are required');
    const qId = Number(quarry_id) || 1;
    const now = new Date().toISOString();
    db.prepare('INSERT INTO rate_history (quarry_id, product, rate_paise, effective_from, created_at, note) VALUES (?, ?, ?, ?, ?, ?)').run(qId, product, rate_paise, effective_from, now, note || '');
    res.status(201).json({ message: 'Rate added successfully' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'A rate for this product and date already exists.' });
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;