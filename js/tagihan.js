// ════════════════════════════════════════
// TAGIHAN RUTIN
// ════════════════════════════════════════

async function loadTagihan() {
  const { data, error } = await db.from('tagihan').select('*').order('tanggal_jatuh');
  if (error) { console.error(error); return; }
  await resetTagihanBulanBaru(data || []);
  cekReminderTagihan(data || []);
  renderTagihan(data || []);
}

async function resetTagihanBulanBaru(rows) {
  const bulanIni = new Date().toISOString().slice(0, 7);
  const perluReset = rows.filter(r => r.sudah_bayar && r.bulan_bayar !== bulanIni);
  for (const r of perluReset) {
    await db.from('tagihan').update({ sudah_bayar: false, bulan_bayar: null }).eq('id', r.id);
    r.sudah_bayar = false; r.bulan_bayar = null;
  }
}

function cekReminderTagihan(rows) {
  const today    = new Date(); today.setHours(0,0,0,0);
  const bulanIni = today.toISOString().slice(0, 7);
  const [y, m]   = bulanIni.split('-').map(Number);
  const container = document.getElementById('notifContainer');
  if (!container) return;

  rows.forEach(r => {
    if (r.sudah_bayar) return;
    const jatuhTempo = new Date(y, m - 1, r.tanggal_jatuh);
    const selisih    = Math.round((jatuhTempo - today) / (1000 * 60 * 60 * 24));
    if (selisih >= 0 && selisih <= 3) {
      const toast = document.createElement('div');
      toast.className = 'notif-toast notif-info';
      toast.innerHTML = `
        <div class="notif-icon">🗓️</div>
        <div class="notif-body">
          <div class="notif-title">${selisih === 0 ? 'Tagihan Jatuh Tempo Hari Ini!' : `Tagihan H-${selisih}`}</div>
          <div class="notif-desc">${esc(r.nama)} — ${formatRp(r.nominal)}</div>
        </div>
        <button class="notif-close" onclick="this.parentElement.remove()">✕</button>
      `;
      container.appendChild(toast);
      setTimeout(() => toast.remove(), 8000);
    }
  });
}

function renderTagihan(rows) {
  const container = document.getElementById('tagihanList');
  if (!rows.length) {
    container.innerHTML = '<div class="empty-state">Belum ada tagihan rutin.</div>';
    return;
  }

  const today    = new Date(); today.setHours(0,0,0,0);
  const bulanIni = today.toISOString().slice(0, 7);
  const [y, m]   = bulanIni.split('-').map(Number);

  container.innerHTML = rows.map(r => {
    const jatuhTempo = new Date(y, m - 1, r.tanggal_jatuh);
    const selisih    = Math.round((jatuhTempo - today) / (1000 * 60 * 60 * 24));
    const sudah      = r.sudah_bayar;

    let statusLabel = '', statusClass = '';
    if (sudah) { statusLabel = '✓ Sudah Bayar'; statusClass = 'status-paid'; }
    else if (selisih < 0) { statusLabel = `⚠ Telat ${Math.abs(selisih)} hari`; statusClass = 'status-overdue'; }
    else if (selisih <= 3) { statusLabel = selisih === 0 ? '🔴 Hari ini!' : `🟡 H-${selisih}`; statusClass = 'status-soon'; }
    else { statusLabel = `📅 Tgl ${r.tanggal_jatuh}`; statusClass = 'status-ok'; }

    return `
      <div class="tagihan-card ${sudah ? 'tagihan-paid' : ''}">
        <div class="tagihan-left">
          <div class="tagihan-nama">${esc(r.nama)}</div>
          <div class="tagihan-meta">
            <span class="kat-badge">${esc(r.kategori)}</span>
            ${r.dompet_id ? `<span class="dompet-badge">${esc(getDompetLabel(r.dompet_id))}</span>` : ''}
            <span class="tagihan-status ${statusClass}">${statusLabel}</span>
          </div>
        </div>
        <div class="tagihan-right">
          <div class="tagihan-nominal">${formatRp(r.nominal)}</div>
          <div class="tagihan-actions">
            ${!sudah ? `<button class="btn-bayar" onclick="bayarTagihan('${r.id}')">Bayar</button>` : ''}
            <button class="btn-delete" onclick="deleteTagihan('${r.id}')">✕</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const totalTagihan = rows.reduce((s, r) => s + Number(r.nominal), 0);
  const totalBelum   = rows.filter(r => !r.sudah_bayar).reduce((s, r) => s + Number(r.nominal), 0);
  const elTotal = document.getElementById('tagihanTotalBulan');
  const elBelum = document.getElementById('tagihanTotalBelum');
  if (elTotal) elTotal.textContent = formatRp(totalTagihan);
  if (elBelum) elBelum.textContent = formatRp(totalBelum);
}

async function saveTagihan() {
  const nama        = document.getElementById('tagihanNama').value.trim();
  const nominal     = Number(document.getElementById('tagihanNominal').value);
  const kategori    = document.getElementById('tagihanKategori').value;
  const tgl_jatuh   = Number(document.getElementById('tagihanTglJatuh').value);
  const dompet_id   = document.getElementById('tagihanDompet').value || null;
  const msg         = document.getElementById('tagihanMsg');

  if (!nama || !nominal || !tgl_jatuh) { showMsg(msg, 'Nama, nominal, dan tanggal jatuh wajib diisi!', 'error'); return; }
  if (tgl_jatuh < 1 || tgl_jatuh > 28) { showMsg(msg, 'Tanggal jatuh harus antara 1–28!', 'error'); return; }

  const { error } = await db.from('tagihan').insert([{ nama, nominal, kategori, tanggal_jatuh: tgl_jatuh, dompet_id }]);
  if (error) { showMsg(msg, 'Gagal: ' + error.message, 'error'); return; }

  showMsg(msg, `✓ Tagihan "${nama}" ditambahkan!`, 'success');
  document.getElementById('tagihanNama').value    = '';
  document.getElementById('tagihanNominal').value = '';
  document.getElementById('tagihanTglJatuh').value = '';
  loadTagihan();
}

async function bayarTagihan(id) {
  const bulanIni = new Date().toISOString().slice(0, 7);
  const { data: tagihan } = await db.from('tagihan').select('*').eq('id', id).single();
  if (!tagihan) return;

  if (!confirm(`Tandai "${tagihan.nama}" sudah dibayar dan catat sebagai pengeluaran?`)) return;

  const today = new Date().toISOString().split('T')[0];
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    db.from('tagihan').update({ sudah_bayar: true, bulan_bayar: bulanIni }).eq('id', id),
    db.from('pengeluaran').insert([{
      tanggal:   today,
      deskripsi: `Tagihan: ${tagihan.nama}`,
      kategori:  tagihan.kategori,
      nominal:   tagihan.nominal,
      catatan:   'Auto dari tagihan rutin',
      dompet_id: tagihan.dompet_id
    }])
  ]);

  if (e1 || e2) { alert('Ada error saat menyimpan.'); return; }
  loadTagihan();
}

async function deleteTagihan(id) {
  if (!confirm('Hapus tagihan ini?')) return;
  const { error } = await db.from('tagihan').delete().eq('id', id);
  if (error) { alert('Gagal hapus: ' + error.message); return; }
  loadTagihan();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnSaveTagihan')?.addEventListener('click', saveTagihan);
});
