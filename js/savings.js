onAppReady(() => {
  const form = document.getElementById('goal-form');
  const container = document.getElementById('goals-container');
  const targetPriceInput = document.getElementById('target-price');

  const formatRs = (amount) => formatMoney(amount);
  const parseRawNumber = (str) => parseFloat(str.toString().replace(/,/g, '')) || 0;

  function setupLiveCommaFormatting(inputEl) {
    if (!inputEl) return;
    inputEl.type = 'text';
    inputEl.addEventListener('input', (e) => {
      let cursorPosition = e.target.selectionStart;
      let originalLength = e.target.value.length;
      let rawValue = e.target.value.replace(/[^0-9.]/g, '');
      if (!rawValue) {
        e.target.value = '';
        return;
      }
      const parts = rawValue.split('.');
      if (parts.length > 2) parts.pop();
      parts[0] = parseInt(parts[0], 10).toLocaleString('en-LK');
      e.target.value = parts.join('.');
      let newLength = e.target.value.length;
      cursorPosition += newLength - originalLength;
      e.target.setSelectionRange(cursorPosition, cursorPosition);
    });
  }

  if (!document.getElementById('goal-animation-style')) {
    const style = document.createElement('style');
    style.id = 'goal-animation-style';
    style.innerHTML = `
      @keyframes popIn {
        0% { transform: scale(0.95); opacity: 0.8; }
        50% { transform: scale(1.02); }
        100% { transform: scale(1); opacity: 1; }
      }
      .goal-completed-card {
        animation: popIn 0.5s ease-out forwards;
        border-color: #10b981 !important;
        background-color: #f0fdf4 !important;
      }
      body.dark-mode .goal-completed-card {
        background-color: #064e3b !important;
      }
      .contrib-toggle {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        margin-top: 0.75rem;
        padding: 0.55rem 0.75rem;
        background: var(--bg-color);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        color: var(--text-color);
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 600;
      }
      .contrib-toggle:hover { border-color: var(--primary-color); }
      .contrib-toggle .chevron {
        transition: transform 0.2s ease;
        font-size: 0.85rem;
        color: var(--text-muted);
      }
      .contrib-toggle.open .chevron { transform: rotate(180deg); }
      .contrib-panel {
        display: none;
        margin-top: 0.5rem;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        background: var(--bg-color);
        max-height: 280px;
        overflow-y: auto;
      }
      .contrib-panel.open { display: block; }
      .contrib-month {
        padding: 0.55rem 0.75rem 0.25rem;
        font-size: 0.8rem;
        font-weight: 700;
        color: var(--primary-color);
        text-transform: uppercase;
        letter-spacing: 0.03em;
        border-top: 1px solid var(--border-color);
      }
      .contrib-month:first-child { border-top: none; }
      .contrib-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.4rem 0.75rem;
        font-size: 0.9rem;
        border-top: 1px solid var(--border-color);
      }
      .contrib-month + .contrib-row { border-top: none; }
      .contrib-date { color: var(--text-muted); }
      .contrib-amount { font-weight: 600; color: var(--success); }
      .contrib-empty { padding: 0.75rem; color: var(--text-muted); font-size: 0.9rem; }
      .contrib-actions { display: inline-flex; gap: 0.35rem; margin-left: 0.5rem; }
      .btn-edit-contrib, .btn-del-contrib {
        border: 1px solid var(--border-color);
        background: var(--card-bg);
        color: var(--text-color);
        border-radius: 5px;
        padding: 0.15rem 0.45rem;
        font-size: 0.75rem;
        cursor: pointer;
        font-weight: 600;
      }
      .btn-del-contrib { background: #ef4444; color: #fff; border: none; }
      .contrib-row { flex-wrap: wrap; gap: 0.35rem; }
    `;
    document.head.appendChild(style);
  }

  setupLiveCommaFormatting(targetPriceInput);

  function todayISO() {
    const t = new Date();
    return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  }

  function parseFlexibleDate(str) {
    if (!str) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      const d = new Date(str);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  function monthKey(dateObj) {
    return dateObj.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  function displayDate(dateObj) {
    return dateObj.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

  function ensureContributionHistory(goals) {
    const transactions = getStorageData(KEYS.TRANSACTIONS);
    let changed = false;
    goals.forEach((goal) => {
      if (!Array.isArray(goal.contributions)) {
        goal.contributions = [];
        changed = true;
      }
      if (goal.contributions.length === 0 && Number(goal.saved) > 0) {
        const related = transactions.filter(
          (tx) => tx.category === 'Savings Deposit' && tx.description === 'Daily Savings contribution for: ' + goal.name
        );
        related.forEach((tx) => {
          const d = parseFlexibleDate(tx.date) || new Date();
          goal.contributions.push({
            id: tx.id || Date.now() + Math.random(),
            amount: Number(tx.amount) || 0,
            dateISO: d.toISOString().slice(0, 10),
            dateLabel: tx.date
          });
        });
        if (related.length) changed = true;
      }
    });
    if (changed) setStorageData(KEYS.SAVINGS_GOALS, goals);
    return goals;
  }

  function buildHistoryHtml(goal) {
    const list = Array.isArray(goal.contributions) ? goal.contributions.slice() : [];
    if (!list.length) {
      return '<div class="contrib-empty">No deposits recorded yet.</div>';
    }
    list.sort((a, b) => String(b.dateISO || '').localeCompare(String(a.dateISO || '')));
    const groups = {};
    const order = [];
    list.forEach((c) => {
      const d = parseFlexibleDate(c.dateISO || c.dateLabel) || new Date();
      const key = monthKey(d);
      if (!groups[key]) {
        groups[key] = [];
        order.push(key);
      }
      groups[key].push(Object.assign({}, c, { _d: d }));
    });
    let html = '';
    order.forEach((key) => {
      html += '<div class="contrib-month">' + key + '</div>';
      groups[key].forEach((c) => {
        html +=
          '<div class="contrib-row">' +
          '<span class="contrib-date">' + displayDate(c._d) + '</span>' +
          '<span class="contrib-amount">+ ' + formatRs(c.amount) + '</span>' +
          '<span class="contrib-actions">' +
          '<button type="button" class="btn-edit-contrib" data-goal="' + goal.id + '" data-contrib="' + c.id + '">Edit</button>' +
          '<button type="button" class="btn-del-contrib" data-goal="' + goal.id + '" data-contrib="' + c.id + '">Delete</button>' +
          '</span></div>';
      });
    });
    return html;
  }

  function renderGoals() {
    let goals = getStorageData(KEYS.SAVINGS_GOALS);
    goals = ensureContributionHistory(goals);
    container.innerHTML = '';
    if (goals.length === 0) {
      container.innerHTML = '<p>No savings targets set yet.</p>';
      return;
    }

    goals.forEach((goal) => {
      const card = document.createElement('div');
      card.className = 'goal-card';
      card.style.border = '1px solid var(--border-color)';
      card.style.borderRadius = '8px';
      card.style.padding = '1rem';
      card.style.marginTop = '1rem';

      const remaining = Math.max(0, goal.target - goal.saved);
      const isCompleted = goal.saved >= goal.target;
      const progress = Math.min(100, (goal.saved / goal.target) * 100).toFixed(1);
      const contribCount = (goal.contributions || []).length;
      if (isCompleted) card.classList.add('goal-completed-card');

      card.innerHTML =
        '<div style="display:flex; justify-content:space-between; align-items:center;">' +
          '<h3 style="margin:0;">' + goal.name +
          (isCompleted ? ' 🎉 <span style="font-size:0.8rem; color:#10b981; font-weight:bold;">(Completed!)</span>' : '') +
          '</h3>' +
          '<button type="button" class="btn-del-goal" data-id="' + goal.id +
          '" style="background:#ef4444; color:white; border:none; padding:0.3rem 0.7rem; border-radius:5px; cursor:pointer; font-size:0.85rem;">Delete</button>' +
        '</div>' +
        '<p style="margin-top:0.5rem;">Saved: <strong>' + formatRs(goal.saved) + '</strong> / ' +
          formatRs(goal.target) + ' (' + progress + '%)</p>' +
        '<div style="background:#e2e8f0; height:10px; border-radius:5px; margin: 0.5rem 0; overflow:hidden;">' +
          '<div style="background:var(--success); width:' + progress + '%; height:100%; transition: width 0.4s ease;"></div>' +
        '</div>' +
        '<div id="error-' + goal.id + '" style="color:#ef4444; font-size:0.85rem; font-weight:500; margin-bottom:0.5rem; display:none;"></div>' +
        (isCompleted
          ? '<div style="color:#10b981; font-weight:bold; font-size:0.9rem; margin-top:0.5rem;">✅ Target reached! No further deposits needed.</div>'
          : '<div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">' +
              '<input type="text" id="deposit-' + goal.id + '" placeholder="Amount (Remaining: ' + formatRs(remaining) +
              ')" style="flex:1; min-width:140px;">' +
              '<button type="button" class="btn-save-today" data-id="' + goal.id + '">Save Today</button>' +
            '</div>') +
        '<button type="button" class="contrib-toggle" data-id="' + goal.id + '" aria-expanded="false">' +
          '<span>Contribution history (' + contribCount + ')</span><span class="chevron">▼</span>' +
        '</button>' +
        '<div class="contrib-panel" id="contrib-panel-' + goal.id + '">' + buildHistoryHtml(goal) + '</div>';

      container.appendChild(card);
      const depositInput = document.getElementById('deposit-' + goal.id);
      if (depositInput) setupLiveCommaFormatting(depositInput);
    });

    container.querySelectorAll('.contrib-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const panel = document.getElementById('contrib-panel-' + id);
        const open = panel.classList.toggle('open');
        btn.classList.toggle('open', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });
    container.querySelectorAll('.btn-save-today').forEach((btn) => {
      btn.addEventListener('click', () => makeContribution(Number(btn.dataset.id)));
    });
    container.querySelectorAll('.btn-del-goal').forEach((btn) => {
      btn.addEventListener('click', () => deleteGoal(Number(btn.dataset.id)));
    });
    container.querySelectorAll('.btn-edit-contrib').forEach((btn) => {
      btn.addEventListener('click', () => {
        const goalId = Number(btn.dataset.goal);
        const contribId = Number(btn.dataset.contrib);
        editContribution(goalId, contribId);
      });
    });
    container.querySelectorAll('.btn-del-contrib').forEach((btn) => {
      btn.addEventListener('click', () => {
        const goalId = Number(btn.dataset.goal);
        const contribId = Number(btn.dataset.contrib);
        if (!confirm('Delete this deposit? It will also be removed from the Dashboard.')) return;
        const res = deleteSavingsContribution(goalId, contribId);
        if (!res.ok) {
          alert(res.error || 'Could not delete.');
          return;
        }
        showInAppToast('Deposit deleted');
        renderGoals();
      });
    });
  }

  function editContribution(goalId, contribId) {
    const goals = getStorageData(KEYS.SAVINGS_GOALS);
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;
    const contrib = (goal.contributions || []).find((c) => c.id === contribId);
    if (!contrib) return;

    const raw = prompt(
      'Edit deposit amount for "' + goal.name + '"\\n\\nCurrent: ' + formatRs(contrib.amount),
      String(contrib.amount)
    );
    if (raw === null) return;
    const newAmount = parseRawNumber(raw);
    const res = updateSavingsContribution(goalId, contribId, newAmount);
    if (!res.ok) {
      alert(res.error || 'Could not update.');
      return;
    }
    showInAppToast('Deposit updated — Dashboard balance updated too');
    renderGoals();
  }

  window.makeContribution = function (goalId) {
    const amountInput = document.getElementById('deposit-' + goalId);
    const errorEl = document.getElementById('error-' + goalId);
    const depositVal = parseRawNumber(amountInput ? amountInput.value : '');
    if (errorEl) errorEl.style.display = 'none';

    const goals = getStorageData(KEYS.SAVINGS_GOALS);
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;
    if (!Array.isArray(goal.contributions)) goal.contributions = [];

    const remaining = goal.target - goal.saved;
    if (goal.saved >= goal.target) {
      if (errorEl) { errorEl.textContent = 'Target already completed! You cannot add more money.'; errorEl.style.display = 'block'; }
      return;
    }
    if (isNaN(depositVal) || depositVal <= 0) {
      if (errorEl) { errorEl.textContent = 'Please enter a valid amount.'; errorEl.style.display = 'block'; }
      return;
    }
    if (depositVal > remaining) {
      if (errorEl) { errorEl.textContent = 'You only need ' + formatRs(remaining) + ' to complete this item goal!'; errorEl.style.display = 'block'; }
      return;
    }

    // Savings deposits come from Cash wallet — cannot exceed Cash balance
    const txs = getStorageData(KEYS.TRANSACTIONS);
    let cashBal = 0;
    txs.forEach((tx) => {
      if (tx.type === 'transfer') {
        if (tx.fromAccount === 'Cash') cashBal -= Number(tx.amount) || 0;
        if (tx.toAccount === 'Cash') cashBal += Number(tx.amount) || 0;
        return;
      }
      const acc = tx.account || 'Cash';
      if (acc !== 'Cash') return;
      if (tx.type === 'income') cashBal += Number(tx.amount) || 0;
      else if (tx.type === 'expense') cashBal -= Number(tx.amount) || 0;
    });
    if (depositVal > cashBal + 1e-9) {
      if (errorEl) {
        errorEl.textContent = 'Not enough Cash wallet balance. Available: ' + formatRs(Math.max(0, cashBal));
        errorEl.style.display = 'block';
      }
      return;
    }

    const iso = todayISO();
    const txId = Date.now();
    goal.saved += depositVal;
    goal.contributions.push({ id: txId, amount: depositVal, dateISO: iso, dateLabel: new Date().toLocaleDateString() });
    setStorageData(KEYS.SAVINGS_GOALS, goals);

    const transactions = getStorageData(KEYS.TRANSACTIONS);
    transactions.push({
      id: txId,
      type: 'expense',
      category: 'Savings Deposit',
      account: 'Cash',
      amount: depositVal,
      description: savingsDescForGoal(goal.name),
      date: iso
    });
    setStorageData(KEYS.TRANSACTIONS, transactions);
    renderGoals();
  };

  window.deleteGoal = function (goalId) {
    const goals = getStorageData(KEYS.SAVINGS_GOALS);
    const goalToDelete = goals.find((g) => g.id === goalId);
    if (!goalToDelete) return;
    if (!confirm('Are you sure you want to delete "' + goalToDelete.name + '" from your savings targets?\n\nThis will also remove all associated contribution transactions from your Dashboard.')) return;
    setStorageData(KEYS.SAVINGS_GOALS, goals.filter((g) => g.id !== goalId));
    const transactions = getStorageData(KEYS.TRANSACTIONS);
    setStorageData(KEYS.TRANSACTIONS, transactions.filter((tx) => tx.description !== 'Daily Savings contribution for: ' + goalToDelete.name));
    renderGoals();
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const inputName = document.getElementById('item-name').value.trim();
    const inputTarget = parseRawNumber(targetPriceInput.value);
    if (!inputName || isNaN(inputTarget) || inputTarget <= 0) return;
    const goals = getStorageData(KEYS.SAVINGS_GOALS);
    if (goals.some((g) => g.name.toLowerCase() === inputName.toLowerCase())) {
      alert('The item "' + inputName + '" already exists in your savings target list!');
      return;
    }
    goals.push({ id: Date.now(), name: inputName, target: inputTarget, saved: 0, contributions: [] });
    setStorageData(KEYS.SAVINGS_GOALS, goals);
    form.reset();
    renderGoals();
  });

  renderGoals();
});
