// ════════════════════════════════════════
// DOMPET
// ════════════════════════════════════════

const WARNA_OPTIONS = [
  { value: 'blue',   label: '🔵 Biru'   },
  { value: 'green',  label: '🟢 Hijau'  },
  { value: 'teal',   label: '🩵 Teal'   },
  { value: 'orange', label: '🟠 Oranye' },
  { value: 'purple', label: '🟣 Ungu'   },
  { value: 'red',    label: '🔴 Merah'  },
];

async function loadDompet() {
  const bulan = getBulanAktif() || new Date().toISOString().slice(0, 7);
  const end   = getEndOfMonth(bulan);

  const [
    { data: dompets },
    { data: pemasukan },
    { data: pengeluaran },
    { data: transferMasuk },
    { data: transferKeluar }
  ] = await Promise.all([
    db.from('dompet').select('*').order('created_at'),
    db.from('pemasukan').select('dompet_id, nominal'),
    db.from('pengeluaran').select('dompet_id, nominal, tanggal').gte('tanggal', bulan + '-01').lte('tanggal', end),
    db.from('transfer').select('ke_dompet, nominal'),
    db.from('transfer').select('dari_dompet, nominal'),
  ]);

  // Hitung saldo tiap dompet (semua waktu, bukan filter bulan)
  // Ambil semua pemasukan & pengeluaran tanpa filter bulan untuk saldo
  const [{ data: allPemasukan }, { data: allPengeluaran }] = await Promise.all([
    db.from('pemasukan').select('dompet_id, nominal'),
    db.from('pengeluaran').select('dompet_id, nominal'),
  ]);

  const saldoMap = {};
  (dompets || []).forEach(d => {
    saldoMap[d.id] = Number(d.saldo_awal);
  });

  (allPemasukan || []).forEach(p => {
    if (p.dompet_id) saldoMap[p.dompet_id] = (saldoMap[p.dompet_id] || 0) + Number(p.nominal);
  });
  (allPengeluaran || []).forEach(p => {
    if (p.dompet_id) saldoMap[p.dompet_id] = (saldoMap[p.dompet_id] || 0) - Number(p.nominal);
  });
  (transferMasuk || []).forEach(t => {
    saldoMap[t.ke_dompet] = (saldoMap[t.ke_dompet] || 0) + Number(t.nominal);
  });
  (transferKeluar || []).forEach(t => {
    saldoMap[t.dari_dompet] = (saldoMap[t.dari_dompet] || 0) - Number(t.nominal);
  });

  // Hitung pengeluaran bulan ini per dompet (untuk budget)
  const keluarBulanIni = {};
  (pengeluaran || []).forEach(p => {
    if (p.dompet_id) keluarBulanIni[p.dompet_id] = (keluarBulanIni[p.dompet_id] || 0) + Number(p.nominal);
  });

  renderDompetCards(dompets || [], saldoMap, keluarBulanIni);
  renderRiwayatTransfer();
}

function renderDompetCards(dompets, saldoMap, keluarBulanIni) {
  const container = document.getElementById('dompetCards');
  if (!container) return;

  if (!dompets.length) {
    container.innerHTML = '<div class="empty-state">Belum ada dompet. Tambah sekarang!</div>';
    return;
  }

  const totalSaldo = Object.values(saldoMap).reduce((s, v) => s + v, 0);
  document.getElementById('totalSaldoSemua').textContent = formatRp(totalSaldo);

  container.innerHTML = dompets.map(d => {
    const saldo  = saldoMap[d.id] || 0;
    const keluar = keluarBulanIni[d.id] || 0;
    const hasBudget = d.budget_bulanan && d.budget_bulanan > 0;
    const pct   = hasBudget ? Math.min((keluar / d.budget_bulanan) * 100, 100) : 0;
    const over  = hasBudget && keluar > d.budget_bulanan;
    const warn  = hasBudget && pct >= 80 && !over;

    const fillClass = over ? 'danger' : warn ? 'warning' : 'safe';
    const colorClass = `dompet-card--${d.warna || 'blue'}`;

    return `
      <div class="dompet-card ${colorClass}">
        <div class="dompet-card-header">
          <div class="dompet-emoji">${esc(d.emoji)}</div>
          <div class="dompet-card-actions">
            <button class="btn-edit-sm" onclick="openEditDompet('${d.id}')">✎</button>
            <button class="btn-delete-sm" onclick="deleteDompet('${d.id}', '${esc(d.nama)}')">✕</button>
          </div>
        </div>
        <div class="dompet-nama">${esc(d.nama)}</div>
        <div class="dompet-saldo ${saldo < 0 ? 'minus' : ''}">${formatRp(saldo)}</div>
        ${hasBudget ? `
          <div class="dompet-budget-info">
            <span>Keluar bulan ini: ${formatRp(keluar)}</span>
            <span class="${over ? 'over' : 'ok'}">${over ? '⚠ +' + formatRp(keluar - d.budget_bulanan) : 'Sisa ' + formatRp(d.budget_bulanan - keluar)}</span>
          </div>
          <div class="budget-bar">
            <div class="budget-fill ${fillClass}" style="width:${pct}%"></div>
          </div>
          <div class="dompet-budget-label">Budget: ${formatRp(d.budget_bulanan)}/bulan</div>
        ` : `
          <div class="dompet-budget-label no-budget">Tanpa batas budget</div>
        `}
      </div>
    `;
  }).join('');
}

async function renderRiwayatTransfer() {
  const { data, error } = await db.from('transfer').select('*').order('tanggal', { ascending: false }).limit(10);
  const container = document.getElementById('riwayatTransfer');
  if (!container) return;

  if (!data || !data.length) {
    container.innerHTML = '<div class="empty-state">Belum ada riwayat transfer.</div>';
    return;
  }

  container.innerHTML = data.map(t => `
    <div class="txn-item">
      <div class="txn-icon" style="background:rgba(99,102,241,0.15);color:#818cf8">⇄</div>
      <div class="txn-info">
        <div class="txn-desc">${esc(getDompetLabel(t.dari_dompet))} → ${esc(getDompetLabel(t.ke_dompet))}</div>
        <div class="txn-date">${formatTgl(t.tanggal)}${t.catatan ? ' · ' + esc(t.catatan) : ''}</div>
      </div>
      <div class="txn-amount" style="color:var(--text2)">${formatRp(t.nominal)}</div>
    </div>
  `).join('');
}

// ── Tambah / Edit Dompet ──
async function saveDompet() {
  const nama          = document.getElementById('dompetNama').value.trim();
  const emoji         = document.getElementById('dompetEmoji').value.trim() || '💰';
  const saldo_awal    = Number(document.getElementById('dompetSaldoAwal').value) || 0;
  const budget_bulanan = Number(document.getElementById('dompetBudget').value) || null;
  const warna         = document.getElementById('dompetWarna').value || 'blue';
  const msg           = document.getElementById('dompetMsg');

  if (!nama) { showMsg(msg, 'Nama dompet wajib diisi!', 'error'); return; }

  const { error } = await db.from('dompet').insert([{ nama, emoji, saldo_awal, budget_bulanan, warna }]);
  if (error) { showMsg(msg, 'Gagal: ' + error.message, 'error'); return; }

  showMsg(msg, `✓ Dompet "${emoji} ${nama}" ditambahkan!`, 'success');
  clearDompetForm();
  await loadDompetCache();
  loadDompet();
}

function clearDompetForm() {
  ['dompetNama','dompetEmoji','dompetSaldoAwal','dompetBudget'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

async function deleteDompet(id, nama) {
  if (!confirm(`Hapus dompet "${nama}"? Transaksi yang terkait tidak akan ikut terhapus.`)) return;
  const { error } = await db.from('dompet').delete().eq('id', id);
  if (error) { alert('Gagal hapus: ' + error.message); return; }
  await loadDompetCache();
  loadDompet();
}

// ── Edit Dompet Modal ──
let _editingDompetId = null;

function openEditDompet(id) {
  const d = getDompetById(id);
  if (!d) return;
  _editingDompetId = id;
  document.getElementById('editDompetNama').value   = d.nama;
  document.getElementById('editDompetEmoji').value  = d.emoji;
  document.getElementById('editDompetBudget').value = d.budget_bulanan || '';
  document.getElementById('editDompetWarna').value  = d.warna || 'blue';
  document.getElementById('modalEditDompet').classList.add('open');
}

async function saveEditDompet() {
  const nama          = document.getElementById('editDompetNama').value.trim();
  const emoji         = document.getElementById('editDompetEmoji').value.trim() || '💰';
  const budget_bulanan = Number(document.getElementById('editDompetBudget').value) || null;
  const warna         = document.getElementById('editDompetWarna').value || 'blue';

  if (!nama || !_editingDompetId) return;

  const { error } = await db.from('dompet').update({ nama, emoji, budget_bulanan, warna }).eq('id', _editingDompetId);
  if (error) { alert('Gagal update: ' + error.message); return; }

  closeEditDompet();
  await loadDompetCache();
  loadDompet();
}

function closeEditDompet() {
  document.getElementById('modalEditDompet').classList.remove('open');
  _editingDompetId = null;
}

// ── Transfer antar Dompet ──
async function saveTransfer() {
  const tanggal    = document.getElementById('transferTanggal').value;
  const dari       = document.getElementById('transferDari').value;
  const ke         = document.getElementById('transferKe').value;
  const nominal    = Number(document.getElementById('transferNominal').value);
  const catatan    = document.getElementById('transferCatatan').value;
  const msg        = document.getElementById('transferMsg');

  if (!tanggal || !dari || !ke || !nominal) {
    showMsg(msg, 'Semua field wajib diisi!', 'error'); return;
  }
  if (dari === ke) {
    showMsg(msg, 'Dompet asal dan tujuan tidak boleh sama!', 'error'); return;
  }

  const { error } = await db.from('transfer').insert([{
    tanggal,
    dari_dompet: dari,
    ke_dompet:   ke,
    nominal,
    catatan
  }]);

  if (error) { showMsg(msg, 'Gagal: ' + error.message, 'error'); return; }

  showMsg(msg, '✓ Transfer berhasil dicatat!', 'success');
  document.getElementById('transferNominal').value = '';
  document.getElementById('transferCatatan').value = '';
  loadDompet();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnSaveDompet')?.addEventListener('click', saveDompet);
  document.getElementById('btnSaveTransfer')?.addEventListener('click', saveTransfer);
  document.getElementById('btnSaveEditDompet')?.addEventListener('click', saveEditDompet);
  document.getElementById('btnCancelEditDompet')?.addEventListener('click', closeEditDompet);
  document.getElementById('modalEditDompet')?.addEventListener('click', e => {
    if (e.target === document.getElementById('modalEditDompet')) closeEditDompet();
  });

  // Populate warna select
  const warnaEl = document.getElementById('dompetWarna');
  if (warnaEl) {
    warnaEl.innerHTML = WARNA_OPTIONS.map(w =>
      `<option value="${w.value}">${w.label}</option>`
    ).join('');
  }
  const editWarnaEl = document.getElementById('editDompetWarna');
  if (editWarnaEl) {
    editWarnaEl.innerHTML = WARNA_OPTIONS.map(w =>
      `<option value="${w.value}">${w.label}</option>`
    ).join('');
  }
});
