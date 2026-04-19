// ── Data Store ────────────────────────────────────────
const Store = {
  persons: [],
  transactions: [],

  load() {
    try {
      this.persons = JSON.parse(localStorage.getItem('persons') || '[]');
      this.transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
      if (this.persons.length === 0) this.seed();
    } catch(e) { this.seed(); }
  },

  save() {
    localStorage.setItem('persons', JSON.stringify(this.persons));
    localStorage.setItem('transactions', JSON.stringify(this.transactions));
  },

  seed() {
    const now = Date.now(), day = 86400000;
    this.persons = [
      { id: 'p1', name: '田中 健太', note: '' },
      { id: 'p2', name: '山本 さくら', note: '' },
      { id: 'p3', name: '佐藤 洋平', note: '' },
    ];
    this.transactions = [
      { id: 't1', personId: 'p1', type: 'lent', amount: 15000, title: '飲み会代', description: '4月の歓迎会', dateMs: now - 6*day, dueDateMs: now + 18*day, status: 'pending', repaidAmount: 0 },
      { id: 't2', personId: 'p2', type: 'lent', amount: 8500, title: '交通費立替', description: '出張費用', dateMs: now - 8*day, dueDateMs: null, status: 'repaid', repaidAmount: 8500 },
      { id: 't3', personId: 'p3', type: 'borrowed', amount: 12000, title: '昼食代', description: 'ランチ', dateMs: now - 10*day, dueDateMs: now + 5*day, status: 'pending', repaidAmount: 0 },
    ];
    this.save();
  },

  uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); },

  getPerson(id) { return this.persons.find(p => p.id === id); },
  personIndex(id) { return this.persons.findIndex(p => p.id === id); },

  remaining(tx) { return Math.max(0, tx.amount - tx.repaidAmount); },

  totalLent() { return this.transactions.filter(t => t.type === 'lent').reduce((s, t) => s + this.remaining(t), 0); },
  totalBorrowed() { return this.transactions.filter(t => t.type === 'borrowed').reduce((s, t) => s + this.remaining(t), 0); },
  netBalance() { return this.totalLent() - this.totalBorrowed(); },

  balanceFor(personId) {
    const txs = this.transactions.filter(t => t.personId === personId);
    const lent = txs.filter(t => t.type === 'lent').reduce((s, t) => s + this.remaining(t), 0);
    const borrowed = txs.filter(t => t.type === 'borrowed').reduce((s, t) => s + this.remaining(t), 0);
    return lent - borrowed;
  },

  txsFor(personId) {
    return this.transactions.filter(t => t.personId === personId).sort((a, b) => b.dateMs - a.dateMs);
  },

  addPerson(name, note) { this.persons.push({ id: this.uid(), name, note }); this.save(); },
  updatePerson(p) { const i = this.persons.findIndex(x => x.id === p.id); if (i >= 0) { this.persons[i] = p; this.save(); } },
  deletePerson(id) { this.persons = this.persons.filter(p => p.id !== id); this.transactions = this.transactions.filter(t => t.personId !== id); this.save(); },

  addTransaction(t) { this.transactions.push({ ...t, id: this.uid() }); this.save(); },
  updateTransaction(t) { const i = this.transactions.findIndex(x => x.id === t.id); if (i >= 0) { this.transactions[i] = t; this.save(); } },
  deleteTransaction(id) { this.transactions = this.transactions.filter(t => t.id !== id); this.save(); },
};

// ── Helpers ───────────────────────────────────────────
function yen(n) { return '¥' + Math.round(n).toLocaleString('ja-JP'); }
function fmtDate(ms) { const d = new Date(ms); return `${d.getMonth()+1}月${d.getDate()}日`; }
function fmtDateFull(ms) { const d = new Date(ms); return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`; }
function fmtDateInput(ms) { return new Date(ms).toISOString().slice(0, 10); }
function initials(name) { const p = name.trim().split(/\s+/); return p.length >= 2 ? p[0][0] + p[1][0] : name.slice(0, 2); }
function avClass(idx) { return `av${idx % 5}`; }

function badgeHTML(tx) {
  if (tx.status === 'repaid') return `<span class="badge badge-repaid">✓ 返済済み</span>`;
  if (tx.dueDateMs) {
    const over = tx.dueDateMs < Date.now();
    return `<span class="badge ${over ? 'badge-overdue' : 'badge-due'}">${over ? '⚠ 期限超過: ' : '⏰ 期限: '}${fmtDate(tx.dueDateMs)}</span>`;
  }
  return '';
}

function amountHTML(tx) {
  const r = Store.remaining(tx);
  const cls = tx.type === 'lent' ? 'lent' : 'borrowed';
  const sign = tx.type === 'lent' ? '-' : '+';
  return `<div class="amount-col"><div class="amount-val ${cls}">${sign}${yen(r)}</div><div class="amount-label">${tx.type === 'lent' ? '貸した' : '借りた'}</div></div>`;
}

// ── Router ────────────────────────────────────────────
const Router = {
  stack: [],
  go(view, params = {}) {
    this.stack.push({ view, params });
    render(view, params);
  },
  back() {
    this.stack.pop();
    const prev = this.stack[this.stack.length - 1] || { view: 'home', params: {} };
    render(prev.view, prev.params);
  },
  replace(view, params = {}) {
    this.stack[this.stack.length - 1] = { view, params };
    render(view, params);
  }
};

// ── Main Render ───────────────────────────────────────
function render(view, params = {}) {
  const app = document.getElementById('app');
  switch(view) {
    case 'home': app.innerHTML = renderHome(); break;
    case 'people': app.innerHTML = renderPeople(); break;
    case 'history': app.innerHTML = renderHistory(params); break;
    case 'person': app.innerHTML = renderPerson(params.id); break;
    case 'transaction': app.innerHTML = renderTransaction(params.id); break;
  }
  bindEvents(view, params);
}

// ── Tab Bar ───────────────────────────────────────────
function tabBarHTML(active) {
  return `
  <nav class="tabbar">
    <button class="tab-item ${active==='home'?'active':''}" onclick="Router.go('home')">
      <span class="tab-icon">🏠</span><span>ホーム</span>
    </button>
    <button class="tab-item ${active==='people'?'active':''}" onclick="Router.go('people')">
      <span class="tab-icon">👥</span><span>人物</span>
    </button>
    <button class="tab-item ${active==='history'?'active':''}" onclick="Router.go('history')">
      <span class="tab-icon">📋</span><span>履歴</span>
    </button>
  </nav>`;
}

// ── Home ──────────────────────────────────────────────
function renderHome() {
  const net = Store.netBalance();
  const netColor = net >= 0 ? 'lent' : 'borrowed';
  const recent = [...Store.transactions].sort((a,b) => b.dateMs - a.dateMs).slice(0, 15);

  const rows = recent.map(tx => {
    const p = Store.getPerson(tx.personId); if (!p) return '';
    const idx = Store.personIndex(tx.personId);
    return `
    <div class="row-item" onclick="Router.go('transaction',{id:'${tx.id}'})">
      <div class="avatar ${avClass(idx)}">${initials(p.name)}</div>
      <div class="item-info">
        <div class="item-name">${p.name}</div>
        <div class="item-sub">${tx.title}</div>
        ${badgeHTML(tx)}
      </div>
      ${amountHTML(tx)}
      <span class="chevron">›</span>
    </div>`;
  }).join('');

  return `
  <div class="navbar">
    <span class="navbar-title">💰 かしかり帳</span>
  </div>
  <div class="scroll-content">
    <div class="summary-grid">
      <div class="summary-card"><div class="summary-label">貸した合計</div><div class="summary-amount lent">${yen(Store.totalLent())}</div></div>
      <div class="summary-card"><div class="summary-label">借りた合計</div><div class="summary-amount borrowed">${yen(Store.totalBorrowed())}</div></div>
    </div>
    <div class="summary-net">
      <div class="summary-label">差引残高（受け取るべき額）</div>
      <div class="summary-amount ${netColor}">${yen(net)}</div>
    </div>
    <button class="add-btn" onclick="showAddTx()">＋ 新しい記録を追加</button>
    <div class="section-label">最近の記録</div>
    <div class="card">${recent.length ? rows : '<div class="empty"><div class="empty-icon">📝</div>まだ記録がありません</div>'}</div>
  </div>
  ${tabBarHTML('home')}
  <div id="modal"></div>`;
}

// ── People ────────────────────────────────────────────
function renderPeople(search = '') {
  const list = search ? Store.persons.filter(p => p.name.includes(search)) : Store.persons;
  const rows = list.map(p => {
    const idx = Store.personIndex(p.id);
    const bal = Store.balanceFor(p.id);
    const balColor = bal > 0 ? 'lent' : bal < 0 ? 'borrowed' : '';
    const balLabel = bal > 0 ? '受け取るべき' : bal < 0 ? '返すべき' : '清算済み';
    const balSign = bal > 0 ? '-' : bal < 0 ? '+' : '±';
    return `
    <div class="row-item" onclick="Router.go('person',{id:'${p.id}'})">
      <div class="avatar ${avClass(idx)}">${initials(p.name)}</div>
      <div class="item-info">
        <div class="item-name">${p.name}</div>
        ${p.note ? `<div class="item-sub">${p.note}</div>` : ''}
      </div>
      <div class="amount-col">
        <div class="amount-val ${balColor}">${balSign}${yen(Math.abs(bal))}</div>
        <div class="amount-label">${balLabel}</div>
      </div>
      <span class="chevron">›</span>
    </div>`;
  }).join('');

  return `
  <div class="navbar">
    <span class="navbar-title">人物管理</span>
  </div>
  <div class="search-bar">🔍 <input type="text" placeholder="名前で検索..." id="people-search" value="${search}" oninput="Router.replace('people',{});document.getElementById('app').innerHTML=renderPeople(this.value);bindEvents('people')">
  </div>
  <div class="scroll-content" style="padding-top:0">
    ${list.length ? `<div class="card">${rows}</div>` : '<div class="empty"><div class="empty-icon">👥</div>人物が登録されていません</div>'}
  </div>
  <button class="fab" onclick="showAddPerson()">＋</button>
  ${tabBarHTML('people')}
  <div id="modal"></div>`;
}

// ── History ───────────────────────────────────────────
function renderHistory(params = {}) {
  const filter = params.filter || 'all';
  const search = params.search || '';

  let txs = [...Store.transactions];
  if (filter === 'lent') txs = txs.filter(t => t.type === 'lent');
  else if (filter === 'borrowed') txs = txs.filter(t => t.type === 'borrowed');
  else if (filter === 'pending') txs = txs.filter(t => t.status !== 'repaid');
  else if (filter === 'repaid') txs = txs.filter(t => t.status === 'repaid');
  if (search) txs = txs.filter(t => t.title.includes(search) || t.description.includes(search) || (Store.getPerson(t.personId)?.name || '').includes(search));
  txs.sort((a, b) => b.dateMs - a.dateMs);

  const groups = {};
  txs.forEach(tx => {
    const d = new Date(tx.dateMs);
    const key = `${d.getFullYear()}年${d.getMonth()+1}月`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  });

  const filters = [
    {key:'all',label:'すべて'},{key:'lent',label:'貸した'},{key:'borrowed',label:'借りた'},
    {key:'pending',label:'未返済'},{key:'repaid',label:'返済済み'}
  ];

  const chips = filters.map(f =>
    `<button class="filter-chip ${filter===f.key?'active':''}" onclick="Router.replace('history',{filter:'${f.key}',search:'${search}'})">${f.label}</button>`
  ).join('');

  const content = Object.entries(groups).map(([month, items]) => {
    const rows = items.map(tx => {
      const p = Store.getPerson(tx.personId); if (!p) return '';
      const idx = Store.personIndex(tx.personId);
      return `
      <div class="row-item" onclick="Router.go('transaction',{id:'${tx.id}'})">
        <div class="avatar ${avClass(idx)}" style="width:36px;height:36px;font-size:12px">${initials(p.name)}</div>
        <div class="item-info">
          <div class="item-name">${tx.title}</div>
          <div class="item-sub">${p.name} · ${fmtDate(tx.dateMs)}</div>
        </div>
        ${amountHTML(tx)}
      </div>`;
    }).join('');
    return `<div class="section-label">${month}</div><div class="card">${rows}</div>`;
  }).join('');

  return `
  <div class="navbar"><span class="navbar-title">取引履歴</span></div>
  <div class="filter-row">${chips}</div>
  <div class="search-bar">🔍 <input type="text" placeholder="タイトル・人物で検索..." id="history-search" value="${search}"
    oninput="Router.replace('history',{filter:'${filter}',search:this.value})">
  </div>
  <div class="scroll-content" style="padding-top:0">
    ${content || '<div class="empty"><div class="empty-icon">📋</div>記録がありません</div>'}
  </div>
  ${tabBarHTML('history')}`;
}

// ── Person Detail ─────────────────────────────────────
function renderPerson(id) {
  const p = Store.getPerson(id); if (!p) return '';
  const idx = Store.personIndex(id);
  const bal = Store.balanceFor(id);
  const txs = Store.txsFor(id);
  const balColor = bal > 0 ? 'lent' : bal < 0 ? 'borrowed' : '';
  const balText = bal > 0 ? `受け取るべき ${yen(bal)}` : bal < 0 ? `返すべき ${yen(Math.abs(bal))}` : '清算済み';

  const txRows = txs.map(tx => `
    <div class="row-item" onclick="Router.go('transaction',{id:'${tx.id}'})">
      <div class="item-info">
        <div class="item-name">${tx.title}</div>
        <div class="item-sub">${fmtDate(tx.dateMs)}</div>
      </div>
      ${amountHTML(tx)}
      <span class="chevron">›</span>
    </div>`).join('');

  return `
  <div class="navbar">
    <button class="navbar-btn navbar-back" onclick="Router.back()">‹ 戻る</button>
    <span class="navbar-title">${p.name}</span>
    <button class="navbar-btn" onclick="showEditPerson('${id}')">編集</button>
  </div>
  <div class="scroll-content">
    <div class="card" style="margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:14px;padding:14px">
        <div class="avatar ${avClass(idx)}" style="width:56px;height:56px;font-size:18px">${initials(p.name)}</div>
        <div>
          <div style="font-size:18px;font-weight:700">${p.name}</div>
          ${p.note ? `<div style="font-size:13px;color:#8e8e93;margin-top:2px">${p.note}</div>` : ''}
        </div>
      </div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="detail-row">
        <span class="detail-key">残高</span>
        <span class="detail-val ${balColor}">${balText}</span>
      </div>
    </div>
    <button class="add-btn" style="background:#34c759" onclick="showAddTx('${id}')">＋ この人との取引を追加</button>
    <div class="section-label">取引履歴</div>
    <div class="card">${txs.length ? txRows : '<div style="padding:20px;text-align:center;color:#8e8e93">取引がありません</div>'}</div>
    <button class="danger-btn" style="margin-top:20px" onclick="deletePerson('${id}')">この人物を削除</button>
  </div>
  <div id="modal"></div>`;
}

// ── Transaction Detail ────────────────────────────────
function renderTransaction(id) {
  const tx = Store.transactions.find(t => t.id === id); if (!tx) return '';
  const p = Store.getPerson(tx.personId);
  const idx = Store.personIndex(tx.personId);
  const r = Store.remaining(tx);
  const color = tx.type === 'lent' ? 'lent' : 'borrowed';

  const statusLabel = tx.status === 'repaid' ? '返済済み' : tx.status === 'partial' ? '一部返済' : '未返済';

  return `
  <div class="navbar">
    <button class="navbar-btn navbar-back" onclick="Router.back()">‹ 戻る</button>
    <span class="navbar-title">${tx.title}</span>
    <button class="navbar-btn" onclick="showEditTx('${id}')">編集</button>
  </div>
  <div class="scroll-content">
    <div class="card" style="margin-bottom:10px">
      <div class="detail-header">
        <div style="display:flex;align-items:center;gap:12px">
          ${p ? `<div class="avatar ${avClass(idx)}" style="width:48px;height:48px;font-size:15px">${initials(p.name)}</div>` : ''}
          <div>
            <div style="font-size:16px;font-weight:700">${p?.name || ''}</div>
            <div style="font-size:13px;color:${tx.type==='lent'?'#c0392b':'#1a7a3c'}">${tx.type==='lent'?'貸した':'借りた'}</div>
          </div>
        </div>
        <div style="text-align:right">
          <div class="detail-amount ${color}">${yen(tx.amount)}</div>
          ${tx.repaidAmount > 0 ? `<div class="detail-remaining">残り ${yen(r)}</div>` : ''}
        </div>
      </div>
    </div>
    <div class="card" style="margin-bottom:10px">
      <div class="detail-row"><span class="detail-key">タイトル</span><span class="detail-val">${tx.title}</span></div>
      ${tx.description ? `<div class="detail-row"><span class="detail-key">説明</span><span class="detail-val">${tx.description}</span></div>` : ''}
      <div class="detail-row"><span class="detail-key">日付</span><span class="detail-val">${fmtDateFull(tx.dateMs)}</span></div>
      ${tx.dueDateMs ? `<div class="detail-row"><span class="detail-key">返済期限</span><span class="detail-val">${fmtDateFull(tx.dueDateMs)}</span></div>` : ''}
      <div class="detail-row"><span class="detail-key">状態</span><span class="detail-val">${statusLabel}</span></div>
      ${tx.repaidAmount > 0 ? `<div class="detail-row"><span class="detail-key">返済済み</span><span class="detail-val">${yen(tx.repaidAmount)}</span></div>` : ''}
    </div>
    ${tx.status !== 'repaid' ? `
    <div class="card" style="margin-bottom:10px">
      <div class="action-row" onclick="showRepayment('${id}')"><span style="color:#007aff;font-size:15px;font-weight:500">返済を記録する</span></div>
      <div class="action-row" onclick="markRepaid('${id}')"><span style="color:#1a7a3c;font-size:15px;font-weight:500">全額返済済みにする</span></div>
    </div>` : ''}
    <div class="card">
      <div class="action-row" onclick="deleteTx('${id}')"><span style="color:#ff3b30;font-size:15px;font-weight:500">この記録を削除</span></div>
    </div>
  </div>
  <div id="modal"></div>`;
}

// ── Modals ────────────────────────────────────────────
function showModal(html) {
  document.getElementById('modal').innerHTML = `<div class="overlay" onclick="closeModalOutside(event)">${html}</div>`;
}
function closeModal() { const m = document.getElementById('modal'); if (m) m.innerHTML = ''; }
function closeModalOutside(e) { if (e.target.classList.contains('overlay')) closeModal(); }

function showAddTx(prePersonId = '') {
  const personOptions = Store.persons.map(p =>
    `<option value="${p.id}" ${p.id === prePersonId ? 'selected' : ''}>${p.name}</option>`
  ).join('');

  showModal(`
  <div class="sheet">
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <button class="navbar-btn" onclick="closeModal()">キャンセル</button>
      <span class="sheet-title">新しい記録</span>
      <button class="navbar-btn" onclick="saveNewTx()" style="font-weight:700">保存</button>
    </div>
    <div class="sheet-body">
      <div class="seg-control">
        <button class="seg-btn active lent-active" id="type-lent" onclick="setTxType('lent')">💸 貸した</button>
        <button class="seg-btn" id="type-borrowed" onclick="setTxType('borrowed')">💰 借りた</button>
      </div>
      <div class="form-section">
        <div class="form-label">相手</div>
        <div class="form-card">
          <div class="form-row">
            <label>人物</label>
            <select id="tx-person">${personOptions || '<option value="">人物を先に登録してください</option>'}</select>
          </div>
        </div>
      </div>
      <div class="form-section">
        <div class="form-label">内容</div>
        <div class="form-card">
          <div class="form-row"><label>金額</label><input type="number" id="tx-amount" placeholder="0" inputmode="numeric"></div>
          <div class="form-row"><label>タイトル</label><input type="text" id="tx-title" placeholder="例: 飲み会代"></div>
          <div class="form-row"><label>説明・メモ</label><textarea id="tx-desc" placeholder="内容の詳細..."></textarea></div>
        </div>
      </div>
      <div class="form-section">
        <div class="form-label">日付</div>
        <div class="form-card">
          <div class="form-row"><label>取引日</label><input type="date" id="tx-date" value="${fmtDateInput(Date.now())}"></div>
          <div class="form-row"><label>返済期限</label><input type="date" id="tx-due"></div>
        </div>
      </div>
    </div>
  </div>`);
}

let currentTxType = 'lent';
function setTxType(type) {
  currentTxType = type;
  document.getElementById('type-lent').className = `seg-btn ${type==='lent'?'active lent-active':''}`;
  document.getElementById('type-borrowed').className = `seg-btn ${type==='borrowed'?'active borrowed-active':''}`;
}

function saveNewTx() {
  const personId = document.getElementById('tx-person')?.value;
  const amount = parseFloat(document.getElementById('tx-amount')?.value);
  const title = document.getElementById('tx-title')?.value.trim();
  const desc = document.getElementById('tx-desc')?.value.trim();
  const dateVal = document.getElementById('tx-date')?.value;
  const dueVal = document.getElementById('tx-due')?.value;

  if (!personId) { alert('相手を選んでください'); return; }
  if (!title) { alert('タイトルを入力してください'); return; }
  if (!amount || amount <= 0) { alert('金額を入力してください'); return; }

  Store.addTransaction({
    personId, type: currentTxType, amount, title,
    description: desc || '',
    dateMs: dateVal ? new Date(dateVal).getTime() : Date.now(),
    dueDateMs: dueVal ? new Date(dueVal).getTime() : null,
    status: 'pending', repaidAmount: 0,
  });
  currentTxType = 'lent';
  closeModal();
  const cur = Router.stack[Router.stack.length - 1];
  render(cur.view, cur.params);
}

function showAddPerson() {
  showModal(`
  <div class="sheet">
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <button class="navbar-btn" onclick="closeModal()">キャンセル</button>
      <span class="sheet-title">人物を追加</span>
      <button class="navbar-btn" onclick="saveNewPerson()" style="font-weight:700">追加</button>
    </div>
    <div class="sheet-body">
      <div class="form-section">
        <div class="form-label">基本情報</div>
        <div class="form-card">
          <div class="form-row"><label>氏名</label><input type="text" id="person-name" placeholder="例: 田中 健太"></div>
          <div class="form-row"><label>メモ</label><input type="text" id="person-note" placeholder="任意"></div>
        </div>
      </div>
    </div>
  </div>`);
}

function saveNewPerson() {
  const name = document.getElementById('person-name')?.value.trim();
  const note = document.getElementById('person-note')?.value.trim();
  if (!name) { alert('氏名を入力してください'); return; }
  Store.addPerson(name, note || '');
  closeModal();
  render('people');
}

function showEditPerson(id) {
  const p = Store.getPerson(id); if (!p) return;
  showModal(`
  <div class="sheet">
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <button class="navbar-btn" onclick="closeModal()">キャンセル</button>
      <span class="sheet-title">情報を編集</span>
      <button class="navbar-btn" onclick="saveEditPerson('${id}')" style="font-weight:700">保存</button>
    </div>
    <div class="sheet-body">
      <div class="form-section">
        <div class="form-card">
          <div class="form-row"><label>氏名</label><input type="text" id="edit-name" value="${p.name}"></div>
          <div class="form-row"><label>メモ</label><input type="text" id="edit-note" value="${p.note}"></div>
        </div>
      </div>
    </div>
  </div>`);
}

function saveEditPerson(id) {
  const p = Store.getPerson(id); if (!p) return;
  p.name = document.getElementById('edit-name')?.value.trim() || p.name;
  p.note = document.getElementById('edit-note')?.value.trim() || '';
  Store.updatePerson(p);
  closeModal();
  Router.replace('person', { id });
}

function deletePerson(id) {
  if (!confirm('この人物と全取引を削除しますか？')) return;
  Store.deletePerson(id);
  Router.back();
}

function showEditTx(id) {
  const tx = Store.transactions.find(t => t.id === id); if (!tx) return;
  showModal(`
  <div class="sheet">
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <button class="navbar-btn" onclick="closeModal()">キャンセル</button>
      <span class="sheet-title">記録を編集</span>
      <button class="navbar-btn" onclick="saveEditTx('${id}')" style="font-weight:700">保存</button>
    </div>
    <div class="sheet-body">
      <div class="seg-control">
        <button class="seg-btn ${tx.type==='lent'?'active lent-active':''}" id="edit-type-lent" onclick="setEditType('lent')">💸 貸した</button>
        <button class="seg-btn ${tx.type==='borrowed'?'active borrowed-active':''}" id="edit-type-borrowed" onclick="setEditType('borrowed')">💰 借りた</button>
      </div>
      <div class="form-card" style="margin-bottom:16px">
        <div class="form-row"><label>金額</label><input type="number" id="edit-amount" value="${tx.amount}" inputmode="numeric"></div>
        <div class="form-row"><label>タイトル</label><input type="text" id="edit-title" value="${tx.title}"></div>
        <div class="form-row"><label>説明</label><textarea id="edit-desc">${tx.description}</textarea></div>
        <div class="form-row"><label>取引日</label><input type="date" id="edit-date" value="${fmtDateInput(tx.dateMs)}"></div>
        <div class="form-row"><label>返済期限</label><input type="date" id="edit-due" value="${tx.dueDateMs ? fmtDateInput(tx.dueDateMs) : ''}"></div>
      </div>
    </div>
  </div>`);
  currentEditType = tx.type;
}

let currentEditType = 'lent';
function setEditType(type) {
  currentEditType = type;
  document.getElementById('edit-type-lent').className = `seg-btn ${type==='lent'?'active lent-active':''}`;
  document.getElementById('edit-type-borrowed').className = `seg-btn ${type==='borrowed'?'active borrowed-active':''}`;
}

function saveEditTx(id) {
  const tx = Store.transactions.find(t => t.id === id); if (!tx) return;
  tx.type = currentEditType;
  tx.amount = parseFloat(document.getElementById('edit-amount')?.value) || tx.amount;
  tx.title = document.getElementById('edit-title')?.value.trim() || tx.title;
  tx.description = document.getElementById('edit-desc')?.value.trim() || '';
  const dateVal = document.getElementById('edit-date')?.value;
  const dueVal = document.getElementById('edit-due')?.value;
  if (dateVal) tx.dateMs = new Date(dateVal).getTime();
  tx.dueDateMs = dueVal ? new Date(dueVal).getTime() : null;
  Store.updateTransaction(tx);
  closeModal();
  Router.replace('transaction', { id });
}

function showRepayment(id) {
  const tx = Store.transactions.find(t => t.id === id); if (!tx) return;
  const r = Store.remaining(tx);
  showModal(`
  <div class="sheet">
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <button class="navbar-btn" onclick="closeModal()">キャンセル</button>
      <span class="sheet-title">返済を記録</span>
      <button class="navbar-btn" onclick="saveRepayment('${id}')" style="font-weight:700">記録する</button>
    </div>
    <div class="sheet-body">
      <div class="form-card">
        <div class="form-row"><label>残り返済額</label><span style="color:#8e8e93">${yen(r)}</span></div>
        <div class="form-row"><label>返済金額</label><input type="number" id="repay-amount" placeholder="0" inputmode="numeric"></div>
      </div>
    </div>
  </div>`);
}

function saveRepayment(id) {
  const tx = Store.transactions.find(t => t.id === id); if (!tx) return;
  const amt = parseFloat(document.getElementById('repay-amount')?.value);
  if (!amt || amt <= 0) { alert('金額を入力してください'); return; }
  tx.repaidAmount = Math.min(tx.amount, tx.repaidAmount + amt);
  tx.status = tx.repaidAmount >= tx.amount ? 'repaid' : 'partial';
  Store.updateTransaction(tx);
  closeModal();
  Router.replace('transaction', { id });
}

function markRepaid(id) {
  const tx = Store.transactions.find(t => t.id === id); if (!tx) return;
  tx.status = 'repaid'; tx.repaidAmount = tx.amount;
  Store.updateTransaction(tx);
  Router.replace('transaction', { id });
}

function deleteTx(id) {
  if (!confirm('この記録を削除しますか？')) return;
  Store.deleteTransaction(id);
  Router.back();
}

function bindEvents(view, params) {}

// ── Init ──────────────────────────────────────────────
Store.load();
Router.go('home');

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
