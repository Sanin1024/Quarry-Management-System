const API_BASE = '/api';
let currentView = 'dashboard';
let currentFilter = { from: '', to: '' };
let currentQuarryId = 1;
let quarries = [];

const fmtRupees = (paise) => '₹' + Number(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCount = (n) => Number(n).toLocaleString('en-IN');
const fmtDate = (iso) => iso ? iso.split('-').reverse().join('-') : '';
const fmtAxis = (v) => {
  if (v >= 10000000) return '₹' + (v / 10000000).toFixed(1) + 'Cr';
  if (v >= 100000) return '₹' + (v / 100000).toFixed(1) + 'L';
  if (v >= 1000) return '₹' + (v / 1000).toFixed(0) + 'k';
  return '₹' + v;
};

async function api(endpoint, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${endpoint}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

document.addEventListener('DOMContentLoaded', async () => {
  if (localStorage.getItem('darkMode') === 'true') document.body.classList.add('dark-mode');
  document.getElementById('dark-mode-toggle').addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
  });

  quarries = await api('/dashboard/quarries');
  const selector = document.getElementById('quarry-selector');
  selector.innerHTML = `<option value="all">All Quarries (Combined)</option>` + quarries.map(q => `<option value="${q.id}">${q.name}</option>`).join('');
  selector.addEventListener('change', () => { currentQuarryId = selector.value; loadView(); });

  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      currentView = link.dataset.view;
      document.getElementById('page-title').innerText = link.innerText;
      loadView();
    });
  });

  document.getElementById('btn-apply-filter').addEventListener('click', applyFilters);
  document.getElementById('btn-reset-filter').addEventListener('click', resetFilters);
  document.getElementById('search-remarks').addEventListener('keyup', (e) => { if (e.key === 'Enter') loadView(); });
  
  document.querySelectorAll('.quick-filters button[data-range]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.quick-filters button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyQuickFilter(btn.dataset.range);
    });
  });

  loadView();
});

function applyQuickFilter(range) {
  const today = new Date();
  let from = '', to = today.toISOString().split('T')[0];
  const pad = (n) => n.toString().padStart(2, '0');
  
  // UX-02 FIX: Safe local time formatting without toISOString shifting timezone
  if (range === 'month') {
    from = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`;
  } else if (range === '3months') {
    let d = new Date(today.getFullYear(), today.getMonth() - 3, 1);
    from = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
  } else if (range === 'fy') {
    const fyStart = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
    from = `${fyStart}-04-01`;
  }
  
  currentFilter = { from, to };
  document.getElementById('filter-from').value = from;
  document.getElementById('filter-to').value = to;
  loadView();
}

function applyFilters() {
  currentFilter.from = document.getElementById('filter-from').value;
  currentFilter.to = document.getElementById('filter-to').value;
  document.querySelectorAll('.quick-filters button').forEach(b => b.classList.remove('active'));
  loadView();
}

function resetFilters() {
  currentFilter = { from: '', to: '' };
  document.getElementById('filter-from').value = '';
  document.getElementById('filter-to').value = '';
  document.getElementById('search-remarks').value = '';
  document.querySelector('.quick-filters button[data-range="all"]').classList.add('active');
  loadView();
}

function getFilterQuery() {
  const q = new URLSearchParams();
  if (currentQuarryId !== 'all') q.append('quarryId', currentQuarryId);
  if (currentFilter.from) q.append('from', currentFilter.from);
  if (currentFilter.to) q.append('to', currentFilter.to);
  const search = document.getElementById('search-remarks').value;
  if (search) q.append('search', search);
  return `?${q.toString()}`;
}

async function loadView() {
  const container = document.getElementById('view-container');
  container.innerHTML = '<div class="loader">Loading...</div>';
  try {
    if (currentView === 'dashboard') await renderDashboard();
    else if (currentView === 'reports') await renderReports();
    else if (currentView === 'form') renderForm();
    else if (currentView === 'daily') await renderDaily();
    else if (currentView === 'rates') await renderRates();
    else if (currentView === 'outstanding') await renderOutstanding();
    else if (currentView === 'recycle') await renderRecycle();
    else if (currentView === 'quarries') await renderQuarries();
    else if (currentView === 'export') renderExport();
    else if (currentView === 'settings') renderSettings();
  } catch (err) { container.innerHTML = `<div class="card text-danger">Error: ${err.message}</div>`; }
}

async function renderDashboard() {
  const data = await api(`/dashboard/summary${getFilterQuery()}`);
  const breakdown = await api(`/dashboard/breakdown${getFilterQuery()}`);
  const reports = await api(`/reports${getFilterQuery()}`);
  const rates = await api(`/rates${getFilterQuery()}`);
  const container = document.getElementById('view-container');
  
  const cards = [
    { label: 'Total Reports', value: fmtCount(data.count || 0) },
    { label: 'Total Revenue', value: fmtRupees(data.total_revenue_paise || 0) },
    { label: 'Total Expenses', value: fmtRupees(data.total_expenses_paise || 0) },
    { label: 'Net Value', value: fmtRupees(data.net_value_paise || 0) },
    { label: 'Amount Received', value: fmtRupees(data.total_received_paise || 0) },
    { label: 'Outstanding Short', value: fmtRupees(data.total_short_paise > 0 ? data.total_short_paise : 0) }
  ];

  container.innerHTML = `
    <div class="stats-grid">${cards.map(c => `<div class="stat-card"><div class="stat-label">${c.label}</div><div class="stat-value">${c.value}</div></div>`).join('')}</div>
    
    <div class="card">
      <h3 class="card-title">Revenue, Expenses & Cumulative Profit</h3>
      <div class="chart-container" style="height: 450px;"><canvas id="revExpChart" role="img" aria-label="Line chart showing revenue, expenses, and cumulative profit over time"></canvas></div>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
      <div class="card">
        <h3 class="card-title">Expense Breakdown</h3>
        <div class="chart-container" style="height: 400px;"><canvas id="expPieChart" role="img" aria-label="Doughnut chart showing breakdown of expenses"></canvas></div>
      </div>
      <div class="card">
        <h3 class="card-title">Weekly Net Value (Profit/Loss)</h3>
        <div class="chart-container" style="height: 400px;"><canvas id="netBarChart" role="img" aria-label="Bar chart showing weekly profit or loss"></canvas></div>
      </div>
    </div>

    <div class="card">
      <h3 class="card-title">Production Quantities (Bricks & Broken Loads)</h3>
      <div class="chart-container" style="height: 400px;"><canvas id="prodChart" role="img" aria-label="Line chart showing production quantities of bricks and broken loads"></canvas></div>
    </div>

    <div class="card">
      <h3 class="card-title">Historical Rate Changes (₹)</h3>
      <div class="chart-container" style="height: 300px;"><canvas id="rateChart" role="img" aria-label="Line chart showing historical rate changes"></canvas></div>
    </div>
  `;

  const allWeeks = [...new Set(reports.reports.map(r => r.week_from))].sort();
  const labels = allWeeks.map(w => fmtDate(w));
  const getReport = (week, quarryId) => reports.reports.find(r => r.week_from === week && r.quarry_id === Number(quarryId));

  ['chart1', 'chart2', 'chart3', 'chart4', 'chart5'].forEach(c => { if (window[c]) window[c].destroy(); });

  const getQuarryName = (id) => quarries.find(q => q.id === id)?.name || 'Unknown';
  const detailedTooltip = (ctx) => {
    const week = allWeeks[ctx.dataIndex];
    const qId = ctx.dataset.quarryId || currentQuarryId;
    const r = getReport(week, qId);
    if (!r) return `${ctx.dataset.label}: No data`;
    if (ctx.dataset.dataType === 'Revenue') {
      return [`Quarry: ${getQuarryName(r.quarry_id)}`, `1st: ${fmtCount(r.first_qty)} @ ${fmtRupees(r.first_rate_paise)} = ${fmtRupees(r.first_revenue_paise)}`, `2nd: ${fmtCount(r.second_qty)} @ ${fmtRupees(r.second_rate_paise)} = ${fmtRupees(r.second_revenue_paise)}`, `Broken: ${fmtCount(r.broken_loads)} @ ${fmtRupees(r.broken_rate_paise)} = ${fmtRupees(r.broken_revenue_paise)}`, `Total Revenue: ${fmtRupees(r.total_revenue_paise)}`];
    } else if (ctx.dataset.dataType === 'Production') {
       return [`Quarry: ${getQuarryName(r.quarry_id)}`, `1st Qty: ${fmtCount(r.first_qty)} (Rate: ${fmtRupees(r.first_rate_paise)})`, `2nd Qty: ${fmtCount(r.second_qty)} (Rate: ${fmtRupees(r.second_rate_paise)})`, `Broken: ${fmtCount(r.broken_loads)} (Rate: ${fmtRupees(r.broken_rate_paise)})`];
    }
    return `${ctx.dataset.label}: ${fmtRupees(ctx.raw * 100)}`;
  };

  let datasets1 = [];
  if (currentQuarryId === 'all') {
    quarries.forEach(q => {
      const revColor = q.id === 1 ? '#16a34a' : '#059669'; const expColor = q.id === 1 ? '#dc2626' : '#b91c1c';
      datasets1.push({ label: `Rev - ${q.name}`, dataType: 'Revenue', quarryId: q.id, data: allWeeks.map(w => { const r = getReport(w, q.id); return r ? r.total_revenue_paise / 100 : null; }), borderColor: revColor, yAxisID: 'y', tension: 0.2, fill: false, spanGaps: true });
      datasets1.push({ label: `Exp - ${q.name}`, dataType: 'Expense', quarryId: q.id, data: allWeeks.map(w => { const r = getReport(w, q.id); return r ? r.total_expenses_paise / 100 : null; }), borderColor: expColor, yAxisID: 'y', tension: 0.2, fill: false, spanGaps: true });
    });
  } else {
    let cumNet = 0;
    datasets1 = [
      { label: 'Revenue', dataType: 'Revenue', quarryId: currentQuarryId, data: allWeeks.map(w => { const r = getReport(w, currentQuarryId); return r ? r.total_revenue_paise / 100 : null; }), borderColor: '#16a34a', yAxisID: 'y', tension: 0.2, fill: false, spanGaps: true },
      { label: 'Expenses', dataType: 'Expense', quarryId: currentQuarryId, data: allWeeks.map(w => { const r = getReport(w, currentQuarryId); return r ? r.total_expenses_paise / 100 : null; }), borderColor: '#dc2626', yAxisID: 'y', tension: 0.2, fill: false, spanGaps: true },
      { label: 'Cumulative Profit', dataType: 'Profit', quarryId: currentQuarryId, data: allWeeks.map(w => { const r = getReport(w, currentQuarryId); if(!r) return null; cumNet += r.net_value_paise / 100; return cumNet; }), borderColor: '#2563eb', yAxisID: 'y1', tension: 0.1, fill: true, borderDash: [5, 5], spanGaps: true }
    ];
  }
  window.chart1 = new Chart(document.getElementById('revExpChart').getContext('2d'), {
    type: 'line', data: { labels, datasets: datasets1 },
    options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { y: { ticks: { callback: fmtAxis }, title: { display: true, text: 'Weekly Amount (₹)' } }, y1: { ticks: { callback: fmtAxis }, title: { display: true, text: 'Cumulative Profit (₹)' }, grid: { drawOnChartArea: false } } }, plugins: { tooltip: { callbacks: { label: detailedTooltip } } } }
  });

  const expData = [breakdown.labour, breakdown.diesel, breakdown.spare_parts, breakdown.fitting, breakdown.jcb, breakdown.cutting_wheel, breakdown.mess, breakdown.other];
  const totalExp = expData.reduce((a, b) => a + b, 0);
  window.chart2 = new Chart(document.getElementById('expPieChart').getContext('2d'), {
    type: 'doughnut', data: { labels: ['Labour', 'Diesel', 'Spare Parts', 'Fitting', 'JCB', 'Cutting Wheel', 'Mess', 'Other'], datasets: [{ data: expData, backgroundColor: ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6', '#6b7280'] }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${fmtRupees(ctx.raw)}` } } } }
  });

  let datasets3 = [];
  if (currentQuarryId === 'all') {
    quarries.forEach(q => datasets3.push({ label: `Net - ${q.name}`, data: allWeeks.map(w => { const r = getReport(w, q.id); return r ? r.net_value_paise / 100 : null; }), backgroundColor: q.id === 1 ? 'rgba(37, 99, 235, 0.7)' : 'rgba(245, 158, 11, 0.7)' }));
  } else {
    datasets3 = [{ label: 'Net Value', data: allWeeks.map(w => { const r = getReport(w, currentQuarryId); return r ? r.net_value_paise / 100 : null; }), backgroundColor: allWeeks.map(w => { const r = getReport(w, currentQuarryId); return r && r.net_value_paise < 0 ? 'rgba(220, 38, 38, 0.7)' : 'rgba(22, 163, 74, 0.7)'; }) }];
  }
  window.chart3 = new Chart(document.getElementById('netBarChart').getContext('2d'), {
    type: 'bar', data: { labels, datasets: datasets3 },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { callback: fmtAxis } } }, plugins: { tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmtRupees(ctx.raw * 100)}` } } } }
  });

  let datasets4 = [];
  if (currentQuarryId === 'all') {
    quarries.forEach(q => {
      datasets4.push({ label: `1st Qty - ${q.name}`, dataType: 'Production', quarryId: q.id, data: allWeeks.map(w => { const r = getReport(w, q.id); return r ? r.first_qty : null; }), borderColor: q.id === 1 ? 'rgba(37, 99, 235, 1)' : 'rgba(96, 165, 250, 1)', yAxisID: 'y', tension: 0.2, fill: false, spanGaps: true });
      datasets4.push({ label: `2nd Qty - ${q.name}`, dataType: 'Production', quarryId: q.id, data: allWeeks.map(w => { const r = getReport(w, q.id); return r ? r.second_qty : null; }), borderColor: q.id === 1 ? 'rgba(245, 158, 11, 1)' : 'rgba(252, 211, 77, 1)', yAxisID: 'y', tension: 0.2, fill: false, spanGaps: true });
      datasets4.push({ label: `Broken - ${q.name}`, dataType: 'Production', quarryId: q.id, data: allWeeks.map(w => { const r = getReport(w, q.id); return r ? r.broken_loads : null; }), borderColor: q.id === 1 ? 'rgba(107, 114, 128, 1)' : 'rgba(156, 163, 175, 1)', yAxisID: 'y1', tension: 0.2, fill: false, spanGaps: true, borderDash: [5, 5] });
    });
  } else {
    datasets4 = [
      { label: 'Production', dataType: 'Production', quarryId: currentQuarryId, data: allWeeks.map(w => { const r = getReport(w, currentQuarryId); return r ? r.first_qty : null; }), borderColor: 'rgba(37, 99, 235, 1)', yAxisID: 'y', tension: 0.2, fill: false, spanGaps: true },
      { label: 'Second Quality (Nos)', dataType: 'Production', quarryId: currentQuarryId, data: allWeeks.map(w => { const r = getReport(w, currentQuarryId); return r ? r.second_qty : null; }), borderColor: 'rgba(245, 158, 11, 1)', yAxisID: 'y', tension: 0.2, fill: false, spanGaps: true },
      { label: 'Broken Loads', dataType: 'Production', quarryId: currentQuarryId, data: allWeeks.map(w => { const r = getReport(w, currentQuarryId); return r ? r.broken_loads : null; }), borderColor: 'rgba(107, 114, 128, 1)', yAxisID: 'y1', tension: 0.2, fill: false, spanGaps: true, borderDash: [5, 5] }
    ];
  }
  window.chart4 = new Chart(document.getElementById('prodChart').getContext('2d'), {
    type: 'line', data: { labels, datasets: datasets4 },
    options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { y: { title: { display: true, text: 'Bricks (Nos)' }, beginAtZero: true }, y1: { position: 'right', title: { display: true, text: 'Broken Loads' }, grid: { drawOnChartArea: false }, beginAtZero: true } }, plugins: { tooltip: { callbacks: { label: detailedTooltip } } } }
  });

  const sortedRates = [...rates].sort((a, b) => new Date(a.effective_from) - new Date(b.effective_from));
  window.chart5 = new Chart(document.getElementById('rateChart').getContext('2d'), {
    type: 'line', data: { labels: sortedRates.map(r => fmtDate(r.effective_from)), datasets: [
      { label: 'First Quality Rate', data: sortedRates.filter(r => r.product === 'first_quality').map(r => r.rate_paise / 100), borderColor: 'rgba(37, 99, 235, 1)', stepped: true, fill: false },
      { label: 'Second Quality Rate', data: sortedRates.filter(r => r.product === 'second_quality').map(r => r.rate_paise / 100), borderColor: 'rgba(245, 158, 11, 1)', stepped: true, fill: false },
      { label: 'Broken Load Rate', data: sortedRates.filter(r => r.product === 'broken_load').map(r => r.rate_paise / 100), borderColor: 'rgba(107, 114, 128, 1)', stepped: true, fill: false }
    ]}, options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { callback: (v) => '₹' + v } } }, plugins: { tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmtRupees(ctx.raw * 100)}` } } } }
  });
}

async function renderReports() {
  const data = await api(`/reports${getFilterQuery()}`);
  const container = document.getElementById('view-container');
  if (data.reports.length === 0) { container.innerHTML = `<div class="card"><p>No reports found.</p></div>`; return; }
  container.innerHTML = `<div class="card" style="overflow-x: auto;"><table><thead><tr><th>No.</th><th>Week From</th><th>Week To</th><th class="text-right">Expenses</th><th class="text-right">Revenue</th><th class="text-right">Net</th><th class="text-right">Short</th><th>Actions</th></tr></thead><tbody>${data.reports.map((r, i) => `<tr><td>${i + 1}</td><td>${fmtDate(r.week_from)}</td><td>${fmtDate(r.week_to)}</td><td class="text-right">${fmtRupees(r.total_expenses_paise)}</td><td class="text-right">${fmtRupees(r.total_revenue_paise)}</td><td class="text-right ${r.net_value_paise < 0 ? 'text-danger' : ''}">${fmtRupees(r.net_value_paise)}</td><td class="text-right ${r.short_amount_paise > 0 ? 'text-warning' : 'text-success'}">${fmtRupees(r.short_amount_paise)}</td><td class="action-btns"><button onclick="editReport(${r.id})">Edit</button><a href="/print.html?id=${r.id}" target="_blank">Print</a><button onclick="deleteReport(${r.id})" style="color:var(--danger)">Delete</button></td></tr>`).join('')}</tbody></table></div>`;
}

function renderForm(reportData = null) {
  const container = document.getElementById('view-container');
  container.innerHTML = `
    <form id="reportForm" class="card">
      <input type="hidden" id="reportId" value="${reportData?.id || ''}">
      <div class="form-group" style="margin-bottom: 1.5rem; max-width: 300px;">
        <label for="quarry_id" style="font-weight: bold; color: var(--primary);">Select Quarry</label>
        <select id="quarry_id" required>
          ${quarries.map(q => `<option value="${q.id}" ${((reportData?.quarry_id || currentQuarryId) == q.id) ? 'selected' : ''}>${q.name}</option>`).join('')}
        </select>
      </div>
      <h3 class="card-title">A. Period & Workforce</h3>
      <div class="form-grid" style="margin-bottom: 1.5rem;">
        <div class="form-group"><label for="week_from">Week From</label><input type="date" id="week_from" value="${reportData?.week_from || ''}" required></div>
        <div class="form-group"><label for="week_to">Week To</label><input type="date" id="week_to" value="${reportData?.week_to || ''}" required></div>
        <div class="form-group"><label for="working_days">Working Days</label><input type="number" id="working_days" value="${reportData?.working_days || 0}"></div>
        <div class="form-group"><label for="labourers_count">No. of Labourers</label><input type="number" id="labourers_count" value="${reportData?.labourers_count || 0}"></div>
        <div class="form-group"><label for="labour_payment">Labour Payment (₹)</label><input type="text" id="labour_payment" value="${reportData ? (reportData.labour_payment_paise/100) : ''}"></div>
      </div>
      <h3 class="card-title">B. Operating Expenses (₹)</h3>
      <div class="form-grid" style="margin-bottom: 1.5rem;">
        <div class="form-group"><label for="diesel">Diesel</label><input type="text" id="diesel" value="${reportData ? (reportData.diesel_paise/100) : ''}"></div>
        <div class="form-group"><label for="spare_parts">Spare Parts</label><input type="text" id="spare_parts" value="${reportData ? (reportData.spare_parts_paise/100) : ''}"></div>
        <div class="form-group"><label for="fitting">Fitting</label><input type="text" id="fitting" value="${reportData ? (reportData.fitting_paise/100) : ''}"></div>
        <div class="form-group"><label for="jcb">JCB</label><input type="text" id="jcb" value="${reportData ? (reportData.jcb_paise/100) : ''}"></div>
        <div class="form-group"><label for="cutting_wheel">Cutting Wheel</label><input type="text" id="cutting_wheel" value="${reportData ? (reportData.cutting_wheel_paise/100) : ''}"></div>
        <div class="form-group"><label for="mess">Mess</label><input type="text" id="mess" value="${reportData ? (reportData.mess_paise/100) : ''}"></div>
        <div class="form-group"><label for="other">Other</label><input type="text" id="other" value="${reportData ? (reportData.other_paise/100) : ''}"></div>
      </div>
      <h3 class="card-title">C. Production & Rates</h3>
      <div class="form-grid" style="margin-bottom: 1.5rem;">
        <div class="form-group"><label for="first_qty">First Quality Bricks</label><input type="number" id="first_qty" value="${reportData?.first_qty || 0}"></div>
        <div class="form-group"><label for="first_rate">First Rate (₹)</label><input type="text" id="first_rate" value="${reportData ? (reportData.first_rate_paise/100) : '38'}"></div>
        <div class="form-group"><label for="second_qty">Second Quality Bricks</label><input type="number" id="second_qty" value="${reportData?.second_qty || 0}"></div>
        <div class="form-group"><label for="second_rate">Second Rate (₹)</label><input type="text" id="second_rate" value="${reportData ? (reportData.second_rate_paise/100) : '28'}"></div>
        <div class="form-group"><label for="broken_loads">Broken Loads</label><input type="text" id="broken_loads" value="${reportData?.broken_loads || 0}"></div>
        <div class="form-group"><label for="broken_rate">Broken Rate (₹)</label><input type="text" id="broken_rate" value="${reportData ? (reportData.broken_rate_paise/100) : '850'}"></div>
      </div>
      <h3 class="card-title">D. Financial Summary</h3>
      <div class="form-grid" style="margin-bottom: 1.5rem;">
        <div class="form-group"><label for="land_lease">Land Lease (₹)</label><input type="text" id="land_lease" value="${reportData ? (reportData.land_lease_paise/100) : '5000'}"></div>
        <div class="form-group"><label for="received">Amount Received (₹)</label><input type="text" id="received" value="${reportData ? (reportData.received_paise/100) : ''}"></div>
      </div>
      <div class="form-group" style="margin-bottom: 1.5rem;">
        <label for="remarks">Remarks</label>
        <textarea id="remarks" rows="3" placeholder="Optional notes...">${reportData?.remarks || ''}</textarea>
      </div>
      <div class="summary-bar"><div>Total Expenses: <span id="sum-expenses">₹0.00</span></div><div>Total Revenue: <span id="sum-revenue">₹0.00</span></div><div>Net Value: <span id="sum-net">₹0.00</span></div><div>Short Amount: <span id="sum-short">₹0.00</span></div></div>
      <div style="margin-top: 2rem; text-align: right;"><button type="submit" class="btn btn-primary">Save Report</button></div>
    </form>`;
  document.querySelectorAll('#reportForm input, #reportForm textarea').forEach(input => input.addEventListener('input', calculateLive));
  document.getElementById('reportForm').addEventListener('submit', handleSubmit);
  calculateLive();
}

function calculateLive() {
  const getVal = (id) => { const el = document.getElementById(id); if (!el) return 0; return parseFloat(el.value.replace(/[₹,\s]/g, '')) || 0; };
  const paise = (v) => Math.round(v * 100);
  const expenses = paise(getVal('labour_payment')) + paise(getVal('diesel')) + paise(getVal('spare_parts')) + paise(getVal('fitting')) + paise(getVal('jcb')) + paise(getVal('cutting_wheel')) + paise(getVal('mess')) + paise(getVal('other'));
  const revenue = (getVal('first_qty') * paise(getVal('first_rate'))) + (getVal('second_qty') * paise(getVal('second_rate'))) + (getVal('broken_loads') * paise(getVal('broken_rate')));
  const net = revenue - expenses - paise(getVal('land_lease'));
  const short = net - paise(getVal('received'));
  document.getElementById('sum-expenses').innerText = fmtRupees(expenses);
  document.getElementById('sum-revenue').innerText = fmtRupees(revenue);
  document.getElementById('sum-net').innerText = fmtRupees(net);
  document.getElementById('sum-short').innerText = fmtRupees(short);
}

async function handleSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('reportId').value;
  const payload = {
    quarry_id: document.getElementById('quarry_id').value, week_from: document.getElementById('week_from').value, week_to: document.getElementById('week_to').value,
    working_days: document.getElementById('working_days').value, labourers_count: document.getElementById('labourers_count').value, labour_payment: document.getElementById('labour_payment').value,
    diesel: document.getElementById('diesel').value, spare_parts: document.getElementById('spare_parts').value, fitting: document.getElementById('fitting').value, jcb: document.getElementById('jcb').value,
    cutting_wheel: document.getElementById('cutting_wheel').value, mess: document.getElementById('mess').value, other: document.getElementById('other').value,
    first_qty: document.getElementById('first_qty').value, second_qty: document.getElementById('second_qty').value, broken_loads: document.getElementById('broken_loads').value,
    first_rate: document.getElementById('first_rate').value, second_rate: document.getElementById('second_rate').value, broken_rate: document.getElementById('broken_rate').value,
    land_lease: document.getElementById('land_lease').value, received: document.getElementById('received').value,
    remarks: document.getElementById('remarks').value // SEC-02 FIX: Added remarks payload
  };
  try {
    if (id) { await api(`/reports/${id}`, 'PUT', payload); alert('Updated!'); } else { await api('/reports', 'POST', payload); alert('Report saved successfully!'); }
    document.querySelector('[data-view=reports]').click();
  } catch (err) { alert('Error: ' + err.message); }
}

async function editReport(id) {
  const report = await api(`/reports/${id}`);
  document.querySelector('[data-view=form]').click();
  setTimeout(() => renderForm(report), 100);
}

async function deleteReport(id) {
  if (confirm('Delete this report? It will go to the Recycle Bin.')) { await api(`/reports/${id}`, 'DELETE'); loadView(); }
}

async function renderDaily() {
  const logs = await api(`/daily${getFilterQuery()}`);
  const container = document.getElementById('view-container');
  container.innerHTML = `
    <div class="card">
      <h3 class="card-title">Add Daily Log</h3>
      <form id="dailyForm" class="form-grid">
        <div class="form-group"><label for="d_date">Date</label><input type="date" id="d_date" required></div>
        <div class="form-group"><label for="d_first">First Qty</label><input type="number" id="d_first" value="0"></div>
        <div class="form-group"><label for="d_second">Second Qty</label><input type="number" id="d_second" value="0"></div>
        <div class="form-group"><label for="d_broken">Broken Loads</label><input type="text" id="d_broken" value="0"></div>
        <div class="form-group"><label for="d_diesel">Diesel ₹</label><input type="text" id="d_diesel" value="0"></div>
        <div class="form-group"><label for="d_labour">Labour ₹</label><input type="text" id="d_labour" value="0"></div>
        <div class="form-group"><label for="d_jcb">JCB ₹</label><input type="text" id="d_jcb" value="0"></div>
        <div class="form-group"><label for="d_other">Other ₹</label><input type="text" id="d_other" value="0"></div>
        <div style="align-self: flex-end;"><button type="submit" class="btn btn-primary">Save Log</button></div>
      </form>
    </div>
    <div class="card"><h3 class="card-title">Recent Logs</h3><table><thead><tr><th>Date</th><th>1st Qty</th><th>2nd Qty</th><th>Broken</th><th class="text-right">Expenses</th><th>Actions</th></tr></thead><tbody>${logs.map(l => `<tr><td>${fmtDate(l.log_date)}</td><td>${l.first_qty}</td><td>${l.second_qty}</td><td>${l.broken_loads}</td><td class="text-right">${fmtRupees(l.diesel_paise + l.labour_payment_paise + l.jcb_paise + l.other_paise)}</td><td><button onclick="deleteLog(${l.id})" style="color:var(--danger); background:none; border:none; cursor:pointer;">Delete</button></td></tr>`).join('')}</tbody></table></div>`;
  document.getElementById('dailyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/daily', 'POST', { quarry_id: currentQuarryId, log_date: document.getElementById('d_date').value, first_qty: document.getElementById('d_first').value, second_qty: document.getElementById('d_second').value, broken_loads: document.getElementById('d_broken').value, diesel: document.getElementById('d_diesel').value, labour_payment: document.getElementById('d_labour').value, jcb: document.getElementById('d_jcb').value, other: document.getElementById('d_other').value });
      renderDaily();
    } catch(err) { alert('Error: ' + err.message); }
  });
}

async function deleteLog(id) { if(confirm('Delete log?')) { await api(`/daily/${id}`, 'DELETE'); renderDaily(); } }

async function renderRates() {
  const rates = await api(`/rates?quarryId=${currentQuarryId}`);
  const container = document.getElementById('view-container');
  container.innerHTML = `<div class="card"><h3 class="card-title">Set New Rate</h3><form id="rateForm" class="form-grid"><div class="form-group"><label for="rate_product">Product</label><select id="rate_product"><option value="first_quality">First Quality</option><option value="second_quality">Second Quality</option><option value="broken_load">Broken Load</option></select></div><div class="form-group"><label for="rate_value">New Rate (₹)</label><input type="text" id="rate_value" required></div><div class="form-group"><label for="rate_from">Effective From</label><input type="date" id="rate_from" required></div><div style="align-self: flex-end;"><button type="submit" class="btn btn-primary">Save Rate</button></div></form></div><div class="card"><h3 class="card-title">Rate History</h3><table><thead><tr><th>Product</th><th>Rate</th><th>Effective From</th></tr></thead><tbody>${rates.map(r => `<tr><td>${r.product}</td><td>${fmtRupees(r.rate_paise)}</td><td>${fmtDate(r.effective_from)}</td></tr>`).join('')}</tbody></table></div>`;
  document.getElementById('rateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api('/rates', 'POST', { quarry_id: currentQuarryId, product: document.getElementById('rate_product').value, rate: document.getElementById('rate_value').value, effective_from: document.getElementById('rate_from').value }); renderRates(); } catch(err) { alert('Error: ' + err.message); }
  });
}

async function renderOutstanding() {
  const data = await api(`/dashboard/outstanding?quarryId=${currentQuarryId}`);
  const container = document.getElementById('view-container');
  const total = data.reduce((s, r) => s + r.short_amount_paise, 0);
  container.innerHTML = `<div class="card"><h3 class="card-title">Outstanding Balances (Money Owed to You)</h3><div class="stat-card" style="margin-bottom: 1rem;"><div class="stat-label">Total Pending</div><div class="stat-value text-warning">${fmtRupees(total)}</div></div><table><thead><tr><th>Week From</th><th>Week To</th><th class="text-right">Net Value</th><th class="text-right">Received</th><th class="text-right">Short Amount</th></tr></thead><tbody>${data.map(r => `<tr><td>${fmtDate(r.week_from)}</td><td>${fmtDate(r.week_to)}</td><td class="text-right">${fmtRupees(r.net_value_paise)}</td><td class="text-right">${fmtRupees(r.received_paise)}</td><td class="text-right text-warning">${fmtRupees(r.short_amount_paise)}</td></tr>`).join('')}</tbody></table></div>`;
}

async function renderRecycle() {
  const data = await api('/reports/deleted');
  const container = document.getElementById('view-container');
  if (data.length === 0) { container.innerHTML = `<div class="card"><p>Recycle bin is empty.</p></div>`; return; }
  container.innerHTML = `<div class="card"><h3 class="card-title">Deleted Reports (Restorable for 30 days)</h3><table><thead><tr><th>Deleted On</th><th>Original Period</th><th class="text-right">Revenue</th><th>Actions</th></tr></thead><tbody>${data.map(d => `<tr><td>${fmtDate(d.deleted_at.split('T')[0])}</td><td>${fmtDate(d.report.week_from)} to ${fmtDate(d.report.week_to)}</td><td class="text-right">${fmtRupees(d.report.total_revenue_paise)}</td><td><button onclick="restoreReport(${d.id})" class="btn btn-primary">Restore</button></td></tr>`).join('')}</tbody></table></div>`;
}

async function restoreReport(id) { await api(`/reports/restore/${id}`, 'POST'); alert('Restored!'); renderRecycle(); }

async function renderQuarries() {
  const container = document.getElementById('view-container');
  container.innerHTML = `<div class="card"><h3 class="card-title">Add New Quarry</h3><form id="quarryForm" class="form-grid"><div class="form-group"><label for="quarry_name">Quarry Name</label><input type="text" id="quarry_name" required></div><div style="align-self: flex-end;"><button type="submit" class="btn btn-primary">Add Quarry</button></div></form></div><div class="card"><h3 class="card-title">Existing Quarries</h3><table><thead><tr><th>ID</th><th>Name</th></tr></thead><tbody>${quarries.map(q => `<tr><td>${q.id}</td><td>${q.name}</td></tr>`).join('')}</tbody></table></div>`;
  document.getElementById('quarryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { const newQ = await api('/dashboard/quarries', 'POST', { name: document.getElementById('quarry_name').value }); quarries.push(newQ); const selector = document.getElementById('quarry-selector'); selector.innerHTML += `<option value="${newQ.id}">${newQ.name}</option>`; renderQuarries(); } catch(err) { alert('Error: ' + err.message); }
  });
}

function renderExport() {
  const container = document.getElementById('view-container');
  const filterQuery = getFilterQuery();
  container.innerHTML = `<div class="card"><h3 class="card-title">Export Data</h3><p>Export reports for the currently selected quarry.</p><div style="margin-top: 1rem; display: flex; gap: 1rem;"><a href="/api/export/xlsx${filterQuery}" class="btn btn-primary">Download Excel (.xlsx)</a><a href="/api/export/csv${filterQuery}" class="btn btn-secondary">Download CSV (.csv)</a></div></div>`;
}

function renderSettings() {
  const container = document.getElementById('view-container');
  container.innerHTML = `<div class="card"><h3 class="card-title">Backup & Restore</h3><p>Download a full backup of all quarries, reports, and settings in JSON format.</p><div style="margin-top: 1rem; display: flex; gap: 1rem;"><a href="/api/settings/export-json" class="btn btn-primary">Download Backup (JSON)</a></div><hr style="margin: 2rem 0; border: 0; border-top: 1px solid var(--border);"><h3 class="card-title">Restore from Backup</h3><p>Upload a previously downloaded JSON backup file. Warning: This will overwrite all current data!</p><input type="file" id="import-file" accept=".json" class="btn btn-secondary" style="margin-top: 1rem;"><button id="btn-import" class="btn btn-danger" style="margin-top: 1rem;">Upload and Overwrite Data</button></div>`;
  document.getElementById('btn-import').addEventListener('click', async () => {
    const fileInput = document.getElementById('import-file');
    if (fileInput.files.length === 0) return alert('Please select a file first.');
    if (!confirm('Are you sure? This will DELETE all current data and replace it with the backup.')) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try { const data = JSON.parse(e.target.result); await api('/settings/import-json', 'POST', data); alert('Data restored successfully!'); } catch (err) { alert('Error: ' + err.message); }
    };
    reader.readAsText(fileInput.files[0]);
  });
}