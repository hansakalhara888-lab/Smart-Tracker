onAppReady(() =>  {
    const escapeHtml = (value) => String(value || '') .replace(/&/g, '&amp;') .replace(/</g, '&lt;') .replace(/>/g, '&gt;') .replace(/"/g, '&quot;');
    function getDashboardPreferences() {
        const raw = getStorageData(KEYS.DASHBOARD_PREFS);
        const defaults = defaultDashboardPreferences();
        if (!raw || Array.isArray(raw) || typeof raw !== 'object') return defaults;
        return {
            cards: Object.assign({}, defaults.cards, raw.cards || {}),
            sections: Object.assign({}, defaults.sections, raw.sections || {}),
            charts: Object.assign({}, defaults.charts, raw.charts || {})
        };
    }
    function applyDashboardPreferences() {
        const prefs = getDashboardPreferences();
        document.querySelectorAll('[data-dashboard-card]').forEach((el) => {
            el.style.display = prefs.cards[el.dataset.dashboardCard] === false ? 'none' : '';
        });
        document.querySelectorAll('[data-dashboard-section]').forEach((el) => {
            const key = el.dataset.dashboardSection;
            if (key === 'summary' || key === 'charts') return;
            el.style.display = prefs.sections[key] === false ? 'none' : '';
        });
        let visibleCharts = 0;
        document.querySelectorAll('[data-dashboard-chart]').forEach((el) => {
            const visible = prefs.charts[el.dataset.dashboardChart] !== false;
            el.style.display = visible ? '' : 'none';
            if (visible) visibleCharts += 1;
        });
        const chartSection = document.querySelector('[data-dashboard-section="charts"]');
        if (chartSection) chartSection.style.display = visibleCharts ? '' : 'none';
        requestAnimationFrame(() => {
            if (window._smartCharts) Object.values(window._smartCharts).forEach((chart) => { try { chart.resize(); } catch (_) {} });
        });
    }
    function setupDashboardCustomization() {
        const openBtn = document.getElementById('dashboard-customize-btn');
        const modal = document.getElementById('dashboard-customize-modal');
        if (!openBtn || !modal) return;
        const closeBtn = document.getElementById('dashboard-customize-close');
        const saveBtn = document.getElementById('dashboard-customize-save');
        const resetBtn = document.getElementById('dashboard-customize-reset');
        function fill(prefs) {
            modal.querySelectorAll('[data-pref-card]').forEach((el) => { el.checked = prefs.cards[el.dataset.prefCard] !== false; });
            modal.querySelectorAll('[data-pref-section]').forEach((el) => { el.checked = prefs.sections[el.dataset.prefSection] !== false; });
            modal.querySelectorAll('[data-pref-chart]').forEach((el) => { el.checked = prefs.charts[el.dataset.prefChart] !== false; });
        }
        function open() { fill(getDashboardPreferences()); modal.classList.add('open'); modal.setAttribute('aria-hidden','false'); }
        function close() { modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); }
        openBtn.addEventListener('click', open);
        closeBtn.addEventListener('click', close);
        modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
        saveBtn.addEventListener('click', () => {
            const prefs = defaultDashboardPreferences();
            modal.querySelectorAll('[data-pref-card]').forEach((el) => { prefs.cards[el.dataset.prefCard] = el.checked; });
            modal.querySelectorAll('[data-pref-section]').forEach((el) => { prefs.sections[el.dataset.prefSection] = el.checked; });
            modal.querySelectorAll('[data-pref-chart]').forEach((el) => { prefs.charts[el.dataset.prefChart] = el.checked; });
            setStorageData(KEYS.DASHBOARD_PREFS, prefs);
            applyDashboardPreferences();
            close();
            showInAppToast('Dashboard preferences saved');
        });
        resetBtn.addEventListener('click', () => fill(defaultDashboardPreferences()));
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('open')) close(); });
    }
    function renderWelcomeMessage()  {
        const profile = getUserProfile() || {};
        const user = (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser : null;
        const fullName = String(profile.fullname || (user && user.displayName) || profile.username || '').trim();
        const fallback = user && user.email ? user.email.split('@')[0] : 'there';
        const displayName = fullName || fallback;
        const firstName = displayName.split(/\s+/)[0] || displayName;
        const greetingEl = document.getElementById('dashboard-welcome-greeting');
        const nameEl = document.getElementById('dashboard-welcome-name');
        if (greetingEl) greetingEl.textContent = getTimeGreeting(firstName);
        if (nameEl) nameEl.textContent = `Welcome back to SmartTracker, ${firstName}`;
    }
    function renderDashboard()  {
        const transactions = getStorageData(KEYS.TRANSACTIONS);
        const current = transactions.filter((tx) => monthKeyFromDate(tx.date) === currentMonthKey());
        const income = current
            .filter((tx) => tx.type === 'income')
            .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

        const savings = current
            .filter((tx) => isSavingsDeposit(tx))
            .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

        const expenses = current
            .filter((tx) => tx.type === 'expense' && !isSavingsDeposit(tx))
            .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
        const opening = totalNetBeforeMonth(currentMonthKey(), transactions) + getWallets().reduce((sum, wallet) => sum + (Number(wallet.openingBalance) || 0), 0);
        const wallets = computeWalletBalances(transactions);
        const walletTotal = Object.values(wallets).reduce((sum, value) => sum + (Number(value) || 0), 0);
        const setMoney = (id, value) =>  {
            const el = document.getElementById(id);
            if (el) el.textContent = formatMoney(value);
        };
        setMoney('total-balance', walletTotal);
        setMoney('opening-balance', opening);
        setMoney('total-income', income);
        setMoney('total-expense', expenses);
        setMoney('total-savings', savings);
        setMoney('wallet-cash', wallets.Cash || 0);
        setMoney('wallet-bank', wallets.Bank || 0);
        setMoney('wallet-card', wallets.Card || 0);
        const custom = document.getElementById('custom-wallet-cards');
        if (custom)  {
            custom.innerHTML = getWallets() .filter((wallet) => !SMART_WALLETS.includes(wallet.name)) .map((wallet) => `<div class="wallet-mini"><small>${wallet.icon} ${escapeHtml(wallet.name)}</small><h3>${formatMoney(wallets[wallet.name] || 0)}</h3></div>`) .join('');
        }
        const check = document.getElementById('wallet-sum-check');
        if (check)  {
            const expected = opening + income - expenses - savings;
            const ok = Math.abs(walletTotal - expected) < 0.005;
            check.textContent = ok ? `✓ Wallets total ${formatMoney(walletTotal)} = Balance` : `⚠ Wallets ${formatMoney(walletTotal)} vs Balance ${formatMoney(expected)}`;
            check.style.color = ok ? 'var(--success)' : 'var(--danger)';
        }
        const health = calculateFinancialHealth();
        const score = document.getElementById('financial-score');
        const label = document.getElementById('financial-label');
        const insights = document.getElementById('financial-insights');
        const net = document.getElementById('month-net');
        if (score) score.textContent = `${health.score}/100`;
        if (label)  {
            label.textContent = health.label;
            label.className = `badge ${health.score >= 70 ? 'success' : health.score >= 50 ? 'warn' : 'danger'}`;
        }
        if (insights) insights.innerHTML = health.insights.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
        if (net) net.textContent = formatMoney(income - expenses - savings);
        renderCharts(transactions, current);
    }
    function renderCharts(transactions, current)  {
        if (typeof Chart === 'undefined') return;
        window._smartCharts = window._smartCharts ||  {
        };
        Object.values(window._smartCharts).forEach((chart) =>  {
            try  {
                chart.destroy();
            } catch (_)  {
            }
        });
        window._smartCharts =  {
        };
        const create = (id, type, data, options =  {
        }) =>  {
            const canvas = document.getElementById(id);
            if (!canvas) return;
            window._smartCharts[id] = new Chart(canvas.getContext('2d'),  {
                type, data, options: Object.assign({
                    responsive: true, maintainAspectRatio: false, plugins:  {
                        legend:  {
                            position: 'bottom'
                        }
                    }
                }, options)
            });
        };
        const totals = getMonthTotals(currentMonthKey());
        create('dash-income-expense-chart', 'bar',  {
            labels: ['Income', 'Expenses', 'Savings'], datasets: [{
                label: 'This month', data: [totals.income, totals.expense, totals.savings]
            }]
        });
        const categories =  {
        };
        current.filter((tx) => tx.type === 'expense' && !isSavingsDeposit(tx)).forEach((tx) =>  {
            const key = tx.category || 'Other';
            categories[key] = (categories[key] || 0) + (Number(tx.amount) || 0);
        });
        create('dash-category-chart', 'doughnut',  {
            labels: Object.keys(categories), datasets: [{
                data: Object.values(categories)
            }]
        });
        const walletBalances = computeWalletBalances(transactions);
        create('dash-wallet-chart', 'doughnut',  {
            labels: Object.keys(walletBalances), datasets: [{
                data: Object.values(walletBalances).map((value) => Math.max(0, value))
            }]
        });
        const goals = getStorageData(KEYS.SAVINGS_GOALS);
        create('dash-savings-chart', 'bar',  {
            labels: goals.map((goal) => goal.name), datasets: [{
                label: 'Saved', data: goals.map((goal) => Number(goal.saved) || 0)
            },  {
                label: 'Target', data: goals.map((goal) => Number(goal.target) || 0)
            }]
        });
        const labels = [];
        const values = [];
        for (let i = 5; i >= 0; i -= 1)  {
            const date = new Date();
            date.setDate(1);
            date.setMonth(date.getMonth() - i);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            labels.push(date.toLocaleDateString(undefined,  {
                month: 'short'
            }));
            values.push(getMonthTotals(key).closing);
        }
        create('dash-balance-chart', 'line',  {
            labels, datasets: [{
                label: 'Closing balance', data: values, tension: 0.25
            }]
        });
    }
    setupDashboardCustomization();
    applyDashboardPreferences();
    renderWelcomeMessage();
    renderDashboard();
    applyDashboardPreferences();
});
