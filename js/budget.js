// ════════════════════════════════════════
// BUDGET
// ════════════════════════════════════════

async function loadBudget() {
  const bulan = document.getElementById('budgetViewBulan')?.value || new Date().toISOString().slice(0,7);
  const end   = getEndOfMonth(bulan);

  const [{ data: budgets }, { data: pengeluaran }] = await Promise.all([
    db.from('budget').select('*').eq('bulan', bulan),
    db.from('pengeluaran').select('*').gte('tanggal', bulan + '-01').lte('tanggal', end)
  ]);

  renderBudget(budgets || [], pengeluaran || []);
}

function renderBudget(budgets, pengeluaran) {
  const container = document.getElementById('budgetList');

  const realisasi = {};
  pengeluaran.forEach(p => {
    realisasi[p.kategori] = (realisasi[p.kategori] || 0) + Number(p.nominal);
  });

  if (!budgets.length) {
    container.innerHTML = '<div class="empty-state">Belum ada budget. Set budget dulu!</div>';
    return;
  }

  container.innerHTML = budgets.map(b => {
    const real = realisasi[b.kategori] || 0;
    const pct  = b.nominal_budget > 0 ? Math.min((real / b.nominal_budget) * 100, 100) : 0;
    const over = real > b.nominal_budget;
    const warn = pct >= 80 && !over;
    const fillClass = over ? 'danger' : warn ? 'warning' : 'safe';
    const sisa = b.nominal_budget - real;

    return `
      <div class="budget-item">
        <div class="budget-header">
          <div class="budget-kat">${esc(b.kategori)}</div>
          <button class="btn-delete" onclick="deleteBudget('${b.id}')">✕</button>
        </div>
        <div class="budget-nums">
          <span>${formatRp(real)} dari ${formatRp(b.nominal_budget)}</span>
          <span class="${over ? 'over' : 'ok'}">${over ? '⚠ Lebih ' + formatRp(Math.abs(sisa)) : 'Sisa ' + formatRp(sisa)}</span>
        </div>
        <div class="budget-bar">
          <div class="budget-fill ${fillClass}" style="width:${pct}%"></div>
        </div>
        ${over
          ? `<div class="budget-warning-label" style="color:var(--red2)">⚠ Melebihi budget!</div>`
          : warn
          ? `<div class="budget-warning-label" style="color:var(--orange2)">⚡ Hampir habis (${Math.round(pct)}%)</div>`
          : ''}
      </div>
    `;
  }).join('');
}

async function saveBudget() {
  const bulan    = document.getElementById('budgetBulan').value;
  const kategori = document.getElementById('budgetKategori').value;
  const nominal  = Number(document.getElementById('budgetNominal').value);
  const msg      = document.getElementById('budgetMsg');

  if (!bulan || !kategori || !nominal) {
    showMsg(msg, 'Semua field wajib diisi!', 'error'); return;
  }

  const { data: existing } = await db.from('budget')
    .select('id').eq('bulan', bulan).eq('kategori', kategori).single();

  let error;
  if (existing) {
    ({ error } = await db.from('budget').update({ nominal_budget: nominal }).eq('id', existing.id));
  } else {
    ({ error } = await db.from('budget').insert([{ bulan, kategori, nominal_budget: nominal }]));
  }

  if (error) { showMsg(msg, 'Gagal: ' + error.message, 'error'); return; }

  showMsg(msg, '✓ Budget disimpan!', 'success');
  document.getElementById('budgetNominal').value = '';
  loadBudget();
}

async function deleteBudget(id) {
  if (!confirm('Hapus budget ini?')) return;
  await db.from('budget').delete().eq('id', id);
  loadBudget();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnSaveBudget')?.addEventListener('click', saveBudget);
});
