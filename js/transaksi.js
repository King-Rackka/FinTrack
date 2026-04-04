// ════════════════════════════════════════
// PEMASUKAN
// ════════════════════════════════════════

async function loadPemasukan() {
  const bulan = getBulanAktif();
  let query = db.from('pemasukan').select('*').order('tanggal', { ascending: false });
  if (bulan) {
    query = query.gte('tanggal', bulan + '-01').lte('tanggal', getEndOfMonth(bulan));
  }
  const { data, error } = await query;
  if (error) { console.error(error); return; }
  renderTabelPemasukan(data || []);
}

function renderTabelPemasukan(rows) {
  const tbody   = document.getElementById('tablePemasukan');
  const totalEl = document.getElementById('totalPemasukanPage');
  const total   = rows.reduce((s, r) => s + Number(r.nominal), 0);
  if (totalEl) totalEl.textContent = formatRp(total);

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Belum ada data pemasukan.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(r => `
    <tr id="row-pem-${r.id}">
      <td>${formatTgl(r.tanggal)}</td>
      <td><strong>${esc(r.sumber)}</strong></td>
      <td style="color:var(--green2);font-family:'Syne',sans-serif;font-weight:700">${formatRp(r.nominal)}</td>
      <td><span class="dompet-badge">${esc(getDompetLabel(r.dompet_id))}</span></td>
      <td style="color:var(--text3)">${esc(r.catatan) || '-'}</td>
      <td class="action-cell">
        <button class="btn-edit" onclick="editPemasukan('${r.id}')">✎</button>
        <button class="btn-delete" onclick="deletePemasukan('${r.id}')">✕</button>
      </td>
    </tr>
  `).join('');
}

async function savePemasukan() {
  const tanggal  = document.getElementById('pemasukanTanggal').value;
  const sumber   = document.getElementById('pemasukanSumber').value;
  const nominal  = Number(document.getElementById('pemasukanNominal').value);
  const catatan  = document.getElementById('pemasukanCatatan').value;
  const dompet_id = document.getElementById('pemasukanDompet').value || null;
  const msg      = document.getElementById('pemasukanMsg');

  if (!tanggal || !sumber || !nominal) {
    showMsg(msg, 'Tanggal, sumber, dan nominal wajib diisi!', 'error'); return;
  }

  const { error } = await db.from('pemasukan').insert([{ tanggal, sumber, nominal, catatan, dompet_id }]);
  if (error) { showMsg(msg, 'Gagal menyimpan: ' + error.message, 'error'); return; }

  showMsg(msg, '✓ Pemasukan berhasil disimpan!', 'success');
  document.getElementById('pemasukanNominal').value = '';
  document.getElementById('pemasukanCatatan').value = '';
  loadPemasukan();
  // Refresh dompet jika halaman dompet sedang dibuka
  if (document.getElementById('page-dompet')?.classList.contains('active')) loadDompet();
}

async function deletePemasukan(id) {
  if (!confirm('Hapus data ini?')) return;
  const { error } = await db.from('pemasukan').delete().eq('id', id);
  if (error) { alert('Gagal hapus: ' + error.message); return; }
  loadPemasukan();
}

function editPemasukan(id) {
  const row = document.getElementById('row-pem-' + id);
  if (!row) return;
  const cells = row.querySelectorAll('td');
  const sumber  = cells[1].textContent.trim();
  const nominal = cells[2].textContent.replace(/[^0-9]/g, '');
  const catatan = cells[4].textContent === '-' ? '' : cells[4].textContent.trim();
  const dompetId = row.dataset.dompetId || '';

  const dompetOpts = _dompetCache.map(d =>
    `<option value="${d.id}" ${d.id === dompetId ? 'selected' : ''}>${esc(d.emoji + ' ' + d.nama)}</option>`
  ).join('');

  row.innerHTML = `
    <td><input type="date" class="input input-inline" id="edit-pem-tgl-${id}" value="${getISODate(cells[0].textContent)}"></td>
    <td><input type="text" class="input input-inline" id="edit-pem-src-${id}" value="${esc(sumber)}"></td>
    <td><input type="number" class="input input-inline" id="edit-pem-nom-${id}" value="${nominal}"></td>
    <td><select class="input input-inline" id="edit-pem-dom-${id}">${dompetOpts}</select></td>
    <td><input type="text" class="input input-inline" id="edit-pem-cat-${id}" value="${esc(catatan)}"></td>
    <td class="action-cell">
      <button class="btn-save-inline" onclick="saveEditPemasukan('${id}')">✓</button>
      <button class="btn-cancel-inline" onclick="loadPemasukan()">✕</button>
    </td>
  `;
}

async function saveEditPemasukan(id) {
  const tanggal  = document.getElementById(`edit-pem-tgl-${id}`).value;
  const sumber   = document.getElementById(`edit-pem-src-${id}`).value;
  const nominal  = Number(document.getElementById(`edit-pem-nom-${id}`).value);
  const dompet_id = document.getElementById(`edit-pem-dom-${id}`).value || null;
  const catatan  = document.getElementById(`edit-pem-cat-${id}`).value;

  if (!tanggal || !sumber || !nominal) { alert('Semua field wajib diisi!'); return; }

  const { error } = await db.from('pemasukan').update({ tanggal, sumber, nominal, dompet_id, catatan }).eq('id', id);
  if (error) { alert('Gagal update: ' + error.message); return; }
  loadPemasukan();
}

// ════════════════════════════════════════
// PENGELUARAN
// ════════════════════════════════════════

async function loadPengeluaran() {
  const bulan  = getBulanAktif();
  const kat    = document.getElementById('filterKategori')?.value || '';
  const domId  = document.getElementById('filterDompet')?.value || '';

  let query = db.from('pengeluaran').select('*').order('tanggal', { ascending: false });
  if (bulan) query = query.gte('tanggal', bulan + '-01').lte('tanggal', getEndOfMonth(bulan));
  if (kat)   query = query.eq('kategori', kat);
  if (domId) query = query.eq('dompet_id', domId);

  const { data, error } = await query;
  if (error) { console.error(error); return; }
  renderTabelPengeluaran(data || []);
}

function renderTabelPengeluaran(rows) {
  const tbody = document.getElementById('tablePengeluaran');
  const total = rows.reduce((s, r) => s + Number(r.nominal), 0);
  const totalEl = document.getElementById('totalPengeluaranPage');
  if (totalEl) totalEl.textContent = formatRp(total);

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Belum ada data pengeluaran.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(r => `
    <tr id="row-kel-${r.id}">
      <td>${formatTgl(r.tanggal)}</td>
      <td>${esc(r.deskripsi)}</td>
      <td><span class="kat-badge">${esc(r.kategori)}</span></td>
      <td style="color:var(--red2);font-family:'Syne',sans-serif;font-weight:700">${formatRp(r.nominal)}</td>
      <td><span class="dompet-badge">${esc(getDompetLabel(r.dompet_id))}</span></td>
      <td class="action-cell">
        <button class="btn-edit" onclick="editPengeluaran('${r.id}')">✎</button>
        <button class="btn-delete" onclick="deletePengeluaran('${r.id}')">✕</button>
      </td>
    </tr>
  `).join('');
}

async function savePengeluaran() {
  const tanggal   = document.getElementById('pengeluaranTanggal').value;
  const deskripsi = document.getElementById('pengeluaranDeskripsi').value;
  const kategori  = document.getElementById('pengeluaranKategori').value;
  const nominal   = Number(document.getElementById('pengeluaranNominal').value);
  const catatan   = document.getElementById('pengeluaranCatatan').value;
  const dompet_id = document.getElementById('pengeluaranDompet').value || null;
  const msg       = document.getElementById('pengeluaranMsg');

  if (!tanggal || !deskripsi || !nominal) {
    showMsg(msg, 'Tanggal, deskripsi, dan nominal wajib diisi!', 'error'); return;
  }

  const { error } = await db.from('pengeluaran').insert([{ tanggal, deskripsi, kategori, nominal, catatan, dompet_id }]);
  if (error) { showMsg(msg, 'Gagal menyimpan: ' + error.message, 'error'); return; }

  showMsg(msg, '✓ Pengeluaran berhasil disimpan!', 'success');
  document.getElementById('pengeluaranDeskripsi').value = '';
  document.getElementById('pengeluaranNominal').value   = '';
  document.getElementById('pengeluaranCatatan').value   = '';
  loadPengeluaran();
  if (document.getElementById('page-dompet')?.classList.contains('active')) loadDompet();
}

async function deletePengeluaran(id) {
  if (!confirm('Hapus data ini?')) return;
  const { error } = await db.from('pengeluaran').delete().eq('id', id);
  if (error) { alert('Gagal hapus: ' + error.message); return; }
  loadPengeluaran();
}

function editPengeluaran(id) {
  const row = document.getElementById('row-kel-' + id);
  if (!row) return;
  const cells     = row.querySelectorAll('td');
  const deskripsi = cells[1].textContent.trim();
  const kategori  = cells[2].textContent.trim();
  const nominal   = cells[3].textContent.replace(/[^0-9]/g, '');

  const katOpts = _kategoriCache.map(k =>
    `<option value="${esc(k.emoji + ' ' + k.nama)}" ${(k.emoji + ' ' + k.nama) === kategori ? 'selected' : ''}>${esc(k.emoji + ' ' + k.nama)}</option>`
  ).join('');

  const dompetOpts = _dompetCache.map(d =>
    `<option value="${d.id}">${esc(d.emoji + ' ' + d.nama)}</option>`
  ).join('');

  row.innerHTML = `
    <td><input type="date" class="input input-inline" id="edit-kel-tgl-${id}" value="${getISODate(cells[0].textContent)}"></td>
    <td><input type="text" class="input input-inline" id="edit-kel-dsk-${id}" value="${esc(deskripsi)}"></td>
    <td><select class="input input-inline" id="edit-kel-kat-${id}">${katOpts}</select></td>
    <td><input type="number" class="input input-inline" id="edit-kel-nom-${id}" value="${nominal}"></td>
    <td><select class="input input-inline" id="edit-kel-dom-${id}">${dompetOpts}</select></td>
    <td class="action-cell">
      <button class="btn-save-inline" onclick="saveEditPengeluaran('${id}')">✓</button>
      <button class="btn-cancel-inline" onclick="loadPengeluaran()">✕</button>
    </td>
  `;
}

async function saveEditPengeluaran(id) {
  const tanggal   = document.getElementById(`edit-kel-tgl-${id}`).value;
  const deskripsi = document.getElementById(`edit-kel-dsk-${id}`).value;
  const kategori  = document.getElementById(`edit-kel-kat-${id}`).value;
  const nominal   = Number(document.getElementById(`edit-kel-nom-${id}`).value);
  const dompet_id = document.getElementById(`edit-kel-dom-${id}`).value || null;

  if (!tanggal || !deskripsi || !nominal) { alert('Semua field wajib diisi!'); return; }

  const { error } = await db.from('pengeluaran').update({ tanggal, deskripsi, kategori, nominal, dompet_id }).eq('id', id);
  if (error) { alert('Gagal update: ' + error.message); return; }
  loadPengeluaran();
}

// ── Helper tanggal ──
function getISODate(formattedDate) {
  try {
    const d = new Date(formattedDate);
    if (!isNaN(d)) return d.toISOString().split('T')[0];
  } catch(e) {}
  return new Date().toISOString().split('T')[0];
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnSavePemasukan')?.addEventListener('click', savePemasukan);
  document.getElementById('btnSavePengeluaran')?.addEventListener('click', savePengeluaran);
});
