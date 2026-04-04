const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Format helpers ──
function formatRp(num) {
  if (!num || isNaN(num)) return 'Rp 0';
  return 'Rp ' + Number(num).toLocaleString('id-ID');
}

function formatTgl(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getBulanAktif() {
  const val = document.getElementById('bulanFilter').value;
  return val || null;
}

function getEndOfMonth(bulan) {
  const [y, m] = bulan.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return `${bulan}-${String(lastDay).padStart(2, '0')}`;
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showMsg(el, text, type) {
  if (!el) return;
  el.textContent = text;
  el.className = 'form-msg ' + type;
  setTimeout(() => { el.textContent = ''; el.className = 'form-msg'; }, 3000);
}

// ── Cache global ──
let _kategoriCache = [];
let _dompetCache = [];

// ── Kategori ──
async function loadKategori() {
  const { data } = await db.from('kategori_custom').select('*').order('nama');
  _kategoriCache = data || [];
  populateKategoriSelects();
  return _kategoriCache;
}

function populateKategoriSelects() {
  const opts = _kategoriCache.map(k => `<option value="${esc(k.emoji + ' ' + k.nama)}">${esc(k.emoji + ' ' + k.nama)}</option>`).join('');
  const optsWithAll = `<option value="">Semua Kategori</option>` + opts;

  ['pengeluaranKategori', 'tagihanKategori'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
  const filterKat = document.getElementById('filterKategori');
  if (filterKat) filterKat.innerHTML = optsWithAll;

  renderKategoriList();
}

function renderKategoriList() {
  const container = document.getElementById('kategoriList');
  if (!container) return;
  if (!_kategoriCache.length) {
    container.innerHTML = '<div class="empty-state">Belum ada kategori.</div>';
    return;
  }
  container.innerHTML = _kategoriCache.map(k => `
    <div class="kategori-item">
      <span class="kat-emoji">${esc(k.emoji)}</span>
      <span class="kat-nama">${esc(k.nama)}</span>
      <button class="btn-delete" onclick="deleteKategori('${k.id}', '${esc(k.nama)}')">✕</button>
    </div>
  `).join('');
}

async function saveKategori() {
  const emoji = document.getElementById('kategoriEmoji').value.trim() || '🔖';
  const nama  = document.getElementById('kategoriNama').value.trim();
  const msg   = document.getElementById('kategoriMsg');
  if (!nama) { showMsg(msg, 'Nama kategori wajib diisi!', 'error'); return; }

  const { error } = await db.from('kategori_custom').insert([{ nama, emoji }]);
  if (error) { showMsg(msg, error.code === '23505' ? 'Kategori sudah ada!' : 'Gagal: ' + error.message, 'error'); return; }

  showMsg(msg, `✓ Kategori "${emoji} ${nama}" ditambahkan!`, 'success');
  document.getElementById('kategoriNama').value  = '';
  document.getElementById('kategoriEmoji').value = '';
  await loadKategori();
}

async function deleteKategori(id, nama) {
  if (!confirm(`Hapus kategori "${nama}"?`)) return;
  await db.from('kategori_custom').delete().eq('id', id);
  await loadKategori();
}

// ── Dompet cache & select populasi ──
async function loadDompetCache() {
  const { data } = await db.from('dompet').select('*').order('created_at');
  _dompetCache = data || [];
  populateDompetSelects();
  return _dompetCache;
}

function populateDompetSelects() {
  const opts = _dompetCache.map(d => `<option value="${d.id}">${esc(d.emoji + ' ' + d.nama)}</option>`).join('');
  const optsWithAll = `<option value="">Semua Dompet</option>` + opts;

  ['pemasukanDompet', 'pengeluaranDompet', 'tagihanDompet',
   'transferDari', 'transferKe'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });

  const filterDompet = document.getElementById('filterDompet');
  if (filterDompet) filterDompet.innerHTML = optsWithAll;
}

function getDompetById(id) {
  return _dompetCache.find(d => d.id === id) || null;
}

function getDompetLabel(id) {
  const d = getDompetById(id);
  return d ? d.emoji + ' ' + d.nama : '-';
}

// ── Notifikasi budget dompet ──
async function cekNotifikasiBudget() {
  const bulan = new Date().toISOString().slice(0, 7);
  const end   = getEndOfMonth(bulan);

  const [{ data: dompets }, { data: pengeluaran }] = await Promise.all([
    db.from('dompet').select('*'),
    db.from('pengeluaran').select('*').gte('tanggal', bulan + '-01').lte('tanggal', end)
  ]);

  if (!dompets) return;

  const realisasi = {};
  (pengeluaran || []).forEach(p => {
    if (p.dompet_id) realisasi[p.dompet_id] = (realisasi[p.dompet_id] || 0) + Number(p.nominal);
  });

  const peringatan = [];
  dompets.forEach(d => {
    if (!d.budget_bulanan) return;
    const real = realisasi[d.id] || 0;
    const pct  = d.budget_bulanan > 0 ? (real / d.budget_bulanan) * 100 : 0;
    if (pct >= 100) peringatan.push({ nama: d.emoji + ' ' + d.nama, pct, over: true });
    else if (pct >= 80) peringatan.push({ nama: d.emoji + ' ' + d.nama, pct, over: false });
  });

  const container = document.getElementById('notifContainer');
  if (!container || !peringatan.length) return;

  peringatan.forEach(p => {
    const toast = document.createElement('div');
    toast.className = `notif-toast ${p.over ? 'notif-danger' : 'notif-warning'}`;
    toast.innerHTML = `
      <div class="notif-icon">${p.over ? '🚨' : '⚡'}</div>
      <div class="notif-body">
        <div class="notif-title">${p.over ? 'Budget Dompet Habis!' : 'Budget Hampir Habis'}</div>
        <div class="notif-desc">${esc(p.nama)} — ${Math.round(p.pct)}% terpakai</div>
      </div>
      <button class="notif-close" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 7000);
  });
}

// ── Navigasi ──
const pageNames = {
  dashboard:   'Dashboard',
  pemasukan:   'Pemasukan',
  pengeluaran: 'Pengeluaran',
  dompet:      'Dompet',
  goals:       'Goals Tabungan',
  tagihan:     'Tagihan Rutin',
  settings:    'Pengaturan'
};

function navigateTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + pageId);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === pageId);
  });
  document.querySelectorAll('.bnav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === pageId);
  });

  document.getElementById('topbarTitle').textContent = pageNames[pageId] || 'FinTrack';
  closeSidebar();

  switch(pageId) {
    case 'dashboard':   loadDashboard();   break;
    case 'pemasukan':   loadPemasukan();   break;
    case 'pengeluaran': loadPengeluaran(); break;
    case 'dompet':      loadDompet();      break;
    case 'goals':       loadGoals();       break;
    case 'tagihan':     loadTagihan();     break;
    case 'settings':    break;
  }
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  const ov = document.getElementById('sidebarOverlay');
  if (ov) ov.classList.remove('open');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  const ov = document.getElementById('sidebarOverlay');
  if (ov) ov.classList.toggle('open');
}

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  const today     = new Date().toISOString().split('T')[0];
  const thisMonth = today.slice(0, 7);

  ['pemasukanTanggal','pengeluaranTanggal','transferTanggal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = today;
  });

  const bulanFilter = document.getElementById('bulanFilter');
  for (let i = 0; i < 12; i++) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const val   = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    const opt   = document.createElement('option');
    opt.value = val; opt.textContent = label;
    if (i === 0) opt.selected = true;
    bulanFilter.appendChild(opt);
  }

  document.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); navigateTo(el.dataset.page); });
  });

  document.getElementById('menuBtn').addEventListener('click', toggleSidebar);

  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.id = 'sidebarOverlay';
  overlay.addEventListener('click', closeSidebar);
  document.body.appendChild(overlay);

  bulanFilter.addEventListener('change', () => {
    const activePage = document.querySelector('.page.active');
    if (!activePage) return;
    const pageId = activePage.id.replace('page-', '');
    switch(pageId) {
      case 'dashboard':   loadDashboard();   break;
      case 'pemasukan':   loadPemasukan();   break;
      case 'pengeluaran': loadPengeluaran(); break;
    }
  });

  const filterKat = document.getElementById('filterKategori');
  if (filterKat) filterKat.addEventListener('change', loadPengeluaran);

  const filterDompet = document.getElementById('filterDompet');
  if (filterDompet) filterDompet.addEventListener('change', loadPengeluaran);

  document.getElementById('btnSaveKategori')?.addEventListener('click', saveKategori);

  // Load data global
  await Promise.all([loadKategori(), loadDompetCache()]);

  loadDashboard();
  await cekNotifikasiBudget();
});
