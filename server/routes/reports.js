'use strict';
const express = require('express');
const router = express.Router();
const calc = require('../calc');

function buildFilter(req) {
  const { from, to, includeOverlap, quarryId, search } = req.query;
  let where = 'WHERE 1=1'; const params = [];
  if (quarryId && quarryId !== 'all') { where += ' AND quarry_id = ?'; params.push(quarryId); }
  if (from && to) {
    if (includeOverlap === 'true') { where += ' AND week_from <= ? AND week_to >= ?'; params.push(to, from); }
    else { where += ' AND week_from >= ? AND week_to <= ?'; params.push(from, to); }
  }
  if (search) { where += ' AND remarks LIKE ?'; params.push(`%${search}%`); }
  return { where, params };
}

router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const { where, params } = buildFilter(req);
  const reports = db.prepare(`SELECT * FROM weekly_reports ${where} ORDER BY week_from DESC`).all(...params);
  const totals = reports.reduce((acc, r) => {
    acc.total_revenue_paise += r.total_revenue_paise; acc.total_expenses_paise += r.total_expenses_paise;
    acc.net_value_paise += r.net_value_paise; acc.short_amount_paise += r.short_amount_paise; return acc;
  }, { total_revenue_paise: 0, total_expenses_paise: 0, net_value_paise: 0, short_amount_paise: 0 });
  res.json({ reports, totals, count: reports.length });
});

router.get('/deleted', (req, res) => {
  const db = req.app.locals.db;
  const deleted = db.prepare('SELECT id, report_json, deleted_at FROM deleted_reports ORDER BY deleted_at DESC').all();
  res.json(deleted.map(d => ({ id: d.id, deleted_at: d.deleted_at, report: JSON.parse(d.report_json) })));
});

router.post('/restore/:id', (req, res) => {
  const db = req.app.locals.db;
  const row = db.prepare('SELECT report_json FROM deleted_reports WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const r = JSON.parse(row.report_json); delete r.id;
  const cols = Object.keys(r).join(', '); const placeholders = Object.keys(r).map(k => `@${k}`).join(', ');
  db.prepare(`INSERT INTO weekly_reports (${cols}) VALUES (${placeholders})`).run(r);
  db.prepare('DELETE FROM deleted_reports WHERE id = ?').run(req.params.id);
  res.json({ message: 'Restored successfully' });
});

router.get('/:id', (req, res) => {
  const report = req.app.locals.db.prepare('SELECT * FROM weekly_reports WHERE id = ?').get(req.params.id);
  if (!report) return res.status(404).json({ error: 'Report not found' });
  res.json(report);
});

function prepareInput(body) {
  const parseVal = (v) => {
    if (v === undefined || v === null || v === '') return 0;
    return calc.parseMoneyToPaise(v);
  };
  return {
    quarry_id: Number(body.quarry_id) || 1,
    week_from: body.week_from,
    week_to: body.week_to,
    working_days: Number(body.working_days) || 0,
    labourers_count: Number(body.labourers_count) || 0,
    labour_payment_paise: parseVal(body.labour_payment !== undefined ? body.labour_payment : body.labour_payment_paise),
    diesel_paise: parseVal(body.diesel !== undefined ? body.diesel : body.diesel_paise),
    spare_parts_paise: parseVal(body.spare_parts !== undefined ? body.spare_parts : body.spare_parts_paise),
    fitting_paise: parseVal(body.fitting !== undefined ? body.fitting : body.fitting_paise),
    jcb_paise: parseVal(body.jcb !== undefined ? body.jcb : body.jcb_paise),
    cutting_wheel_paise: parseVal(body.cutting_wheel !== undefined ? body.cutting_wheel : body.cutting_wheel_paise),
    mess_paise: parseVal(body.mess !== undefined ? body.mess : body.mess_paise),
    other_paise: parseVal(body.other !== undefined ? body.other : body.other_paise),
    land_lease_paise: parseVal(body.land_lease !== undefined ? body.land_lease : body.land_lease_paise),
    received_paise: parseVal(body.received !== undefined ? body.received : body.received_paise),
    first_qty: body.first_qty,
    second_qty: body.second_qty,
    broken_loads: body.broken_loads,
    first_rate_paise: parseVal(body.first_rate !== undefined ? body.first_rate : body.first_rate_paise),
    second_rate_paise: parseVal(body.second_rate !== undefined ? body.second_rate : body.second_rate_paise),
    broken_rate_paise: parseVal(body.broken_rate !== undefined ? body.broken_rate : body.broken_rate_paise),
    remarks: body.remarks || ''
  };
}

router.post('/', (req, res) => {
  const db = req.app.locals.db;
  try {
    const input = prepareInput(req.body);
    if (!input.week_from || !input.week_to) throw new Error('Week From and Week To are required');
    if (input.week_to < input.week_from) throw new Error('Week To cannot be earlier than Week From');
    
    const calcData = calc.computeReport(input);
    const now = new Date().toISOString();
    const result = db.prepare(`INSERT INTO weekly_reports (quarry_id, week_from, week_to, working_days, labourers_count, labour_payment_paise, diesel_paise, spare_parts_paise, fitting_paise, jcb_paise, cutting_wheel_paise, mess_paise, other_paise, first_qty, second_qty, broken_loads, first_rate_paise, second_rate_paise, broken_rate_paise, land_lease_paise, received_paise, remarks, first_revenue_paise, second_revenue_paise, broken_revenue_paise, total_revenue_paise, total_expenses_paise, net_value_paise, short_amount_paise, created_at, updated_at) VALUES (@quarry_id, @week_from, @week_to, @working_days, @labourers_count, @labour_payment_paise, @diesel_paise, @spare_parts_paise, @fitting_paise, @jcb_paise, @cutting_wheel_paise, @mess_paise, @other_paise, @first_qty, @second_qty, @broken_loads, @first_rate_paise, @second_rate_paise, @broken_rate_paise, @land_lease_paise, @received_paise, @remarks, @first_revenue_paise, @second_revenue_paise, @broken_revenue_paise, @total_revenue_paise, @total_expenses_paise, @net_value_paise, @short_amount_paise, @now, @now)`)
      .run({ ...calcData, quarry_id: input.quarry_id, week_from: input.week_from, week_to: input.week_to, working_days: Number(input.working_days)||0, labourers_count: Number(input.labourers_count)||0, remarks: input.remarks || '', now });
    res.status(201).json({ id: result.lastInsertRowid, message: 'Report saved successfully' });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/:id', (req, res) => {
  const db = req.app.locals.db;
  try {
    const input = prepareInput(req.body);
    if (!input.week_from || !input.week_to) throw new Error('Week From and Week To are required');
    if (input.week_to < input.week_from) throw new Error('Week To cannot be earlier than Week From');
    
    const calcData = calc.computeReport(input);
    const now = new Date().toISOString();
    db.prepare(`UPDATE weekly_reports SET quarry_id=@quarry_id, week_from=@week_from, week_to=@week_to, working_days=@working_days, labourers_count=@labourers_count, labour_payment_paise=@labour_payment_paise, diesel_paise=@diesel_paise, spare_parts_paise=@spare_parts_paise, fitting_paise=@fitting_paise, jcb_paise=@jcb_paise, cutting_wheel_paise=@cutting_wheel_paise, mess_paise=@mess_paise, other_paise=@other_paise, first_qty=@first_qty, second_qty=@second_qty, broken_loads=@broken_loads, first_rate_paise=@first_rate_paise, second_rate_paise=@second_rate_paise, broken_rate_paise=@broken_rate_paise, land_lease_paise=@land_lease_paise, received_paise=@received_paise, remarks=@remarks, first_revenue_paise=@first_revenue_paise, second_revenue_paise=@second_revenue_paise, broken_revenue_paise=@broken_revenue_paise, total_revenue_paise=@total_revenue_paise, total_expenses_paise=@total_expenses_paise, net_value_paise=@net_value_paise, short_amount_paise=@short_amount_paise, updated_at=@now WHERE id=@id`)
      .run({ ...calcData, id: req.params.id, quarry_id: input.quarry_id, week_from: input.week_from, week_to: input.week_to, working_days: Number(input.working_days)||0, labourers_count: Number(input.labourers_count)||0, remarks: input.remarks || '', now });
    res.json({ message: 'Report updated successfully' });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// BUG-01 FIX: Fixed Date object
router.delete('/:id', (req, res) => {
  const db = req.app.locals.db;
  const report = db.prepare('SELECT * FROM weekly_reports WHERE id = ?').get(req.params.id);
  if (!report) return res.status(404).json({ error: 'Report not found' });
  const now = new Date(); // Fixed: created as object first
  db.prepare('INSERT INTO deleted_reports (report_json, deleted_at, expires_at) VALUES (?, ?, ?)')
    .run(JSON.stringify(report), now.toISOString(), new Date(now.getTime() + 30*24*60*60*1000).toISOString());
  db.prepare('DELETE FROM weekly_reports WHERE id = ?').run(req.params.id);
  res.json({ message: 'Report deleted' });
});

module.exports = router;