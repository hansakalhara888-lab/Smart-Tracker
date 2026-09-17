onAppReady(() =>  {
    const form = document.getElementById('goal-form');
    const container = document.getElementById('goals-container');
    const targetPriceInput = document.getElementById('target-price');
    const goalTypeInput = document.getElementById('goal-type');
    const targetDateInput = document.getElementById('goal-target-date');
    const emergencyMonthsBox = document.getElementById('emergency-months-box');
    const emergencyMonthsInput = document.getElementById('emergency-months');
    if (goalTypeInput) goalTypeInput.addEventListener('change',()=> {
        if(emergencyMonthsBox) emergencyMonthsBox.style.display=goalTypeInput.value==='emergency'?'block':'none';
    });
    const formatRs = (amount) => formatMoney(amount);
    const parseRawNumber = (str) => parseFloat(str.toString().replace(/,/g, '')) || 0;
    function setupLiveCommaFormatting(inputEl)  {
        if (!inputEl) return;
        inputEl.type = 'text';
        inputEl.addEventListener('input', (e) =>  {
            let cursorPosition = e.target.selectionStart;
            let originalLength = e.target.value.length;
            let rawValue = e.target.value.replace(/[^0-9.]/g, '');
            if (!rawValue)  {
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
    if (!document.getElementById('goal-animation-style'))  {
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
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--primary-color);
        text-transform: uppercase;
        letter-spacing: 0.03em;
        border-top: 1px solid var(--border-color);
      }
      .contrib-month:first-child { border-top: none; }
      .contrib-week {
        padding: 0.35rem 0.75rem 0.2rem 1.25rem;
        font-size: 0.78rem;
        font-weight: 600;
        color: var(--text-muted);
        border-top: 1px solid var(--border-color);
        background: rgba(255, 255, 255, 0.02);
      }
      .contrib-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.4rem 0.75rem 0.4rem 1.75rem;
        font-size: 0.9rem;
        border-top: 1px solid var(--border-color);
      }
      .contrib-date { color: var(--text-muted); }
      .contrib-amount { font-weight: 600; color: var(--success); }
      .contrib-delete-btn {
        background: none;
        border: none;
        color: #ef4444;
        cursor: pointer;
        font-weight: bold;
        font-size: 0.95rem;
        padding: 2px 6px;
        border-radius: 4px;
        transition: background 0.2s ease;
      }
      .contrib-delete-btn:hover {
        background: rgba(239, 68, 68, 0.15);
      }
      .contrib-empty { padding: 0.75rem; color: var(--text-muted); font-size: 0.9rem; }
    `;
        document.head.appendChild(style);
    }
    setupLiveCommaFormatting(targetPriceInput);
    function todayISO()  {
        const t = new Date();
        return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
    }
    function parseFlexibleDate(str)  {
        if (!str) return null;
        if (/^\d{4}-\d{2}-\d{2}/.test(str))  {
            const d = new Date(str);
            return isNaN(d.getTime()) ? null : d;
        }
        const d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
    }
    function getWeekOfMonth(dateObj)  {
        return Math.ceil(dateObj.getDate() / 7);
    }
    function monthKey(dateObj)  {
        return dateObj.toLocaleDateString('en-US',  {
            month: 'long', year: 'numeric'
        }).toUpperCase();
    }
    function displayDate(dateObj)  {
        return dateObj.toLocaleDateString('en-US',  {
            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
        });
    }
    function ensureContributionHistory(goals)  {
        const transactions = getStorageData(KEYS.TRANSACTIONS);
        let changed = false;
        goals.forEach((goal) =>  {
            if (!Array.isArray(goal.contributions))  {
                goal.contributions = [];
                changed = true;
            }
            if (goal.contributions.length === 0 && Number(goal.saved) > 0)  {
                const related = transactions.filter( (tx) => tx.category === 'Savings Deposit' && (tx.description === 'Daily Savings contribution for: ' + goal.name || tx.description === 'Savings contribution for: ' + goal.name) );
                related.forEach((tx) =>  {
                    const d = parseFlexibleDate(tx.date) || new Date();
                    goal.contributions.push({
                        id: tx.id || Date.now() + Math.random(), amount: Number(tx.amount) || 0, dateISO: d.toISOString().slice(0, 10), dateLabel: tx.date
                    });
                });
                if (related.length) changed = true;
            }
        });
        if (changed) setStorageData(KEYS.SAVINGS_GOALS, goals);
        return goals;
    }
    function buildHistoryHtml(goal)  {
        const list = Array.isArray(goal.contributions) ? goal.contributions.slice() : [];
        if (!list.length)  {
            return '<div class="contrib-empty">No deposits recorded yet.</div>';
        }
        const items = list.map((c) => ({
            ...c, _d: c.date?.toDate ? c.date.toDate() : (parseFlexibleDate(c.dateISO || c.dateLabel) || new Date())
        }));
        items.sort((a, b) => b._d.getTime() - a._d.getTime());
        const hierarchy =  {
        };
        const monthOrder = [];
        items.forEach((c) =>  {
            const mKey = monthKey(c._d);
            const wKey = `Week ${getWeekOfMonth(c._d)}`;
            if (!hierarchy[mKey])  {
                hierarchy[mKey] =  {
                    _weeks:  {
                    }, _weekOrder: []
                };
                monthOrder.push(mKey);
            }
            if (!hierarchy[mKey]._weeks[wKey])  {
                hierarchy[mKey]._weeks[wKey] = [];
                hierarchy[mKey]._weekOrder.push(wKey);
            }
            hierarchy[mKey]._weeks[wKey].push(c);
        });
        let html = '';
        monthOrder.forEach((mKey) =>  {
            html += `<div class="contrib-month">${mKey}</div>`;
            hierarchy[mKey]._weekOrder.forEach((wKey) =>  {
                html += `<div class="contrib-week">${wKey}</div>`;
                hierarchy[mKey]._weeks[wKey].forEach((c) =>  {
                    html += `
            <div class="contrib-row">
              <span class="contrib-date">${displayDate(c._d)}</span>
              <div style="display:flex; align-items:center; gap:0.6rem;">
                <span class="contrib-amount">+ ${formatRs(c.amount)}</span>
                <button type="button" class="contrib-delete-btn" data-goal-id="${goal.id}" data-contrib-id="${c.id}" title="Delete this deposit">✕</button>
              </div>
            </div>`;
                });
            });
        });
        return html;
    }
    function renderGoals()  {
        let goals = getStorageData(KEYS.SAVINGS_GOALS);
        goals = ensureContributionHistory(goals);
        container.innerHTML = '';
        if (goals.length === 0)  {
            container.innerHTML = '<p>No savings targets set yet.</p>';
            return;
        }
        goals.forEach((goal) =>  {
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
            const targetDate = goal.targetDate ? parseFlexibleDate(goal.targetDate) : null;
            const now = new Date();
            const monthsLeft = targetDate ? Math.max(1, Math.ceil((targetDate.getTime()-now.getTime())/(1000*60*60*24*30.44))) : 0;
            const suggestedMonthly = monthsLeft ? remaining / monthsLeft : 0;
            const avgMonthly = (goal.contributions||[]).length ? (Number(goal.saved)||0) / Math.max(1, new Set((goal.contributions||[]).map(c=>String(c.dateISO||'').slice(0,7))).size) : 0;
            const estimatedMonths = avgMonthly>0 ? Math.ceil(remaining/avgMonthly) : 0;
            if (isCompleted) card.classList.add('goal-completed-card');
            card.innerHTML = '<div style="display:flex; justify-content:space-between; align-items:center;">' + '<h3 style="margin:0;">' + goal.name + (isCompleted ? ' 🎉 <span style="font-size:0.8rem; color:#10b981; font-weight:bold;">(Completed!)</span>' : '') + '</h3>' + '<button type="button" class="btn-del-goal" data-id="' + goal.id + '" style="background:#ef4444; color:white; border:none; padding:0.3rem 0.7rem; border-radius:5px; cursor:pointer; font-size:0.85rem;">Delete Target</button>' + '</div>' + '<p style="margin-top:0.5rem;">Saved: <strong>' + formatRs(goal.saved) + '</strong> / ' + formatRs(goal.target) + ' (' + progress + '%)</p>' + '<p style="color:var(--text-muted);font-size:.9rem">Remaining: <strong>'+formatRs(remaining)+'</strong>' + (goal.targetDate ? ' · Target: '+goal.targetDate : '') + (monthsLeft ? ' · Suggested/month: '+formatRs(suggestedMonthly) : '') + (estimatedMonths ? ' · Est. completion: ~'+estimatedMonths+' month(s)' : '') + '</p>' + '<div style="background:#e2e8f0; height:10px; border-radius:5px; margin: 0.5rem 0; overflow:hidden;">' + '<div style="background:var(--success); width:' + progress + '%; height:100%; transition: width 0.4s ease;"></div>' + '</div>' + '<div id="error-' + goal.id + '" style="color:#ef4444; font-size:0.85rem; font-weight:500; margin-bottom:0.5rem; display:none;"></div>' + (isCompleted ? '<div style="color:#10b981; font-weight:bold; font-size:0.9rem; margin-top:0.5rem;">✅ Target reached! No further deposits needed.</div>' : '<div class="savings-deposit-row">' + '<select id="deposit-wallet-' + goal.id + '" class="savings-wallet-select" aria-label="Wallet for savings deposit">' + getWallets().map(function(w) {
                return '<option value="'+w.name+'">'+w.icon+' '+w.name+'</option>';
            }).join('') + '</select>' + '<input type="text" id="deposit-' + goal.id + '" placeholder="Amount (Remaining: ' + formatRs(remaining) + ')" class="savings-deposit-input">' + '<button type="button" class="btn-save-today" data-id="' + goal.id + '">Save Today</button>' + '</div>') + '<button type="button" class="contrib-toggle" data-id="' + goal.id + '" aria-expanded="false">' + '<span>Contribution history (' + contribCount + ')</span><span class="chevron">▼</span>' + '</button>' + '<div class="contrib-panel" id="contrib-panel-' + goal.id + '">' + buildHistoryHtml(goal) + '</div>';
            container.appendChild(card);
            const depositInput = document.getElementById('deposit-' + goal.id);
            if (depositInput) setupLiveCommaFormatting(depositInput);
        });
        container.querySelectorAll('.contrib-toggle').forEach((btn) =>  {
            btn.addEventListener('click', () =>  {
                const id = btn.dataset.id;
                const panel = document.getElementById('contrib-panel-' + id);
                const open = panel.classList.toggle('open');
                btn.classList.toggle('open', open);
                btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            });
        });
        container.querySelectorAll('.btn-save-today').forEach((btn) =>  {
            btn.addEventListener('click', () => makeContribution(Number(btn.dataset.id)));
        });
        container.querySelectorAll('.btn-del-goal').forEach((btn) =>  {
            btn.addEventListener('click', () => deleteGoal(Number(btn.dataset.id)));
        });
        container.querySelectorAll('.contrib-delete-btn').forEach((btn) =>  {
            btn.addEventListener('click', (e) =>  {
                e.stopPropagation();
                deleteSingleContribution(Number(btn.dataset.goalId), Number(btn.dataset.contribId));
            });
        });
    }
    window.makeContribution = function (goalId)  {
        const amountInput = document.getElementById('deposit-' + goalId);
        const errorEl = document.getElementById('error-' + goalId);
        const depositVal = parseRawNumber(amountInput ? amountInput.value : '');
        const walletSelect = document.getElementById('deposit-wallet-' + goalId);
        const wallet = walletSelect && isKnownWallet(walletSelect.value) ? walletSelect.value : 'Cash';
        if (errorEl) errorEl.style.display = 'none';
        const goals = getStorageData(KEYS.SAVINGS_GOALS);
        const goal = goals.find((g) => g.id === goalId);
        if (!goal) return;
        if (!Array.isArray(goal.contributions)) goal.contributions = [];
        const remaining = goal.target - goal.saved;
        if (goal.saved >= goal.target)  {
            if (errorEl)  {
                errorEl.textContent = 'Target already completed! You cannot add more money.';
                errorEl.style.display = 'block';
            }
            return;
        }
        if (isNaN(depositVal) || depositVal <= 0)  {
            if (errorEl)  {
                errorEl.textContent = 'Please enter a valid amount.';
                errorEl.style.display = 'block';
            }
            return;
        }
        if (depositVal > remaining)  {
            if (errorEl)  {
                errorEl.textContent = 'You only need ' + formatRs(remaining) + ' to complete this item goal!';
                errorEl.style.display = 'block';
            }
            return;
        }
        const available = getWalletAvailable(wallet);
        if (depositVal > available + 1e-9)  {
            if (errorEl)  {
                errorEl.textContent = 'Not enough money in ' + wallet + '. Available: ' + formatRs(Math.max(0, available));
                errorEl.style.display = 'block';
            }
            return;
        }
        const iso = todayISO();
        const txId = Date.now();
        goal.saved += depositVal;
        goal.contributions.push({
            id: txId, amount: depositVal, dateISO: iso, dateLabel: new Date().toLocaleDateString()
        });
        setStorageData(KEYS.SAVINGS_GOALS, goals);
        const transactions = getStorageData(KEYS.TRANSACTIONS);
        transactions.push({
            id: txId, type: 'expense', category: 'Savings Deposit', account: wallet, amount: depositVal, description: 'Savings contribution for: ' + goal.name, date: iso
        });
        setStorageData(KEYS.TRANSACTIONS, transactions);
        renderGoals();
    };
    window.deleteSingleContribution = function (goalId, contribId)  {
        if (!confirm('Are you sure you want to delete this specific deposit?')) return;
        let goals = getStorageData(KEYS.SAVINGS_GOALS);
        let goal = goals.find((g) => g.id === goalId);
        if (!goal || !Array.isArray(goal.contributions)) return;
        const idx = goal.contributions.findIndex((c) => Number(c.id) === Number(contribId));
        if (idx === -1) return;
        const removedContrib = goal.contributions.splice(idx, 1)[0];
        goal.saved = Math.max(0, goal.saved - (Number(removedContrib.amount) || 0));
        setStorageData(KEYS.SAVINGS_GOALS, goals);
        let transactions = getStorageData(KEYS.TRANSACTIONS);
        transactions = transactions.filter((tx) => Number(tx.id) !== Number(contribId));
        setStorageData(KEYS.TRANSACTIONS, transactions);
        renderGoals();
    };
    window.deleteGoal = function (goalId)  {
        const goals = getStorageData(KEYS.SAVINGS_GOALS);
        const goalToDelete = goals.find((g) => g.id === goalId);
        if (!goalToDelete) return;
        if (!confirm('Are you sure you want to delete "' + goalToDelete.name + '" from your savings targets?\n\nThis will also remove all associated contribution transactions from your Dashboard.')) return;
        const contribIds = (goalToDelete.contributions || []).map((c) => Number(c.id));
        setStorageData(KEYS.SAVINGS_GOALS, goals.filter((g) => g.id !== goalId));
        const transactions = getStorageData(KEYS.TRANSACTIONS);
        setStorageData( KEYS.TRANSACTIONS, transactions.filter( (tx) => tx.description !== 'Daily Savings contribution for: ' + goalToDelete.name && tx.description !== 'Savings contribution for: ' + goalToDelete.name && !contribIds.includes(Number(tx.id)) ) );
        renderGoals();
    };
    form.addEventListener('submit', (e) =>  {
        e.preventDefault();
        const inputName = document.getElementById('item-name').value.trim();
        let targetPrice = parseRawNumber(targetPriceInput.value);
        const goalType = goalTypeInput ? goalTypeInput.value : 'normal';
        const targetDate = targetDateInput ? targetDateInput.value : '';
        const emergencyMonths = emergencyMonthsInput ? Number(emergencyMonthsInput.value) || 6 : 6;
        if (!inputName)  {
            alert('Enter a goal name.');
            return;
        }
        if (goalType === 'emergency' && targetPrice <= 0)  {
            const txs = getStorageData(KEYS.TRANSACTIONS);
            const now = new Date();
            let total = 0;
            const months = new Set();
            txs.filter((t) => t.type === 'expense' && t.category !== 'Savings Deposit').forEach((t) =>  {
                const d = parseTransactionDate(t.date);
                if (!d) return;
                const diff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
                if (diff >= 0 && diff < 3)  {
                    total += Number(t.amount) || 0;
                    months.add(monthKeyFromDate(t.date));
                }
            });
            const avg = months.size ? total / months.size : 0;
            targetPrice = avg * emergencyMonths;
            if (targetPrice <= 0)  {
                alert('Add expense history first, or enter an emergency-fund target amount manually.');
                return;
            }
        }
        if (!targetPrice || targetPrice <= 0)  {
            alert('Enter a valid target amount.');
            return;
        }
        const goals = getStorageData(KEYS.SAVINGS_GOALS);
        if (goals.some((g) => g.name.toLowerCase() === inputName.toLowerCase()))  {
            alert('The item "' + inputName + '" already exists in your savings target list!');
            return;
        }
        goals.push({
            id: Date.now(), name: inputName, target: targetPrice, saved: 0, contributions: [], type: goalType, targetDate: targetDate, emergencyMonths: goalType === 'emergency' ? emergencyMonths : null
        });
        setStorageData(KEYS.SAVINGS_GOALS, goals);
        form.reset();
        if (emergencyMonthsBox) emergencyMonthsBox.style.display = 'none';
        renderGoals();
    });
    renderGoals();
});
