onAppReady(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const reportId = parseInt(urlParams.get('id'), 10);

  const titleEl = document.getElementById('report-title');
  const metaEl = document.getElementById('report-meta');
  const incomeEl = document.getElementById('detail-income');
  const expenseEl = document.getElementById('detail-expense');
  const balanceEl = document.getElementById('detail-balance');
  const countEl = document.getElementById('detail-count');
  const txListEl = document.getElementById('detail-tx-list');
  const catBody = document.getElementById('category-table-body');
  const chartEmpty = document.getElementById('chart-empty');

  const archives = getStorageData(KEYS.MONTHLY_REPORTS);
  const report = archives.find((r) => r.id === reportId);

  const formatRs = (amount) => formatMoney(amount);
  const CHART_COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

  if (!report) {
    if (titleEl) titleEl.textContent = 'Report not found';
    if (metaEl) metaEl.textContent = 'This archive may have been removed. Go back to Reports and open another month.';
    if (txListEl) {
      txListEl.innerHTML = '<li class="tx-empty">No report data available.</li>';
    }
    return;
  }

  const income = Number(report.income) || 0;
  const expense = Number(report.expense) || 0;
  const balance = income - expense;
  const items = Array.isArray(report.items) ? report.items : [];

  titleEl.textContent = report.monthYear || 'Monthly report';
  metaEl.textContent =
    (report.savedAt ? 'Archived on ' + report.savedAt + ' · ' : '') +
    items.length +
    ' transaction' +
    (items.length === 1 ? '' : 's');

  incomeEl.textContent = formatRs(income);
  expenseEl.textContent = formatRs(expense);
  balanceEl.textContent = formatRs(balance);
  balanceEl.style.color = balance >= 0 ? 'var(--success)' : 'var(--danger)';
  countEl.textContent = String(items.length);

  // Category totals (expenses only)
  const categoryTotals = {};
  items.forEach((tx) => {
    if (tx.type === 'expense') {
      const cat = tx.category || 'Other';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(tx.amount) || 0);
    }
  });

  const categories = Object.keys(categoryTotals).sort(
    (a, b) => categoryTotals[b] - categoryTotals[a]
  );
  const amounts = categories.map((c) => categoryTotals[c]);
  const expenseTotal = amounts.reduce((s, n) => s + n, 0) || 1;

  // Category table
  if (!categories.length) {
    catBody.innerHTML =
      '<tr><td colspan="3" style="color:var(--text-muted);">No expenses in this month.</td></tr>';
  } else {
    catBody.innerHTML = categories
      .map((cat, i) => {
        const amt = categoryTotals[cat];
        const pct = ((amt / expenseTotal) * 100).toFixed(1);
        const color = CHART_COLORS[i % CHART_COLORS.length];
        return (
          '<tr>' +
          '<td><span class="cat-dot" style="background:' +
          color +
          '"></span>' +
          cat +
          '</td>' +
          '<td>' +
          formatRs(amt) +
          '</td>' +
          '<td>' +
          pct +
          '%</td>' +
          '</tr>'
        );
      })
      .join('');
  }

  // Chart
  const canvas = document.getElementById('detailCategoryChart');
  if (canvas && typeof Chart !== 'undefined') {
    if (categories.length > 0) {
      if (chartEmpty) chartEmpty.style.display = 'none';
      new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: categories,
          datasets: [
            {
              data: amounts,
              backgroundColor: categories.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
              borderWidth: 0,
              hoverOffset: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  const val = ctx.parsed || 0;
                  const pct = ((val / expenseTotal) * 100).toFixed(1);
                  return ctx.label + ': ' + formatRs(val) + ' (' + pct + '%)';
                }
              }
            }
          },
          cutout: '58%'
        }
      });
    } else {
      if (chartEmpty) chartEmpty.style.display = 'block';
    }
  }

  // Transactions
  let activeFilter = 'all';

  function renderTxList() {
    txListEl.innerHTML = '';
    const filtered = items.filter((tx) => {
      if (activeFilter === 'all') return true;
      return tx.type === activeFilter;
    });

    if (!filtered.length) {
      txListEl.innerHTML =
        '<li class="tx-empty">No ' +
        (activeFilter === 'all' ? '' : activeFilter + ' ') +
        'transactions in this report.</li>';
      return;
    }

    // Newest first if date sortable, else keep order
    const sorted = filtered.slice().reverse();

    sorted.forEach((tx) => {
      const li = document.createElement('li');
      li.className = 'tx-row ' + (tx.type === 'expense' ? 'is-expense' : 'is-income');
      const color = tx.type === 'expense' ? 'var(--danger)' : 'var(--success)';
      const sign = tx.type === 'expense' ? '-' : '+';
      li.innerHTML =
        '<div class="tx-main">' +
        '<div class="tx-title">' +
        (tx.description || 'Transaction') +
        '</div>' +
        '<div class="tx-sub">' +
        '<span class="tx-badge">' +
        (tx.category || '') +
        '</span>' +
        '<span>' +
        (tx.date || '') +
        '</span>' +
        '</div>' +
        '</div>' +
        '<div class="tx-amount" style="color:' +
        color +
        '">' +
        sign +
        formatRs(tx.amount) +
        '</div>';
      txListEl.appendChild(li);
    });
  }

  document.querySelectorAll('#tx-filters .pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#tx-filters .pill').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter || 'all';
      renderTxList();
    });
  });

  renderTxList();

  const printBtn = document.getElementById('print-report-btn');
  if (printBtn) {
    printBtn.addEventListener('click', () => window.print());
  }
});
