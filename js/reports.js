onAppReady(() => {
  const incomeEl = document.getElementById('report-income');
  const expenseEl = document.getElementById('report-expense');
  const archiveList = document.getElementById('archive-list');
  const alertBox = document.getElementById('auto-save-alert');

  const transactions = getStorageData(KEYS.TRANSACTIONS);
  const archives = getStorageData(KEYS.MONTHLY_REPORTS);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const formatRs = (amount) => formatMoney(amount);

  function parseTxDate(str) {
    if (!str) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      const d = new Date(str + (str.length === 10 ? 'T00:00:00' : ''));
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  // 1. Current month totals (skip transfers)
  let currentMonthIncome = 0;
  let currentMonthExpense = 0;
  const categoryTotals = {};

  transactions.forEach((tx) => {
    if (tx.type === 'transfer') return;
    const txDate = parseTxDate(tx.date);
    if (!txDate) return;
    if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
      if (tx.type === 'income') {
        currentMonthIncome += Number(tx.amount) || 0;
      } else if (tx.type === 'expense') {
        currentMonthExpense += Number(tx.amount) || 0;
        categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + (Number(tx.amount) || 0);
      }
    }
  });

  if (incomeEl) incomeEl.textContent = formatRs(currentMonthIncome);
  if (expenseEl) expenseEl.textContent = formatRs(currentMonthExpense);

  // 2. Doughnut
  if (document.getElementById('categoryChart') && typeof Chart !== 'undefined') {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    const categories = Object.keys(categoryTotals);
    const amounts = Object.values(categoryTotals);

    if (categories.length > 0) {
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: categories,
          datasets: [{
            data: amounts,
            backgroundColor: ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899']
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom' },
            title: { display: true, text: 'Current Expenses by Category' },
            tooltip: {
              callbacks: {
                label: function (context) {
                  const label = context.label || '';
                  const value = formatRs(context.parsed);
                  return `${label}: ${value}`;
                }
              }
            }
          }
        }
      });
    }
  }

  // 3. Last 6 months income vs expense line chart
  function buildLast6MonthsTrend() {
    const labels = [];
    const incomeData = [];
    const expenseData = [];
    const buckets = {};

    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      const label = d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
      labels.push(label);
      buckets[key] = { income: 0, expense: 0, label };
    }

    transactions.forEach((tx) => {
      if (tx.type === 'transfer') return;
      const txDate = parseTxDate(tx.date);
      if (!txDate) return;
      const key = txDate.getFullYear() + '-' + String(txDate.getMonth() + 1).padStart(2, '0');
      if (!buckets[key]) return;
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'income') buckets[key].income += amt;
      else if (tx.type === 'expense') buckets[key].expense += amt;
    });

    Object.keys(buckets)
      .sort()
      .forEach((key) => {
        // labels already in order from loop; push data in same 6-month order
      });

    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      incomeData.push(buckets[key].income);
      expenseData.push(buckets[key].expense);
    }

    return { labels, incomeData, expenseData };
  }

  const trendCanvas = document.getElementById('trendChart');
  const trendEmpty = document.getElementById('trend-empty');
  if (trendCanvas && typeof Chart !== 'undefined') {
    const { labels, incomeData, expenseData } = buildLast6MonthsTrend();
    const hasData = incomeData.some((n) => n > 0) || expenseData.some((n) => n > 0);
    if (!hasData && trendEmpty) {
      trendEmpty.style.display = 'block';
    } else {
      if (trendEmpty) trendEmpty.style.display = 'none';
      new Chart(trendCanvas.getContext('2d'), {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Income',
              data: incomeData,
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              tension: 0.3,
              fill: true,
              pointRadius: 4
            },
            {
              label: 'Expenses',
              data: expenseData,
              borderColor: '#ef4444',
              backgroundColor: 'rgba(239, 68, 68, 0.10)',
              tension: 0.3,
              fill: true,
              pointRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  return (ctx.dataset.label || '') + ': ' + formatRs(ctx.parsed.y);
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: function (v) {
                  return formatRs(v);
                }
              }
            }
          }
        }
      });
    }
  }

  // 4. Auto-archive past months
  function archivePassedMonths() {
    const pastTxByMonth = {};

    transactions.forEach((tx) => {
      if (tx.type === 'transfer') return;
      const txDate = parseTxDate(tx.date);
      if (!txDate) return;
      if (
        txDate.getFullYear() < currentYear ||
        (txDate.getFullYear() === currentYear && txDate.getMonth() < currentMonth)
      ) {
        const monthKey = txDate.toLocaleDateString('default', { month: 'long', year: 'numeric' });

        if (!pastTxByMonth[monthKey]) {
          pastTxByMonth[monthKey] = { income: 0, expense: 0, items: [] };
        }

        if (tx.type === 'income') pastTxByMonth[monthKey].income += Number(tx.amount) || 0;
        if (tx.type === 'expense') pastTxByMonth[monthKey].expense += Number(tx.amount) || 0;
        pastTxByMonth[monthKey].items.push(tx);
      }
    });

    let newArchiveAdded = false;

    Object.keys(pastTxByMonth).forEach((monthKey) => {
      const alreadyArchived = archives.some((r) => r.monthYear === monthKey);
      if (!alreadyArchived) {
        archives.push({
          id: Date.now() + Math.floor(Math.random() * 1000),
          monthYear: monthKey,
          income: pastTxByMonth[monthKey].income,
          expense: pastTxByMonth[monthKey].expense,
          items: pastTxByMonth[monthKey].items,
          savedAt: new Date().toLocaleDateString()
        });
        newArchiveAdded = true;
      }
    });

    if (newArchiveAdded) {
      setStorageData(KEYS.MONTHLY_REPORTS, archives);
      if (alertBox) {
        alertBox.textContent = `🎉 Previous month report saved with full transaction details!`;
        alertBox.style.display = 'block';
      }
    }
  }

  function renderArchives() {
    archiveList.innerHTML = '';
    const updatedArchives = getStorageData(KEYS.MONTHLY_REPORTS);

    if (updatedArchives.length === 0) {
      archiveList.innerHTML = '<li>No saved monthly report files found.</li>';
      return;
    }

    updatedArchives
      .slice()
      .reverse()
      .forEach((report) => {
        const li = document.createElement('li');
        li.style.padding = '1rem';
        li.style.marginBottom = '0.75rem';
        li.style.border = '1px solid var(--border-color)';
        li.style.borderRadius = '8px';
        li.style.cursor = 'pointer';

        li.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <strong>📅 ${report.monthYear}</strong><br>
            <span style="color:var(--success)">Income: ${formatRs(report.income)}</span> | 
            <span style="color:var(--danger)">Expenses: ${formatRs(report.expense)}</span>
          </div>
          <span style="color:var(--primary-color); font-weight:bold;">View Details ➔</span>
        </div>
      `;

        li.addEventListener('click', () => {
          window.location.href = `report-detail.html?id=${report.id}`;
        });

        archiveList.appendChild(li);
      });
  }

  archivePassedMonths();
  renderArchives();
});
