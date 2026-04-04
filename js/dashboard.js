// ════════════════════════════════════════
// DASHBOARD + CHARTS
// ════════════════════════════════════════

let chartKategori = null;
let chartTren     = null;

const CHART_COLORS = [
  '#3b82f6','#10b981','#f59e0b','#f43f5e',
  '#8b5cf6','#06b6d4','#84cc16','#ec4899','#64748b'
];

async function loadDashboard() {
  const bulan = getBulanAktif() || new Date().toISOString().slice(0, 7);
  const start = bulan + '-01';
  const end   = getEndOfMonth(bulan);

  const [
    { data: pemasukan },
    { data: pengeluaran },
    { data: goals },
    { data: allPemasukan },
    { data: allPengeluaran },
    { data: transferMasuk },
    { data: transferKeluar }
  ] = await Promise.all([
    db.from('pemasukan').select('*').gte('tanggal', start).lte('tanggal', end),
    db.from('pengeluaran').select('*').gte('tanggal', start).lte('tanggal', end),
    db.from('goals').select('*').order('created_at', { ascending: false }),
    db.from('pemasukan').select('dompet_id, nominal'),
    db.from('pengeluaran').select('dompet_id, nominal'),
    db.from('transfer').select('ke_dompet, nominal'),
    db.from('transfer').select('dari_dompet, nominal'),
  ]);

  const totalIn  = (pemasukan || []).reduce((s, r) => s + Number(r.nominal), 0);
  const totalOut = (pengeluaran || []).reduce((s, r) => s + Number(r.nominal), 0);
  const tabungan = (goals || []).reduce((s, g) => s + Number(g.terkumpul), 0);

  // Hitung total saldo semua dompet
  const saldoMap = {};
  (_dompetCache || []).forEach(d => { saldoMap[d.id] = Number(d.saldo_awal); });
  (allPemasukan || []).forEach(p => { if (p.dompet_id) saldoMap[p.dompet_id] = (saldoMap[p.dompet_id] || 0) + Number(p.nominal); });
  (allPengeluaran || []).forEach(p => { if (p.dompet_id) saldoMap[p.dompet_id] = (saldoMap[p.dompet_id] || 0) - Number(p.nominal); });
  (transferMasuk || []).forEach(t => { saldoMap[t.ke_dompet] = (saldoMap[t.ke_dompet] || 0) + Number(t.nominal); });
  (transferKeluar || []).forEach(t => { saldoMap[t.dari_dompet] = (saldoMap[t.dari_dompet] || 0) - Number(t.nominal); });
  const totalSaldo = Object.values(saldoMap).reduce((s, v) => s + v, 0);

  document.getElementById('totalPemasukan').textContent  = formatRp(totalIn);
  document.getElementById('totalPengeluaran').textContent = formatRp(totalOut);
  document.getElementById('totalSaldo').textContent       = formatRp(totalSaldo);
  document.getElementById('totalTabungan').textContent    = formatRp(tabungan);

  const saldoEl = document.getElementById('totalSaldo');
  saldoEl.style.color = totalSaldo >= 0 ? 'var(--blue2)' : 'var(--red2)';

  renderChartKategori(pengeluaran || []);
  await renderChartTren();
  renderGoals(goals || []);
  updateTotalGoals(goals || []);
  renderRecentTransaksi(pemasukan || [], pengeluaran || []);
}

function renderChartKategori(pengeluaran) {
  const katMap = {};
  pengeluaran.forEach(p => {
    katMap[p.kategori] = (katMap[p.kategori] || 0) + Number(p.nominal);
  });

  const labels = Object.keys(katMap);
  const values = Object.values(katMap);
  const ctx = document.getElementById('chartKategori').getContext('2d');
  if (chartKategori) chartKategori.destroy();

  if (!labels.length) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = '#64748b';
    ctx.font = '13px Plus Jakarta Sans';
    ctx.textAlign = 'center';
    ctx.fillText('Belum ada pengeluaran bulan ini', ctx.canvas.width / 2, ctx.canvas.height / 2);
    return;
  }

  chartKategori = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: CHART_COLORS.slice(0, labels.length),
        borderColor: '#080d1a',
        borderWidth: 3,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 11 }, padding: 12, boxWidth: 12, boxHeight: 12 }
        },
        tooltip: {
          callbacks: { label: ctx => ' ' + formatRp(ctx.raw) },
          backgroundColor: '#0d1526', borderColor: '#1e293b', borderWidth: 1,
          titleColor: '#e2e8f0', bodyColor: '#94a3b8', padding: 10
        }
      }
    }
  });
}

async function renderChartTren() {
  const months = [], labels = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
    months.push(d.toISOString().slice(0, 7));
    labels.push(d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }));
  }

  const firstMonth = months[0] + '-01';
  const lastMonth  = getEndOfMonth(months[months.length - 1]);

  const [{ data: masuk }, { data: keluar }] = await Promise.all([
    db.from('pemasukan').select('tanggal,nominal').gte('tanggal', firstMonth).lte('tanggal', lastMonth),
    db.from('pengeluaran').select('tanggal,nominal').gte('tanggal', firstMonth).lte('tanggal', lastMonth)
  ]);

  const dataMasuk  = months.map(m => (masuk  || []).filter(r => r.tanggal.startsWith(m)).reduce((s,r) => s+Number(r.nominal), 0));
  const dataKeluar = months.map(m => (keluar || []).filter(r => r.tanggal.startsWith(m)).reduce((s,r) => s+Number(r.nominal), 0));

  const ctx = document.getElementById('chartTren').getContext('2d');
  if (chartTren) chartTren.destroy();

  chartTren = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Pemasukan', data: dataMasuk, backgroundColor: 'rgba(16,185,129,0.7)', borderColor: '#10b981', borderWidth: 1.5, borderRadius: 6, borderSkipped: false },
        { label: 'Pengeluaran', data: dataKeluar, backgroundColor: 'rgba(244,63,94,0.7)', borderColor: '#f43f5e', borderWidth: 1.5, borderRadius: 6, borderSkipped: false }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 11 }, boxWidth: 12, boxHeight: 12 } },
        tooltip: {
          callbacks: { label: ctx => ' ' + formatRp(ctx.raw) },
          backgroundColor: '#0d1526', borderColor: '#1e293b', borderWidth: 1,
          titleColor: '#e2e8f0', bodyColor: '#94a3b8', padding: 10
        }
      },
      scales: {
        x: { ticks: { color: '#64748b', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' }, border: { color: 'rgba(255,255,255,0.06)' } },
        y: {
          ticks: { color: '#64748b', font: { size: 10 }, callback: v => 'Rp ' + (v >= 1000000 ? (v/1000000).toFixed(1)+'jt' : v >= 1000 ? (v/1000).toFixed(0)+'rb' : v) },
          grid: { color: 'rgba(255,255,255,0.04)' }, border: { color: 'rgba(255,255,255,0.06)' }
        }
      }
    }
  });
}

function renderRecentTransaksi(pemasukan, pengeluaran) {
  const container = document.getElementById('dashTransaksi');
  const all = [
    ...(pemasukan || []).map(r => ({ ...r, type: 'in',  label: r.sumber })),
    ...(pengeluaran || []).map(r => ({ ...r, type: 'out', label: r.deskripsi }))
  ].sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal)).slice(0, 6);

  if (!all.length) {
    container.innerHTML = '<div class="empty-state">Belum ada transaksi bulan ini.</div>';
    return;
  }

  container.innerHTML = all.map(t => `
    <div class="txn-item">
      <div class="txn-icon ${t.type}">${t.type === 'in' ? '↓' : '↑'}</div>
      <div class="txn-info">
        <div class="txn-desc">${esc(t.label)}</div>
        <div class="txn-date">${formatTgl(t.tanggal)}${t.dompet_id ? ' · ' + getDompetLabel(t.dompet_id) : ''}${t.type === 'out' ? ' · ' + esc(t.kategori) : ''}</div>
      </div>
      <div class="txn-amount ${t.type}">${t.type === 'in' ? '+' : '-'}${formatRp(t.nominal)}</div>
    </div>
  `).join('');
}
