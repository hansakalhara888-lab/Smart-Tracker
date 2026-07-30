onAppReady(() => {
  const txListEl = document.getElementById('transaction-list');
  const totalBalanceEl = document.getElementById('total-balance');
  const totalIncomeEl = document.getElementById('total-income');
  const totalExpenseEl = document.getElementById('total-expense');
  const walletCashEl = document.getElementById('wallet-cash');
  const walletBankEl = document.getElementById('wallet-bank');
  const walletCardEl = document.getElementById('wallet-card');
  const form = document.getElementById('transaction-form');
  const typeSelect = document.getElementById('type');
  const categorySelect = document.getElementById('category');
  const accountSelect = document.getElementById('account');
  const billMonthlyBox = document.getElementById('bill-monthly-box');
  const amountInput = document.getElementById('amount');
  const descInput = document.getElementById('description');
  const editingIdInput = document.getElementById('editing-tx-id');
  const submitBtn = document.getElementById('tx-submit-btn');
  const cancelEditBtn = document.getElementById('tx-cancel-edit');
  const formTitle = document.getElementById('tx-form-title');
  const customCatPanel = document.getElementById('custom-cat-panel');
  const newCatInput = document.getElementById('new-category-input');
  const addCatBtn = document.getElementById('add-category-btn');
  const customCatChips = document.getElementById('custom-cat-chips');
  const transferForm = document.getElementById('transfer-form');
  const transferAmountInput = document.getElementById('transfer-amount');
  const txPagination = document.getElementById('tx-pagination');
  const txPagePrev = document.getElementById('tx-page-prev');
  const txPageNext = document.getElementById('tx-page-next');
  const txPageInfo = document.getElementById('tx-page-info');

  const WALLETS = ['Cash', 'Bank', 'Card'];
  const TX_PAGE_SIZE = 15;
  let txPage = 1;
  let formDirty = false;
  let suppressDirty = false;

  function parseRawNumber(str) {
    return parseFloat(String(str || '').replace(/,/g, '')) || 0;
  }

  function setupLiveCommaFormatting(inputEl) {
    if (!inputEl) return;
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
      if (parts[1] !== undefined) parts[1] = parts[1].slice(0, 2);
      parts[0] = parts[0] ? parseInt(parts[0], 10).toLocaleString('en-LK') : '0';
      if (parts[0] === 'NaN') parts[0] = '0';
      e.target.value = parts.join('.');
      const newLength = e.target.value.length;
      cursorPosition += newLength - originalLength;
      e.target.setSelectionRange(Math.max(0, cursorPosition), Math.max(0, cursorPosition));
    });
  }

  setupLiveCommaFormatting(amountInput);
  setupLiveCommaFormatting(transferAmountInput);

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function markDirty() {
    if (!suppressDirty) formDirty = true;
  }

  function clearDirty() {
    formDirty = false;
  }

  if (form) {
    form.querySelectorAll('input, select, textarea').forEach((el) => {
      el.addEventListener('input', markDirty);
      el.addEventListener('change', markDirty);
    });
  }
  if (transferForm) {
    transferForm.querySelectorAll('input, select').forEach((el) => {
      el.addEventListener('input', markDirty);
      el.addEventListener('change', markDirty);
    });
  }

  window.addEventListener('beforeunload', (e) => {
    if (!formDirty) return;
    e.preventDefault();
    e.returnValue = '';
  });

  document.querySelectorAll('a.nav-link, .footer-links a, a.brand-logo').forEach((a) => {
    a.addEventListener('click', (e) => {
      if (!formDirty) return;
      if (!confirm('You have unsaved changes. Leave this page?')) {
        e.preventDefault();
      }
    });
  });

  const FIXED_EXPENSE_CATEGORIES = [
    { value: 'Food', label: 'Food' },
    { value: 'Transport', label: 'Transport' },
    { value: 'Bills', label: 'Bills' },
    { value: 'Shopping', label: 'Shopping' },
    { value: 'Savings Deposit', label: 'Savings Deposit' },
    { value: 'Other', label: 'Other' }
  ];
  const FIXED_NAMES_LOWER = FIXED_EXPENSE_CATEGORIES.map((c) => c.value.toLowerCase());

  function getAllExpenseCategories() {
    const custom = getCustomCategories();
    const list = FIXED_EXPENSE_CATEGORIES.map((c) => ({ value: c.value, label: c.label, custom: false }));
    custom.forEach((name) => {
      if (!FIXED_NAMES_LOWER.includes(name.toLowerCase())) {
        list.push({ value: name, label: name, custom: true });
      }
    });
    return list;
  }

  function renderCustomChips() {
    if (!customCatChips) return;
    const custom = getCustomCategories();
    if (!custom.length) {
      customCatChips.innerHTML = '';
      return;
    }
    customCatChips.innerHTML = custom
      .map(function (name) {
        return (
          '<span class="cat-chip">' +
          escapeHtml(name) +
          '<button type="button" data-remove-cat="' +
          escapeAttr(name) +
          '" title="Remove">×</button></span>'
        );
      })
      .join('');
    customCatChips.querySelectorAll('[data-remove-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-remove-cat');
        if (!confirm('Remove category "' + name + '"?\n\nExisting transactions keep this category name.')) return;
        removeCustomCategory(name);
        const current = categorySelect ? categorySelect.value : '';
        setCategoryOptions(typeSelect ? typeSelect.value : 'expense');
        if (categorySelect && current) {
          const stillThere = Array.from(categorySelect.options).some((o) => o.value === current);
          if (stillThere) categorySelect.value = current;
        }
        renderCustomChips();
        showInAppToast('Category removed: ' + name);
      });
    });
  }

  function setCategoryOptions(type) {
    if (!categorySelect) return;
    const prev = categorySelect.value;
    categorySelect.innerHTML = '';

    if (type === 'income') {
      const opt = document.createElement('option');
      opt.value = 'Income';
      opt.textContent = 'Income';
      opt.selected = true;
      categorySelect.appendChild(opt);
      categorySelect.value = 'Income';
      categorySelect.disabled = true;
      categorySelect.title = 'Category is fixed to Income for income transactions';
      if (billMonthlyBox) billMonthlyBox.style.display = 'none';
      if (customCatPanel) customCatPanel.style.display = 'none';
    } else {
      getAllExpenseCategories().forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c.value;
        opt.textContent = c.custom ? c.label + ' ★' : c.label;
        categorySelect.appendChild(opt);
      });
      categorySelect.disabled = false;
      categorySelect.title = '';
      if (prev && Array.from(categorySelect.options).some((o) => o.value === prev)) {
        categorySelect.value = prev;
      }
      if (customCatPanel) customCatPanel.style.display = 'block';
      toggleBillQuestion();
    }
  }

  function toggleBillQuestion() {
    if (!billMonthlyBox || !categorySelect) return;
    const isBills =
      typeSelect &&
      typeSelect.value === 'expense' &&
      categorySelect.value === 'Bills' &&
      !(editingIdInput && editingIdInput.value);
    billMonthlyBox.style.display = isBills ? 'block' : 'none';
    if (!isBills) {
      const no = document.getElementById('bill-monthly-no');
      if (no) no.checked = true;
    }
  }

  if (typeSelect) {
    typeSelect.addEventListener('change', () => setCategoryOptions(typeSelect.value));
    setCategoryOptions(typeSelect.value || 'expense');
  }
  if (categorySelect) {
    categorySelect.addEventListener('change', toggleBillQuestion);
  }

  function tryAddCategory() {
    if (!newCatInput) return;
    const name = newCatInput.value.trim();
    if (!name) {
      alert('Enter a category name.');
      return;
    }
    if (name.length > 40) {
      alert('Category name is too long (max 40 characters).');
      return;
    }
    if (FIXED_NAMES_LOWER.includes(name.toLowerCase()) || name.toLowerCase() === 'income') {
      alert('"' + name + '" is already a built-in category.');
      return;
    }
    const before = getCustomCategories().length;
    addCustomCategory(name);
    if (getCustomCategories().length === before) {
      alert('That category already exists.');
      return;
    }
    newCatInput.value = '';
    setCategoryOptions(typeSelect ? typeSelect.value : 'expense');
    if (categorySelect) categorySelect.value = name;
    renderCustomChips();
    toggleBillQuestion();
    showInAppToast('Category added: ' + name);
  }

  if (addCatBtn) addCatBtn.addEventListener('click', tryAddCategory);
  if (newCatInput) {
    newCatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        tryAddCategory();
      }
    });
  }
  renderCustomChips();

  function computeWalletBalances(transactions) {
    const bal = { Cash: 0, Bank: 0, Card: 0 };
    transactions.forEach((tx) => {
      if (tx.type === 'transfer') {
        const from = WALLETS.includes(tx.fromAccount) ? tx.fromAccount : 'Cash';
        const to = WALLETS.includes(tx.toAccount) ? tx.toAccount : 'Bank';
        const amt = Number(tx.amount) || 0;
        bal[from] -= amt;
        bal[to] += amt;
        return;
      }
      const acc = WALLETS.includes(tx.account) ? tx.account : 'Cash';
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'income') bal[acc] += amt;
      else if (tx.type === 'expense') bal[acc] -= amt;
    });
    return bal;
  }

  function currentWallets() {
    return computeWalletBalances(getStorageData(KEYS.TRANSACTIONS));
  }

  function availableInWallet(wallet, options) {
    options = options || {};
    const bal = currentWallets();
    let available = Number(bal[wallet]) || 0;
    if (options.excludeTxId) {
      const txs = getStorageData(KEYS.TRANSACTIONS);
      const old = txs.find((t) => t.id === options.excludeTxId);
      if (old) {
        if (old.type === 'expense' && (old.account || 'Cash') === wallet) {
          available += Number(old.amount) || 0;
        }
        if (old.type === 'transfer' && old.fromAccount === wallet) {
          available += Number(old.amount) || 0;
        }
      }
    }
    return available;
  }

  function exitEditMode() {
    suppressDirty = true;
    if (editingIdInput) editingIdInput.value = '';
    if (formTitle) formTitle.textContent = 'Add Transaction';
    if (submitBtn) submitBtn.textContent = 'Record Transaction';
    if (cancelEditBtn) cancelEditBtn.style.display = 'none';
    if (form) form.reset();
    if (typeSelect) typeSelect.value = 'expense';
    if (accountSelect) accountSelect.value = 'Cash';
    setCategoryOptions('expense');
    suppressDirty = false;
    clearDirty();
  }

  function startEdit(txId) {
    const transactions = getStorageData(KEYS.TRANSACTIONS);
    const tx = transactions.find((t) => t.id === txId);
    if (!tx || tx.type === 'transfer') return;

    suppressDirty = true;
    if (editingIdInput) editingIdInput.value = String(tx.id);
    if (formTitle) formTitle.textContent = 'Edit Transaction';
    if (submitBtn) submitBtn.textContent = 'Update Transaction';
    if (cancelEditBtn) cancelEditBtn.style.display = 'inline-block';

    if (typeSelect) typeSelect.value = tx.type === 'income' ? 'income' : 'expense';
    setCategoryOptions(typeSelect.value);
    if (accountSelect) accountSelect.value = WALLETS.includes(tx.account) ? tx.account : 'Cash';
    if (categorySelect && tx.type !== 'income') {
      if (!Array.from(categorySelect.options).some((o) => o.value === tx.category)) {
        const opt = document.createElement('option');
        opt.value = tx.category;
        opt.textContent = tx.category;
        categorySelect.appendChild(opt);
      }
      categorySelect.value = tx.category || 'Other';
    }
    if (amountInput) {
      amountInput.value = Number(tx.amount).toLocaleString('en-LK', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      });
    }
    if (descInput) descInput.value = tx.description || '';
    toggleBillQuestion();
    suppressDirty = false;
    clearDirty();

    if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', () => {
      if (formDirty && !confirm('Discard changes to this transaction?')) return;
      exitEditMode();
    });
  }

  function renderDashboard() {
    const transactions = getStorageData(KEYS.TRANSACTIONS);
    let incomeSum = 0;
    let expenseSum = 0;

    transactions.forEach((tx) => {
      if (tx.type === 'income') incomeSum += Number(tx.amount) || 0;
      else if (tx.type === 'expense') expenseSum += Number(tx.amount) || 0;
    });

    if (totalIncomeEl) totalIncomeEl.textContent = formatMoney(incomeSum);
    if (totalExpenseEl) totalExpenseEl.textContent = formatMoney(expenseSum);
    if (totalBalanceEl) totalBalanceEl.textContent = formatMoney(incomeSum - expenseSum);

    const wallets = computeWalletBalances(transactions);
    if (walletCashEl) walletCashEl.textContent = formatMoney(wallets.Cash);
    if (walletBankEl) walletBankEl.textContent = formatMoney(wallets.Bank);
    if (walletCardEl) walletCardEl.textContent = formatMoney(wallets.Card);

    const walletSum = (wallets.Cash || 0) + (wallets.Bank || 0) + (wallets.Card || 0);
    const netBalance = incomeSum - expenseSum;
    const sumEl = document.getElementById('wallet-sum-check');
    if (sumEl) {
      const ok = Math.abs(walletSum - netBalance) < 0.005;
      sumEl.textContent = ok
        ? '✓ Wallets total ' + formatMoney(walletSum) + ' = Balance'
        : '⚠ Wallets ' + formatMoney(walletSum) + ' vs Balance ' + formatMoney(netBalance);
      sumEl.style.color = ok ? 'var(--success)' : 'var(--danger)';
    }

    if (!txListEl) return;
    txListEl.innerHTML = '';

    const newestFirst = transactions.slice().reverse();
    const total = newestFirst.length;
    const totalPages = Math.max(1, Math.ceil(total / TX_PAGE_SIZE));
    if (txPage > totalPages) txPage = totalPages;
    if (txPage < 1) txPage = 1;

    const start = (txPage - 1) * TX_PAGE_SIZE;
    const pageItems = newestFirst.slice(start, start + TX_PAGE_SIZE);

    if (total === 0) {
      txListEl.innerHTML =
        '<li style="color:var(--text-muted); padding:0.75rem 0;">No recent transactions found.</li>';
      if (txPagination) txPagination.style.display = 'none';
    } else {
      pageItems.forEach((tx) => {
        const li = document.createElement('li');
        li.style.padding = '0.75rem 0';
        li.style.borderBottom = '1px solid var(--border-color)';

        if (tx.type === 'transfer') {
          li.innerHTML =
            '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">' +
            '<div><strong>Transfer</strong>' +
            '<small style="color:var(--text-muted);"> (' +
            escapeHtml(tx.fromAccount) +
            ' → ' +
            escapeHtml(tx.toAccount) +
            ')</small><br>' +
            '<small style="color:var(--text-muted);">' +
            escapeHtml(tx.description || '') +
            ' · ' +
            escapeHtml(tx.date) +
            '</small></div>' +
            '<div style="display:flex; align-items:center; gap:0.75rem;">' +
            '<span style="color:var(--primary-color); font-weight:bold;">' +
            formatMoney(tx.amount) +
            '</span>' +
            '<button type="button" data-del-tx="' +
            tx.id +
            '" style="background:#ef4444; color:white; border:none; padding:0.3rem 0.6rem; border-radius:5px; cursor:pointer; font-size:0.8rem;">Delete</button>' +
            '</div></div>';
        } else {
          const color = tx.type === 'expense' ? 'var(--danger)' : 'var(--success)';
          const acc = tx.account || 'Cash';
          li.innerHTML =
            '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">' +
            '<div><strong>' +
            escapeHtml(tx.description) +
            '</strong>' +
            '<small style="color:var(--text-muted);"> (' +
            escapeHtml(tx.category) +
            ' · ' +
            escapeHtml(acc) +
            ')</small><br>' +
            '<small style="color:var(--text-muted);">' +
            escapeHtml(tx.date) +
            '</small></div>' +
            '<div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">' +
            '<span style="color:' +
            color +
            '; font-weight:bold;">' +
            (tx.type === 'expense' ? '-' : '+') +
            formatMoney(tx.amount) +
            '</span>' +
            '<button type="button" data-edit-tx="' +
            tx.id +
            '" style="background:var(--bg-color); color:var(--text-color); border:1px solid var(--border-color); padding:0.3rem 0.6rem; border-radius:5px; cursor:pointer; font-size:0.8rem;">Edit</button>' +
            '<button type="button" data-del-tx="' +
            tx.id +
            '" style="background:#ef4444; color:white; border:none; padding:0.3rem 0.6rem; border-radius:5px; cursor:pointer; font-size:0.8rem;">Delete</button>' +
            '</div></div>';
        }
        txListEl.appendChild(li);
      });

      if (txPagination) {
        if (totalPages <= 1) {
          txPagination.style.display = 'none';
        } else {
          txPagination.style.display = 'flex';
          const from = start + 1;
          const to = start + pageItems.length;
          if (txPageInfo) {
            txPageInfo.textContent =
              'Page ' + txPage + ' of ' + totalPages + ' · showing ' + from + '–' + to + ' of ' + total;
          }
          if (txPagePrev) txPagePrev.disabled = txPage <= 1;
          if (txPageNext) txPageNext.disabled = txPage >= totalPages;
        }
      }
    }

    txListEl.querySelectorAll('[data-edit-tx]').forEach((btn) => {
      btn.addEventListener('click', () => startEdit(Number(btn.getAttribute('data-edit-tx'))));
    });
    txListEl.querySelectorAll('[data-del-tx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-del-tx'));
        const list = getStorageData(KEYS.TRANSACTIONS);
        const targetTx = list.find((tx) => tx.id === id);
        if (!targetTx) return;
        const label =
          targetTx.type === 'transfer'
            ? 'Transfer ' + targetTx.fromAccount + ' → ' + targetTx.toAccount + ' — ' + formatMoney(targetTx.amount)
            : '"' + targetTx.description + '" — ' + formatMoney(targetTx.amount);
        if (!confirm('Delete this transaction?\n\n' + label)) return;
        syncSavingsOnTxDelete(targetTx);
        setStorageData(
          KEYS.TRANSACTIONS,
          list.filter((tx) => tx.id !== id)
        );
        if (editingIdInput && editingIdInput.value === String(id)) exitEditMode();
        renderDashboard();
      });
    });
  }

  if (txPagePrev) {
    txPagePrev.addEventListener('click', () => {
      if (txPage > 1) {
        txPage -= 1;
        renderDashboard();
      }
    });
  }
  if (txPageNext) {
    txPageNext.addEventListener('click', () => {
      txPage += 1;
      renderDashboard();
    });
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const type = typeSelect ? typeSelect.value : 'expense';
      const category =
        type === 'income' ? 'Income' : categorySelect ? categorySelect.value : 'Other';
      const account = accountSelect && WALLETS.includes(accountSelect.value) ? accountSelect.value : 'Cash';
      const amount = parseRawNumber(document.getElementById('amount').value);
      const description = document.getElementById('description').value.trim();
      const editingId = editingIdInput ? Number(editingIdInput.value) : 0;

      if (!description || isNaN(amount) || amount <= 0) {
        alert('Please enter a valid amount and description.');
        return;
      }

      if (type === 'expense') {
        const available = availableInWallet(account, { excludeTxId: editingId || null });
        if (amount > available + 1e-9) {
          alert(
            'Not enough money in ' +
              account +
              '.\n\nAvailable: ' +
              formatMoney(Math.max(0, available)) +
              '\nYou tried to spend: ' +
              formatMoney(amount)
          );
          return;
        }
      }

      const transactions = getStorageData(KEYS.TRANSACTIONS);

      if (editingId) {
        const idx = transactions.findIndex((t) => t.id === editingId);
        if (idx < 0) {
          alert('Transaction not found.');
          exitEditMode();
          return;
        }
        if (transactions[idx].type === 'transfer') {
          alert('Transfers cannot be edited here. Delete and create a new transfer.');
          return;
        }
        const oldTx = Object.assign({}, transactions[idx]);
        const updated = Object.assign({}, transactions[idx], {
          type: type,
          category: category,
          account: account,
          amount: amount,
          description: description
        });
        if (
          (oldTx.category === 'Savings Deposit' ||
            (oldTx.description && String(oldTx.description).startsWith('Daily Savings contribution for: '))) &&
          updated.category === 'Savings Deposit' &&
          updated.type === 'expense'
        ) {
          const goals = getStorageData(KEYS.SAVINGS_GOALS);
          const gi = findGoalIndexForTx(goals, oldTx);
          if (gi >= 0) {
            const goal = goals[gi];
            const others = (goal.contributions || [])
              .filter((c) => c.id !== oldTx.id)
              .reduce((s, c) => s + (Number(c.amount) || 0), 0);
            if (others + amount > goal.target) {
              alert(
                'This deposit is linked to savings goal "' +
                  goal.name +
                  '".\nMax allowed for this entry: ' +
                  formatMoney(Math.max(0, goal.target - others))
              );
              return;
            }
          }
        }
        syncSavingsOnTxUpdate(oldTx, updated);
        transactions[idx] = updated;
        setStorageData(KEYS.TRANSACTIONS, transactions);
        showInAppToast('Transaction updated');
        exitEditMode();
        renderDashboard();
        return;
      }

      transactions.push({
        id: Date.now(),
        type: type,
        category: category,
        account: account,
        amount: amount,
        description: description,
        date: new Date().toISOString().slice(0, 10)
      });
      setStorageData(KEYS.TRANSACTIONS, transactions);

      if (type === 'expense' && category === 'Bills') {
        const yes = document.getElementById('bill-monthly-yes');
        if (yes && yes.checked) {
          const today = new Date();
          const y = today.getFullYear();
          const m = String(today.getMonth() + 1).padStart(2, '0');
          const d = String(today.getDate()).padStart(2, '0');
          const todayStr = y + '-' + m + '-' + d;
          addCalendarEvent({
            id: Date.now() + 1,
            title: description,
            date: todayStr,
            time: '09:00',
            remindMinutes: 0,
            description: 'Bill paid (' + formatMoney(amount) + ')',
            amount: amount,
            type: 'bill',
            recurring: false
          });
          showInAppToast('Bill also added to Calendar for today');
        }
      }

      txPage = 1;
      exitEditMode();
      renderDashboard();
    });
  }

  if (transferForm) {
    transferForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const from = document.getElementById('transfer-from').value;
      const to = document.getElementById('transfer-to').value;
      const amount = parseRawNumber(document.getElementById('transfer-amount').value);
      const note = (document.getElementById('transfer-note').value || '').trim();

      if (!WALLETS.includes(from) || !WALLETS.includes(to)) {
        alert('Choose valid wallets.');
        return;
      }
      if (from === to) {
        alert('From and To must be different wallets.');
        return;
      }
      if (isNaN(amount) || amount <= 0) {
        alert('Enter a valid transfer amount.');
        return;
      }

      const available = availableInWallet(from);
      if (amount > available + 1e-9) {
        alert(
          'Not enough money in ' +
            from +
            ' to transfer.\n\nAvailable: ' +
            formatMoney(Math.max(0, available)) +
            '\nYou tried to transfer: ' +
            formatMoney(amount)
        );
        return;
      }

      const transactions = getStorageData(KEYS.TRANSACTIONS);
      transactions.push({
        id: Date.now(),
        type: 'transfer',
        fromAccount: from,
        toAccount: to,
        amount: amount,
        description: note || 'Transfer ' + from + ' → ' + to,
        category: 'Transfer',
        date: new Date().toISOString().slice(0, 10)
      });
      setStorageData(KEYS.TRANSACTIONS, transactions);
      transferForm.reset();
      document.getElementById('transfer-from').value = 'Cash';
      document.getElementById('transfer-to').value = 'Bank';
      clearDirty();
      txPage = 1;
      showInAppToast('Transferred ' + formatMoney(amount) + ' from ' + from + ' to ' + to);
      renderDashboard();
    });
  }

  renderDashboard();

  const profile = getUserProfile();
  const name = (profile && (profile.fullname || profile.username)) || '';
  showInAppToast(getTimeGreeting(name) + ' Ready to track your money.');
});
