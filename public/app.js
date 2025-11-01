
(function checkFileProtocol(){
  if (location.protocol === 'file:') {
    const v = document.getElementById('view');
    v.innerHTML = '<div class="card"><h3>Нужно запустить через http(s)</h3><div class="meta">Сейчас открыт файл напрямую (file://). Запусти локальный сервер:<br>1) <code>npm i -g vercel && vercel dev</code><br>или 2) <code>python3 -m http.server 3000</code> (только UI).<br>API /api/* работает через Vercel функции.</div></div>';
    throw new Error('file-protocol');
  }
})();
// Helper selectors
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

const state = { period:'month', settings:null, groups:[] };

async function api(path, options={}){
  const res = await fetch(path, { headers:{'Content-Type':'application/json'}, ...options });
  if (!res.ok) throw new Error('HTTP '+res.status);
  return res.json();
}
function money(n){ return (Number(n)||0).toLocaleString('ru-RU', { minimumFractionDigits: 0 }); }
function todayISO(){ return new Date().toISOString().slice(0,10); }

async function loadSettings(){ state.settings = (await api('/api/settings')).data; }
async function loadGroups(){ state.groups = (await api('/api/groups')).data; }

// Преобразование дат в формат дд.мм.гггг (без проблем с таймзоной)
function toRuDate(val){
  if (!val) return '';
  if (val instanceof Date) {
    const d = String(val.getDate()).padStart(2,'0');
    const m = String(val.getMonth()+1).padStart(2,'0');
    const y = val.getFullYear();
    return `${d}.${m}.${y}`;
  }
  // ожидаем 'YYYY-MM-DD' или 'YYYY-MM-DDTHH:MM...'
  const m = String(val).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  // fallback: пробуем распарсить как Date
  const dt = new Date(val);
  if (!isNaN(dt)) return toRuDate(dt);
  return String(val);
}

// ISO "сегодня" (для отправки на сервер)
function todayISO(){
  const d = new Date();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function renderDashboard(data){
  const kpi = data.kpi; const last = data.last5 || [];
  const kpis = `
    <div class="grid kpi-grid">
      <div class="kpi"><div class="label">Денег сейчас</div><div class="val">${money(kpi.current_balance)} KGS</div></div>
      <div class="kpi"><div class="label">Потратил (${state.period})</div><div class="val">${money(kpi.spent_period)} KGS</div></div>
      <div class="kpi"><div class="label">Плановые до конца</div><div class="val">${money(kpi.planned_to_go)} KGS</div></div>
      <div class="kpi"><div class="label">Останется после плановых</div><div class="val">${money(kpi.will_remain)} KGS</div></div>
    </div>`;
  const last5 = `
    <div class="card">
      <h3>Последние 5 операций</h3>
      <div class="list">
        ${last.map(i=>`
          <div class="item">
            <div>
              <div>${i.title}</div>
              <div class="meta">${new Date(i.date).toLocaleDateString('ru-RU')} • ${i.type==='expense'?'Расход':'Приход'}</div>
            </div>
            <div class="sum">${i.type==='expense' ? '-' : '+'} ${money(i.amount)}</div>
          </div>
        `).join('') || '<div class="meta">Нет операций</div>'}
      </div>
    </div>`;
  $('#view').innerHTML = kpis + last5;
}

async function showDashboard(){
  const r = await api('/api/metrics?period='+state.period);
  renderDashboard(r.data);
}

async function showExpenses(){
  const end = todayISO();
  const start = new Date(); start.setDate(start.getDate()-6);
  const startIso = start.toISOString().slice(0,10);
  const planned = await api(`/api/planned?from=${end}&to=`);
  const recent = await api(`/api/transactions?from=${startIso}&to=${end}&type=expense`);

  const blockA = `
    <div class="card">
      <h3>Будущие расходы</h3>
      <div class="row chips">
        <span class="chip">Подписки</span>
        <span class="chip">Ежемесячные</span>
        <span class="chip">Одноразовые</span>
      </div>
      <div class="list" style="margin-top:8px">
        ${planned.data.map(p=>`
          <div class="item">
            <div>
              <div>${p.title}</div>
              <div class="meta">${p.plan_type} • сумма ${money(p.amount)} • ${p.next_due_date ? new Date(p.next_due_date).toLocaleDateString('ru-RU') : 'без даты'}</div>
            </div>
            <div class="row">
              <button class="ghost" onclick="postPlannedToExpense(${p.id})">Провести</button>
              <button class="ghost" onclick="editPlanned(${p.id})">⋯</button>
            </div>
          </div>
        `).join('') || '<div class="meta">Планов нет</div>'}
      </div>
    </div>`;

  const grouped = recent.data.reduce((acc,i)=>{ (acc[i.date] = acc[i.date] || []).push(i); return acc; }, {});
  const dates = Object.keys(grouped).sort().reverse();
  const blockB = `
    <div class="card">
      <h3>История 7 дней</h3>
      <div class="list">
        ${dates.map(d=>`
          <div class="item" style="flex-direction:column;align-items:stretch;gap:8px">
            <div class="meta">${new Date(d).toLocaleDateString('ru-RU')}</div>
            ${grouped[d].map(i=>`
              <div class="item" style="background:#0e1626">
                <div>
                  <div>${i.title}</div>
                  <div class="meta">${i.group_name||'—'}</div>
                </div>
                <div class="row">
                  <div class="sum">- ${money(i.amount)}</div>
                  <button class="ghost" onclick="editTx(${i.id})">⋯</button>
                </div>
              </div>
            `).join('')}
          </div>
        `).join('') || '<div class="meta">Нет расходов за последние 7 дней</div>'}
      </div>
    </div>`;

  $('#view').innerHTML = blockA + blockB;
}

async function showPlanning(){
  const r = await api('/api/metrics?period='+state.period);
  const top = r.data.budgetsTop || [];
  const cards = top.map(b=>`
    <div class="kpi">
      <div class="label">${b.group_name}</div>
      <div class="val">${money(b.remain_amount)} из ${money(b.limit_amount)}</div>
    </div>
  `).join('') || '<div class="card"><div class="meta">Пока нет лимитов. Добавьте в Настройке.</div></div>';
  $('#view').innerHTML = `<div class="grid kpi-grid">${cards}</div>`;
}

async function loadSettingsAndGroups(){ await loadSettings(); await loadGroups(); }

async function showSettings(){
  await loadSettingsAndGroups();
  const s = state.settings;
  const groups = state.groups.map(g=>`
    <div class="item">
      <div><div>${g.name}</div><div class="meta">${g.comment||''}</div></div>
      <div class="row"><button class="ghost" onclick="deleteGroup(${g.id})">Удалить</button></div>
    </div>
  `).join('') || '<div class="meta">Пока нет групп</div>';
  $('#view').innerHTML = `
    <div class="card">
      <h3>Баланс и период</h3>
      <div class="row" style="gap:12px;flex-wrap:wrap">
        <div class="form-row" style="min-width:200px">
          <label>Начальный баланс</label>
          <input id="s-initial" type="number" step="0.01" value="${s.initial_balance||0}">
        </div>
        <div class="form-row" style="min-width:200px">
          <label>Базовая валюта</label>
          <input id="s-currency" value="${s.currency||'KGS'}">
        </div>
      </div>
      <div class="modal-actions"><button class="primary" onclick="saveSettings()">Сохранить</button></div>
    </div>
    <div class="card">
      <h3>Группы</h3>
      <div class="list">${groups}</div>
      <div class="row" style="margin-top:10px">
        <input id="g-name" placeholder="Название группы">
        <input id="g-comment" placeholder="Комментарий">
        <button class="primary" onclick="addGroup()">Добавить</button>
      </div>
    </div>`;
}

async function saveSettings(){
  const initial = Number($('#s-initial').value||0);
  const currency = $('#s-currency').value || 'KGS';
  await api('/api/settings', { method:'PUT', body: JSON.stringify({ initial_balance: initial, currency }) });
  alert('Сохранено'); showDashboard();
}
async function addGroup(){
  const name = $('#g-name').value.trim();
  const comment = $('#g-comment').value.trim() || null;
  if (!name) return alert('Название группы');
  await api('/api/groups', { method:'POST', body: JSON.stringify({ name, comment }) });
  showSettings();
}
async function deleteGroup(id){
  if (!confirm('Удалить группу?')) return;
  await api('/api/groups?id='+id, { method:'DELETE' });
  showSettings();
}

function openModal(){
  $('#modal').classList.remove('hidden');
  $('#m-date').value = todayISO();
  $('#m-amount').value = '';
  $('#m-title').value = '';
  $('#m-comment').value = '';
  $('#m-group').innerHTML = '<option value="">—</option>' + state.groups.map(g=>`<option value="${g.id}">${g.name}</option>`).join('');
  $$('.modal-tabs button').forEach(b=>b.classList.remove('active'));
  $$('.modal-tabs button')[0].classList.add('active');
  $('#m-amount').focus();
}
function closeModal(){ $('#modal').classList.add('hidden'); }
async function saveModal(){
  const kind = $('.modal-tabs button.active').dataset.kind || 'expense';
  const type = (kind === 'income') ? 'income' : 'expense';
  const amount = Number($('#m-amount').value||0);
  const groupId = $('#m-group').value ? Number($('#m-group').value) : null;
  const title = $('#m-title').value.trim() || (type==='expense'?'Покупка':'Поступление');
  const date = $('#m-date').value || todayISO();
  const comment = $('#m-comment').value.trim() || null;
  if (!(amount>0)) return alert('Введите сумму');
  await api('/api/transactions', { method:'POST', body: JSON.stringify({ type, amount, groupId, title, date, comment }) });
  closeModal();
  const active = $('.tab-btn.active')?.dataset.tab || 'dashboard';
  if (active==='dashboard') showDashboard(); if (active==='expenses') showExpenses();
}

window.postPlannedToExpense = async function(id){
  const plist = await api('/api/planned'); const p = plist.data.find(x=>x.id===id);
  if (!p) return alert('Не найдено');
  await api('/api/transactions', { method:'POST', body: JSON.stringify({
    type:'expense', title: p.title, amount: p.amount, groupId: p.group_id, date: todayISO(), comment: p.note || null
  })});
  alert('Проведено как расход'); showExpenses();
};
window.editPlanned = function(id){ alert('Редактирование планового — в следующей версии.'); };
window.editTx = function(id){ alert('Редактирование операции: удалите и добавьте снова (MVP).'); };

$('#period-switch').addEventListener('click', e=>{
  if (e.target.tagName!=='BUTTON') return;
  $$('#period-switch button').forEach(b=>b.classList.remove('active'));
  e.target.classList.add('active'); state.period = e.target.dataset.period; showDashboard();
});

$$('.tab-btn').forEach(b=> b.addEventListener('click', ()=> {
  $$('.tab-btn').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
  const tab = b.dataset.tab;
  if (tab==='dashboard') showDashboard();
  if (tab==='expenses') showExpenses();
  if (tab==='planning') showPlanning();
  if (tab==='settings') showSettings();
}));

$('#fab-add').addEventListener('click', openModal);
$('#m-cancel').addEventListener('click', closeModal);
$('#m-save').addEventListener('click', saveModal);
$$('.modal-tabs button').forEach(btn => btn.addEventListener('click', ()=>{
  $$('.modal-tabs button').forEach(x=>x.classList.remove('active'));
  btn.classList.add('active');
}));

(async function init(){
  try{ await loadSettings(); await loadGroups(); $('.tab-btn[data-tab="dashboard"]').classList.add('active'); showDashboard(); }
  catch(e){ $('#view').innerHTML = '<div class="card"><h3>Ошибка</h3><div class="meta">'+e.message+'</div></div>'; }
})();

function setActiveTab(tab){
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
}

// клики по табам
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    if (tab === 'dashboard') showDashboard();
    if (tab === 'expenses')  showExpenses();
    if (tab === 'planning')  showPlanning();
    if (tab === 'settings')  showSettings();
    setActiveTab(tab);
  });
});

// FAB по центру (модал добавления)
document.getElementById('fab-add').addEventListener('click', () => {
  openAddModal(); // у тебя уже есть логика открытия модалки
});

// при первой загрузке
setActiveTab('dashboard');

async function showExpenses(){
  setActiveTab('expenses');
  const v = document.getElementById('view');

  // даты для истории 7 дней
  const today = new Date();
  const to = today.toISOString().slice(0,10);
  const fromDate = new Date(today); fromDate.setDate(today.getDate() - 6);
  const from = fromDate.toISOString().slice(0,10);

  // грузим будущие (planned) и историю за 7 дней
  const [plannedRes, histRes] = await Promise.all([
    api('/api/planned'),
    api(`/api/transactions?type=expense&from=${from}&to=${to}`)
  ]);

  const planned = plannedRes.data || [];
  const history = histRes.data || [];

  const sub = planned.filter(p => p.plan_type === 'subscription');
  const rec = planned.filter(p => p.plan_type === 'recurring');
  const one = planned.filter(p => p.plan_type === 'oneoff');

  v.innerHTML = `
    <div class="page">
      <h2 class="page-title">Расходы</h2>

      <!-- Будущие расходы -->
      <section class="section">
        <div class="section-title">
          <h3>Будущие расходы</h3>
          <button class="add-btn" id="add-planned"><i class="fa-solid fa-plus"></i> Добавить</button>
        </div>

        ${renderPlannedSection('Подписки', sub, 'subscription')}
        ${renderPlannedSection('Ежемесячные', rec, 'recurring')}
        ${renderPlannedSection('Одноразовые', one, 'oneoff')}
      </section>

      <!-- История 7 дней -->
      <section class="section">
        <div class="section-title">
          <h3>История (последние 7 дней)</h3>
        </div>
        <div>${history.map(renderHistoryItem).join('') || emptyBlock('Нет операций')}</div>
      </section>
    </div>
  `;

  // обработчик "Добавить" в будущих расходах (открыть модал)
  document.getElementById('add-planned').addEventListener('click', openPlannedModal);

  // кнопки "+" у каждой позиции будущих расходов
  document.querySelectorAll('.do-post').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.id);
      const type = btn.dataset.type; // subscription|recurring|oneoff
      const item = planned.find(p => p.id === id);
      if (!item) return;

      // проводим как расход сегодня
      await api('/api/transactions', {
        method: 'POST',
        body: JSON.stringify({
          type: 'expense',
          title: item.title,
          date: new Date().toISOString().slice(0,10),
          amount: item.amount,
          groupId: item.group_id || null,
          comment: 'Проведено из будущих расходов'
        })
      });

      // если одноразовое — удаляем запись
      if (type === 'oneoff') {
        await api(`/api/planned?id=${id}`, { method: 'DELETE' });
      }

      // перерисовать экран и обновить дашборд
      await showExpenses();
      try { await showDashboard(); } catch (_) {}
    });
  });

  // удалить будущий расход вручную
  document.querySelectorAll('.planned-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.id);
      if (!id) return;
      if (!confirm('Удалить будущий расход?')) return;
      await api(`/api/planned?id=${id}`, { method: 'DELETE' });
      await showExpenses();
    });
  });

  // удалить проведённую операцию из истории
  document.querySelectorAll('.trn-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.id);
      if (!id) return;
      if (!confirm('Удалить операцию?')) return;
      await api(`/api/transactions?id=${id}`, { method: 'DELETE' });
      await showExpenses();
      try { await showDashboard(); } catch (_) {}
    });
  });

}

// вспомогательные рендеры
function renderPlannedSection(title, items, key){
  return `
    <div style="margin-bottom:14px">
      <div class="item-type-chip ${key==='subscription'?'sub':key==='recurring'?'rec':'one'}">${title}</div>
      <div style="margin-top:8px">
        ${items.map(renderPlannedItem).join('') || emptyBlock('Пусто')}
      </div>
    </div>
  `;
}

function renderPlannedItem(p){
  const typeLabel = p.plan_type === 'subscription' ? 'Подписка'
                   : p.plan_type === 'recurring'   ? 'Ежемесячный'
                   : 'Одноразовый';
  const dateText = p.next_due_date ? ` · ${toRuDate(p.next_due_date)}` : '';
  return `
    <div class="item-row">
      <div>
        <div class="item-title">${escapeHtml(p.title || '')}</div>
        <div class="item-meta">${typeLabel}${dateText}</div>
      </div>
      <div class="item-act">
        <div class="item-amount">${formatAmount(p.amount)}</div>
        <button class="do-post" data-id="${p.id}" data-type="${p.plan_type}" title="Провести">
          <i class="fa-solid fa-plus"></i>
        </button>
        <button class="del-btn planned-del" data-id="${p.id}" title="Удалить">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  `;
}


function renderHistoryItem(t){
  const date = toRuDate(t.date);
  return `
    <div class="item-row">
      <div>
        <div class="item-title">${escapeHtml(t.title || '')}</div>
        <div class="item-meta">${date}${t.group_name ? ' · ' + escapeHtml(t.group_name) : ''}</div>
      </div>
      <div class="item-act">
        <div class="item-amount">-${formatAmount(t.amount)}</div>
        <button class="del-btn trn-del" data-id="${t.id}" title="Удалить">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  `;
}

function emptyBlock(text){
  return `<div class="item-row" style="justify-content:center;grid-template-columns:1fr;"><div class="item-meta">${text}</div></div>`;
}

// формат
function formatAmount(v){
  const num = Number(v || 0);
  return num.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' сом';
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function openPlannedModal(){
  const m = document.getElementById('modal-planned');
  m.classList.remove('hidden');

  // сброс/дефолты
  document.getElementById('p-title').value = '';
  document.getElementById('p-amount').value = '';
  document.getElementById('p-type').value = 'subscription';
  document.getElementById('p-date').value = todayISO();   // ← НОВОЕ

  const onCancel = () => { cleanup(); m.classList.add('hidden'); };

  const onSave = async () => {
    const title = document.getElementById('p-title').value.trim();
    const amount = Number(document.getElementById('p-amount').value);
    const plan_type = document.getElementById('p-type').value; // subscription|recurring|oneoff
    const next_due_date = document.getElementById('p-date').value || todayISO(); // ← НОВОЕ

    if (!title) return toast('Укажи название');
    if (!(amount > 0)) return toast('Сумма должна быть > 0');

    await api('/api/planned', {
      method: 'POST',
      body: JSON.stringify({ plan_type, title, amount, next_due_date }) // ← НОВОЕ
    });

    cleanup();
    m.classList.add('hidden');
    await showExpenses();
  };

  function cleanup(){
    document.getElementById('p-cancel').removeEventListener('click', onCancel);
    document.getElementById('p-save').removeEventListener('click', onSave);
  }

  document.getElementById('p-cancel').addEventListener('click', onCancel);
  document.getElementById('p-save').addEventListener('click', onSave);
}


// простой тост (если уже есть — используй свой)
function toast(msg){
  alert(msg);
}
