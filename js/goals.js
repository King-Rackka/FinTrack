// ════════════════════════════════════════
// GOALS TABUNGAN
// ════════════════════════════════════════

let editingGoalId = null;

async function loadGoals() {
  const { data, error } = await db.from('goals').select('*').order('created_at', { ascending: false });
  if (error) { console.error(error); return; }
  renderGoals(data || []);
  updateTotalGoals(data || []);
}

function renderGoals(goals) {
  const container = document.getElementById('goalsList');
  const dashGoals = document.getElementById('dashGoals');

  if (!goals.length) {
    container.innerHTML = '<div class="empty-state">Belum ada goals. Yuk mulai menabung! 🎯</div>';
    if (dashGoals) dashGoals.innerHTML = '<div class="empty-state">Belum ada goals.</div>';
    return;
  }

  // Full goals list
  container.innerHTML = goals.map(g => {
    const pct  = g.target > 0 ? Math.min((g.terkumpul / g.target) * 100, 100) : 0;
    const done = pct >= 100;
    const days = g.deadline ? getDaysLeft(g.deadline) : null;

    return `
      <div class="goal-card">
        <div class="goal-header">
          <div class="goal-name">${g.nama} ${done ? '✅' : ''}</div>
          <div class="goal-actions">
            <button class="btn-update" onclick="openUpdateModal('${g.id}', ${g.terkumpul})">Update</button>
            <button class="btn-delete" onclick="deleteGoal('${g.id}')">✕</button>
          </div>
        </div>
        <div class="goal-amounts">
          <span class="collected">${formatRp(g.terkumpul)}</span>
          <span>dari ${formatRp(g.target)}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${done ? 'done' : ''}" style="width:${pct}%"></div>
        </div>
        <div class="goal-pct ${done ? 'done' : ''}">
          ${done ? '🎉 Tercapai!' : Math.round(pct) + '% terkumpul · Kurang ' + formatRp(g.target - g.terkumpul)}
        </div>
        ${days !== null ? `<div class="goal-deadline">📅 ${days > 0 ? days + ' hari lagi' : days === 0 ? 'Deadline hari ini!' : 'Deadline terlewat ' + Math.abs(days) + ' hari'}</div>` : ''}
      </div>
    `;
  }).join('');

  // Dashboard preview (top 3)
  if (dashGoals) {
    const top3 = goals.slice(0, 3);
    dashGoals.innerHTML = top3.map(g => {
      const pct = g.target > 0 ? Math.min((g.terkumpul / g.target) * 100, 100) : 0;
      const done = pct >= 100;
      return `
        <div class="goal-preview-item">
          <div class="goal-preview-label">
            <span>${g.nama}</span>
            <span>${Math.round(pct)}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill ${done ? 'done' : ''}" style="width:${pct}%"></div>
          </div>
        </div>
      `;
    }).join('');
  }
}

function updateTotalGoals(goals) {
  const total = goals.reduce((s, g) => s + Number(g.terkumpul), 0);
  const el = document.getElementById('totalGoalsPage');
  if (el) el.textContent = formatRp(total);
  const dashTotal = document.getElementById('totalTabungan');
  if (dashTotal) dashTotal.textContent = formatRp(total);
}

function getDaysLeft(deadline) {
  const today = new Date(); today.setHours(0,0,0,0);
  const dl = new Date(deadline); dl.setHours(0,0,0,0);
  return Math.round((dl - today) / (1000 * 60 * 60 * 24));
}

async function saveGoal() {
  const nama       = document.getElementById('goalsNama').value.trim();
  const target     = Number(document.getElementById('goalsTarget').value);
  const terkumpul  = Number(document.getElementById('goalsTerkumpul').value) || 0;
  const deadline   = document.getElementById('goalsDeadline').value || null;
  const msg        = document.getElementById('goalsMsg');

  if (!nama || !target) {
    showMsg(msg, 'Nama dan target wajib diisi!', 'error');
    return;
  }

  const { error } = await db.from('goals').insert([{ nama, target, terkumpul, deadline }]);
  if (error) { showMsg(msg, 'Gagal: ' + error.message, 'error'); return; }

  showMsg(msg, '✓ Goal berhasil ditambahkan!', 'success');
  document.getElementById('goalsNama').value = '';
  document.getElementById('goalsTarget').value = '';
  document.getElementById('goalsTerkumpul').value = '';
  document.getElementById('goalsDeadline').value = '';
  loadGoals();
}

async function deleteGoal(id) {
  if (!confirm('Hapus goal ini?')) return;
  await db.from('goals').delete().eq('id', id);
  loadGoals();
}

// ── Update Modal ──
function openUpdateModal(id, current) {
  editingGoalId = id;
  document.getElementById('modalTerkumpul').value = current;
  document.getElementById('modalOverlay').classList.add('open');
}

async function saveUpdateModal() {
  const terkumpul = Number(document.getElementById('modalTerkumpul').value) || 0;
  if (!editingGoalId) return;

  const { error } = await db.from('goals').update({ terkumpul }).eq('id', editingGoalId);
  if (!error) {
    closeModal();
    loadGoals();
  }
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  editingGoalId = null;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnSaveGoals')?.addEventListener('click', saveGoal);
  document.getElementById('btnModalSave')?.addEventListener('click', saveUpdateModal);
  document.getElementById('btnModalCancel')?.addEventListener('click', closeModal);
  document.getElementById('modalOverlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });
});
