'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../calc');

test('Worked example from section 5 produces exact expected totals', () => {
  const r = calc.computeReport({
    labour_payment_paise: 6000000,   // ₹60,000
    diesel_paise:         2500000,   // ₹25,000
    spare_parts_paise:     800000,
    fitting_paise:         300000,
    jcb_paise:            1200000,
    cutting_wheel_paise:   600000,
    mess_paise:            900000,
    other_paise:           200000,
    first_qty: 12000,
    second_qty: 5000,
    broken_loads: 20,
    first_rate_paise:  3800,
    second_rate_paise: 2800,
    broken_rate_paise: 85000,
    land_lease_paise: 5000000,
    received_paise:  40000000,
  });
  assert.equal(r.first_revenue_paise,   45600000); // ₹4,56,000
  assert.equal(r.second_revenue_paise,  14000000); // ₹1,40,000
  assert.equal(r.broken_revenue_paise,  1700000);  // ₹17,000
  assert.equal(r.total_revenue_paise,   61300000); // ₹6,13,000
  assert.equal(r.total_expenses_paise,  12500000); // ₹1,25,000
  assert.equal(r.net_value_paise,       43800000); // ₹4,38,000
  assert.equal(r.short_amount_paise,     3800000); // ₹38,000
});

test('All-zero / blank fields produce zero totals', () => {
  const r = calc.computeReport({});
  assert.equal(r.total_revenue_paise, 0);
  assert.equal(r.total_expenses_paise, 0);
  assert.equal(r.net_value_paise, 0);
  assert.equal(r.short_amount_paise, 0);
});

test('2.5 broken loads round half-up correctly per line', () => {
  // 2.5 loads × ₹850 = 2125.00 → 212500 paise exactly.
  const r = calc.computeReport({
    broken_loads: 2.5,
    broken_rate_paise: 85000,
  });
  assert.equal(r.broken_revenue_paise, 212500);

  // 2.5 loads × ₹38.55 (3855 paise) = 9637.5 → round half-up to 9638 paise.
  const r2 = calc.computeReport({
    broken_loads: 2.5,
    broken_rate_paise: 3855,
  });
  assert.equal(r2.broken_revenue_paise, 9638);
});

test('Rate with paise fraction is handled in integer paise', () => {
  // ₹38.55 = 3855 paise; 1000 bricks → 3855 × 1000 = 3855000 paise = ₹38,550.00
  const r = calc.computeReport({
    first_qty: 1000,
    first_rate_paise: 3855,
  });
  assert.equal(r.first_revenue_paise, 3855000);
});

test('Negative net value (loss) is reported correctly', () => {
  const r = calc.computeReport({
    first_qty: 100,
    first_rate_paise: 3800,
    labour_payment_paise: 10000000, // ₹1,00,000
    land_lease_paise: 5000000,
  });
  // revenue 100×38 = 3800; expenses 100000 + lease 50000 = 150000 → net -146200
  assert.equal(r.total_revenue_paise,  380000);
  assert.equal(r.total_expenses_paise, 10000000);
  assert.equal(r.net_value_paise,      -14620000);
  const desc = calc.describeNetValue(r.net_value_paise);
  assert.equal(desc.label, 'Loss');
  assert.equal(desc.tone, 'bad');
});

test('Amount received larger than net value is "Excess Received"', () => {
  const r = calc.computeReport({
    first_qty: 1000,
    first_rate_paise: 3800,
    received_paise: 50000000, // ₹5,00,000 — much more than revenue
  });
  // net = 3800000 - 0 - 0 = 3800000; short = 3800000 - 50000000 = -46200000
  assert.equal(r.net_value_paise,    3800000);
  assert.equal(r.short_amount_paise, -46200000);
  const d = calc.describeShortAmount(r.short_amount_paise);
  assert.equal(d.label, 'Excess Received');
  assert.equal(d.tone, 'good');
});

test('parseMoneyToPaise accepts Indian and Western grouping, rejects negatives and >2 dp', () => {
  assert.equal(calc.parseMoneyToPaise(''), 0);
  assert.equal(calc.parseMoneyToPaise('45000'), 4500000);
  assert.equal(calc.parseMoneyToPaise('45,000'), 4500000);
  assert.equal(calc.parseMoneyToPaise('4,56,000'), 45600000);
  assert.equal(calc.parseMoneyToPaise('₹4,56,000.00'), 45600000);
  assert.equal(calc.parseMoneyToPaise('45000.50'), 4500050);
  assert.throws(() => calc.parseMoneyToPaise('-100'), /negative/i);
  assert.throws(() => calc.parseMoneyToPaise('45.123'), /Invalid money value/);
  assert.throws(() => calc.parseMoneyToPaise('abc'), /Invalid money value/);
});

test('parseQuantity rejects negatives and respects allowDecimal', () => {
  assert.equal(calc.parseQuantity(''), 0);
  assert.equal(calc.parseQuantity('1000'), 1000);
  assert.equal(calc.parseQuantity('1,000'), 1000);
  assert.throws(() => calc.parseQuantity('-5'), /negative/i);
  assert.throws(() => calc.parseQuantity('1.5'), /Invalid quantity/);
  assert.equal(calc.parseQuantity('2.5', { allowDecimal: true }), 2.5);
  assert.throws(() => calc.parseQuantity('2.567', { allowDecimal: true }), /Invalid quantity/);
});

test('formatRupees uses Indian digit grouping', () => {
  assert.equal(calc.formatRupees(45600000),  '₹4,56,000.00');
  assert.equal(calc.formatRupees(123456700), '₹12,34,567.00');
  assert.equal(calc.formatRupees(0),         '₹0.00');
  assert.equal(calc.formatRupees(-100000),   '-₹1,000.00');
});

test('formatDisplayDate and parseDisplayDateToISO are inverse', () => {
  assert.equal(calc.formatDisplayDate('2026-11-03'), '03-11-2026');
  assert.equal(calc.parseDisplayDateToISO('03-11-2026'), '2026-11-03');
  assert.equal(calc.parseDisplayDateToISO('2026-11-03'), '2026-11-03');
  assert.throws(() => calc.parseDisplayDateToISO('31/12/2026'), /Invalid date/);
});