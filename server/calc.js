'use strict';
function parseMoneyToPaise(input) {
  if (input === null || input === undefined || input === '') return 0;
  const raw = String(input).trim();
  if (raw === '') return 0;
  const cleaned = raw.replace(/[₹$\s,]/g, '');
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) throw new Error(`Invalid money value: "${input}"`);
  if (cleaned.startsWith('-')) throw new Error('Money cannot be negative');
  return Math.round(Number(cleaned) * 100);
}

function parseQuantity(input, { allowDecimal = false } = {}) {
  if (input === null || input === undefined || input === '') return 0;
  const raw = String(input).trim().replace(/,/g, '');
  if (raw === '') return 0;
  const pattern = allowDecimal ? /^-?\d+(\.\d{1,2})?$/ : /^-?\d+$/;
  if (!pattern.test(raw)) throw new Error(`Invalid quantity: "${input}"`);
  if (raw.startsWith('-')) throw new Error('Quantity cannot be negative');
  return allowDecimal ? Number(raw) : Number(raw);
}

function getMoney(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) throw new Error('Invalid money value');
    if (val < 0) throw new Error('Money cannot be negative');
    return Math.round(val);
  }
  return parseMoneyToPaise(val);
}

function computeReport(input) {
  const labour_payment_paise = getMoney(input.labour_payment_paise);
  const diesel_paise = getMoney(input.diesel_paise);
  const spare_parts_paise = getMoney(input.spare_parts_paise);
  const fitting_paise = getMoney(input.fitting_paise);
  const jcb_paise = getMoney(input.jcb_paise);
  const cutting_wheel_paise = getMoney(input.cutting_wheel_paise);
  const mess_paise = getMoney(input.mess_paise);
  const other_paise = getMoney(input.other_paise);
  const land_lease_paise = getMoney(input.land_lease_paise);
  const received_paise = getMoney(input.received_paise);

  const first_qty = parseQuantity(input.first_qty);
  const second_qty = parseQuantity(input.second_qty);
  const broken_loads = parseQuantity(input.broken_loads, { allowDecimal: true });

  const first_rate_paise = getMoney(input.first_rate_paise);
  const second_rate_paise = getMoney(input.second_rate_paise);
  const broken_rate_paise = getMoney(input.broken_rate_paise);

  const first_revenue_paise = Math.round(first_qty * first_rate_paise);
  const second_revenue_paise = Math.round(second_qty * second_rate_paise);
  const broken_revenue_paise = Math.round(broken_loads * broken_rate_paise);

  const total_revenue_paise = first_revenue_paise + second_revenue_paise + broken_revenue_paise;
  const total_expenses_paise = labour_payment_paise + diesel_paise + spare_parts_paise + fitting_paise + jcb_paise + cutting_wheel_paise + mess_paise + other_paise;
  const net_value_paise = total_revenue_paise - total_expenses_paise - land_lease_paise;
  const short_amount_paise = net_value_paise - received_paise;

  return {
    first_qty, second_qty, broken_loads, labour_payment_paise, diesel_paise, spare_parts_paise, fitting_paise,
    jcb_paise, cutting_wheel_paise, mess_paise, other_paise, land_lease_paise, received_paise,
    first_rate_paise, second_rate_paise, broken_rate_paise, first_revenue_paise, second_revenue_paise, broken_revenue_paise,
    total_revenue_paise, total_expenses_paise, net_value_paise, short_amount_paise,
  };
}

function formatRupees(paise) {
  const neg = paise < 0; const abs = Math.abs(paise); const rupees = abs / 100;
  const [intPart, fracPart] = rupees.toFixed(2).split('.');
  const last3 = intPart.slice(-3); const rest  = intPart.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3;
  return `${neg ? '-' : ''}₹${grouped}.${fracPart}`;
}

function formatCount(n) {
  const neg = n < 0; const abs = Math.abs(Math.trunc(n)); const s = String(abs);
  const last3 = s.slice(-3); const rest  = s.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3;
  return (neg ? '-' : '') + grouped;
}

function formatDisplayDate(iso) {
  if (!iso) return ''; if (/^\d{2}-\d{2}-\d{4}$/.test(iso)) return iso;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso); if (!m) return iso;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function parseDisplayDateToISO(display) {
  if (!display) return ''; if (/^\d{4}-\d{2}-\d{2}$/.test(display)) return display;
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(display); if (!m) throw new Error(`Invalid date: "${display}"`);
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function describeShortAmount(short_paise) {
  if (short_paise > 0) return { label: 'Short Amount', tone: 'warn', text: formatRupees(short_paise) };
  if (short_paise < 0) return { label: 'Excess Received', tone: 'good', text: formatRupees(Math.abs(short_paise)) };
  return { label: 'Fully Settled', tone: 'good', text: formatRupees(0) };
}

function describeNetValue(net_paise) {
  if (net_paise < 0) return { label: 'Loss', tone: 'bad', text: formatRupees(Math.abs(net_paise)) };
  return { label: 'Net Value', tone: 'good', text: formatRupees(net_paise) };
}

module.exports = {
  parseMoneyToPaise, parseQuantity, computeReport, formatRupees, formatCount, formatDisplayDate, parseDisplayDateToISO, describeShortAmount, describeNetValue,
};