// --- 1. Global Storage Keys ---
const KEYS =  {
    TRANSACTIONS: 'app_transactions', SAVINGS_GOALS: 'app_savings_goals', USER_PROFILE: 'app_user_profile', MONTHLY_REPORTS: 'app_monthly_reports', CALENDAR_EVENTS: 'app_calendar_events', CUSTOM_CATEGORIES: 'app_custom_categories', BUDGETS: 'app_budgets', RECURRING: 'app_recurring_transactions', BILLS: 'app_bills', SUBSCRIPTIONS: 'app_subscriptions', DEBTS: 'app_debts', WALLETS: 'app_wallets', DASHBOARD_PREFS: 'app_dashboard_preferences'
};
const ACTIVE_UID_KEY = 'smarttracker_active_uid';
const PENDING_SYNC_KEY = 'smarttracker_pending_sync_keys';
function defaultDashboardPreferences() {
    return {
        cards: { balance: true, opening: true, income: true, expenses: true, savings: true },
        sections: { wallets: true, health: true },
        charts: { incomeExpense: true, category: true, wallets: true, balance: true, savings: true }
    };
}
function getPendingSyncMap() {
    try {
        const parsed = JSON.parse(localStorage.getItem(PENDING_SYNC_KEY) || '{}');
        // Backward compatibility with the older array format.
        if (Array.isArray(parsed)) {
            const map = {};
            parsed.forEach((key) => { if (Object.values(KEYS).includes(key)) map[key] = 'legacy'; });
            return map;
        }
        if (!parsed || typeof parsed !== 'object') return {};
        const map = {};
        Object.entries(parsed).forEach(([key,token]) => { if (Object.values(KEYS).includes(key)) map[key] = String(token); });
        return map;
    } catch (_) {
        return {};
    }
}
function getPendingSyncKeys() {
    return Object.keys(getPendingSyncMap());
}
function savePendingSyncMap(map) {
    if (map && Object.keys(map).length) localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(map));
    else localStorage.removeItem(PENDING_SYNC_KEY);
    refreshSyncIndicator();
}
function markPendingSync(key) {
    const map = getPendingSyncMap();
    map[key] = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    savePendingSyncMap(map);
}
function pendingSyncCount() {
    return getPendingSyncKeys().length;
}
function clearUserCache()  {
    Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem(PENDING_SYNC_KEY);
    localStorage.removeItem('smarttracker_last_sync');
}
// --- Time-based greeting helper ---
function getTimeGreeting(name)  {
    const hour = new Date().getHours();
    let part;
    if (hour < 12) part = 'Good morning';
    else if (hour < 17) part = 'Good afternoon';
    else part = 'Good evening';
    const who = name ? `, ${name}` : '';
    return `${part}${who}!`;
}
// --- 2. "App Ready" gate ---------------------------------------------------
let _appReady = false;
const _readyCallbacks = [];
function onAppReady(cb)  {
    if (_appReady) cb();
    else _readyCallbacks.push(cb);
}
function markAppReady()  {
    _appReady = true;
    document.body.classList.remove('app-loading');
    const sk = document.getElementById('app-loading-skeleton');
    if (sk) sk.style.display = 'none';
    _readyCallbacks.forEach((cb) => cb());
    _readyCallbacks.length = 0;
}
// --- 3. Firebase Auth Guard + Cloud Sync -----------------------------------
const isLoginPage = window.location.pathname.toLowerCase().endsWith('login.html');
window.currentUserId = null;
auth.onAuthStateChanged(async (user) =>  {
    if (!user)  {
        window.currentUserId = null;
        if (!isLoginPage) window.location.href = 'login.html';
        return;
    }
    // Refresh verification state when online. If the installed PWA is offline,
    // keep using Firebase Auth's locally persisted verified session instead of
    // leaving the app stuck on the loading state.
    try  {
        await user.reload();
    } catch (err)  {
        if (navigator.onLine) console.warn('Could not refresh Firebase user:', err);
    }
    const freshUser = auth.currentUser || user;
    if (!freshUser || !freshUser.emailVerified)  {
        window.currentUserId = null;
        if (!isLoginPage)  {
            await auth.signOut();
            window.location.href = 'login.html';
        }
        return;
    }
    if (isLoginPage)  {
        window.location.href = 'index.html';
        return;
    }
    // Never mix one Firebase account's cached data with another account.
    const previousUid = localStorage.getItem(ACTIVE_UID_KEY);
    if (previousUid && previousUid !== freshUser.uid) clearUserCache();
    localStorage.setItem(ACTIVE_UID_KEY, freshUser.uid);
    window.currentUserId = freshUser.uid;
    await pullCloudDataIntoCache(freshUser.uid);
    markAppReady();
});
async function pullCloudDataIntoCache(uid)  {
    let cloudExists = false;
    let cloudData = {};
    try  {
        const snap = await db.collection('users').doc(uid).get();
        if (snap.exists)  {
            cloudExists = true;
            const data = snap.data() ||  {
            };
            cloudData = data;
            const pendingKeys = new Set(getPendingSyncKeys());
            Object.values(KEYS).forEach((storageKey) =>  {
                // Never overwrite a local value that is waiting to sync from an offline session.
                if (pendingKeys.has(storageKey) && localStorage.getItem(storageKey) !== null) return;
                if (data[storageKey] !== undefined)  {
                    localStorage.setItem(storageKey, JSON.stringify(data[storageKey]));
                } else  {
                    localStorage.removeItem(storageKey);
                }
            });
        } else  {
            // Brand-new account (for example Google sign-in): start with a clean cache.
            clearUserCache();
        }
    } catch (err)  {
        console.error('Could not load cloud data, using local cache instead:', err);
    }
    if (!getUserProfile())  {
        const user = auth.currentUser;
        let username = 'user';
        if (user && user.email) username = user.email.split('@')[0] || 'user';
        const seed =  {
            username: username, fullname: (user && user.displayName) || '', email: (user && user.email) || '', age: '', dob: '', job: '', country: '', phone: '', currency: 'LKR', photo: (user && user.photoURL) || null
        };
        localStorage.setItem(KEYS.USER_PROFILE, JSON.stringify(seed));
        if (!cloudExists)  {
            const initial =  {
            };
            initial[KEYS.USER_PROFILE] = seed;
            initial[KEYS.TRANSACTIONS] = [];
            initial[KEYS.SAVINGS_GOALS] = [];
            initial[KEYS.MONTHLY_REPORTS] = [];
            initial[KEYS.CALENDAR_EVENTS] = [];
            initial[KEYS.CUSTOM_CATEGORIES] = [];
            initial[KEYS.BUDGETS] = [];
            initial[KEYS.RECURRING] = [];
            initial[KEYS.BILLS] = [];
            initial[KEYS.SUBSCRIPTIONS] = [];
            initial[KEYS.DEBTS] = [];
            initial[KEYS.WALLETS] = defaultWallets();
            initial[KEYS.DASHBOARD_PREFS] = defaultDashboardPreferences();
            try  {
                await db.collection('users').doc(uid).set(initial,  {
                    merge: true
                });
            } catch (err)  {
                console.error('Could not initialize cloud profile:', err);
            }
        }
    }
    // Older/migrated accounts may not contain every newer SmartTracker dataset.
    // Add only missing fields so existing cloud data is never overwritten.
    if (cloudExists)  {
        const missing = {};
        Object.values(KEYS).forEach((storageKey) =>  {
            if (cloudData[storageKey] !== undefined) return;
            let value;
            if (storageKey === KEYS.USER_PROFILE) value = getUserProfile() || {};
            else if (storageKey === KEYS.WALLETS) value = defaultWallets();
            else if (storageKey === KEYS.DASHBOARD_PREFS) value = defaultDashboardPreferences();
            else value = [];
            localStorage.setItem(storageKey, JSON.stringify(value));
            missing[storageKey] = value;
        });
        if (Object.keys(missing).length)  {
            try  {
                await db.collection('users').doc(uid).set(missing, { merge: true });
            } catch (err)  {
                console.error('Could not add missing SmartTracker datasets:', err);
            }
        }
    }
    // Normalize older records after cloud data is loaded. This keeps old
    // locale-formatted dates and savings deposits compatible with monthly views.
    normalizeTransactionStore();
    processAutomaticTransactions();
    if (navigator.onLine) flushPendingCloudWrites();
}
let _syncFlushInProgress = false;
async function flushPendingCloudWrites() {
    const uid = window.currentUserId;
    const snapshot = getPendingSyncMap();
    const keys = Object.keys(snapshot);
    if (!uid || !navigator.onLine || !keys.length || _syncFlushInProgress) {
        refreshSyncIndicator();
        return;
    }
    _syncFlushInProgress = true;
    refreshSyncIndicator('syncing');
    try {
        const ref = db.collection('users').doc(uid);
        for (const key of keys) {
            const raw = localStorage.getItem(key);
            if (raw === null) continue;
            let value;
            try { value = JSON.parse(raw); } catch (_) { continue; }
            await ref.set({ [key]: value }, { merge: true });
        }
        if (typeof db.waitForPendingWrites === 'function') await db.waitForPendingWrites();
        // Only clear versions that were actually part of this flush. If the user
        // changed the same dataset while syncing, its newer token stays pending.
        const current = getPendingSyncMap();
        keys.forEach((key) => { if (current[key] === snapshot[key]) delete current[key]; });
        savePendingSyncMap(current);
        localStorage.setItem('smarttracker_last_sync', new Date().toISOString());
    } catch (err) {
        console.error('Pending cloud sync failed:', err);
    } finally {
        _syncFlushInProgress = false;
        refreshSyncIndicator();
        if (navigator.onLine && window.currentUserId && pendingSyncCount()) setTimeout(flushPendingCloudWrites, 100);
    }
}
function pushToCloud(key, value)  {
    const uid = window.currentUserId;
    if (!uid) return;
    markPendingSync(key);
    refreshSyncIndicator(navigator.onLine ? 'syncing' : 'offline');
    db.collection('users').doc(uid).set({ [key]: value }, { merge: true })
        .then(() => {
            // Firestore can resolve a write from its local cache while offline.
            // Only clear the pending badge after the server has acknowledged writes online.
            if (navigator.onLine) flushPendingCloudWrites();
            else refreshSyncIndicator('offline');
        })
        .catch((err) => {
            console.error('Cloud save failed for', key, err);
            refreshSyncIndicator();
        });
}
// --- 4. Storage Helper Functions -------------------------------------------
function getStorageData(key)  {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
}
function setStorageData(key, value)  {
    localStorage.setItem(key, JSON.stringify(value));
    pushToCloud(key, value);
}
// --- Shared finance/date helpers -------------------------------------------
const SMART_WALLETS = ['Cash', 'Bank', 'Card'];
function defaultWallets()  {
    return [ {
        id: 'cash', name: 'Cash', icon: '💵', openingBalance: 0
    },  {
        id: 'bank', name: 'Bank', icon: '🏦', openingBalance: 0
    },  {
        id: 'card', name: 'Card', icon: '💳', openingBalance: 0
    } ];
}
function getWallets()  {
    let list = getStorageData(KEYS.WALLETS);
    if (!Array.isArray(list) || !list.length) return defaultWallets();
    const seen = new Set();
    return list.filter((w) => w && String(w.name || '').trim()).map((w, i) =>  {
        const name = String(w.name).trim();
        const key = name.toLowerCase();
        if (seen.has(key)) return null;
        seen.add(key);
        return  {
            id: w.id || ('wallet-' + i + '-' + Date.now()), name, icon: w.icon || '👛', openingBalance: Number(w.openingBalance) || 0
        };
    }).filter(Boolean);
}
function saveWallets(wallets)  {
    setStorageData(KEYS.WALLETS, wallets);
}
function getWalletNames()  {
    return getWallets().map((w) => w.name);
}
function isKnownWallet(name)  {
    return getWalletNames().includes(name);
}
function toLocalISODate(value)  {
    if (!value) return '';
    const raw = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function parseTransactionDate(value)  {
    const iso = toLocalISODate(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const d = new Date(iso + 'T00:00:00');
    return Number.isNaN(d.getTime()) ? null : d;
}
function monthKeyFromDate(value)  {
    const iso = toLocalISODate(value);
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.slice(0, 7) : '';
}
function currentMonthKey()  {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
function computeWalletBalances(transactions)  {
    const balances =  {
    };
    getWallets().forEach((w) =>  {
        balances[w.name] = Number(w.openingBalance) || 0;
    });
    (transactions || []).forEach((tx) =>  {
        const amount = Number(tx.amount) || 0;
        if (tx.type === 'transfer')  {
            const from = tx.fromAccount || 'Cash';
            const to = tx.toAccount || 'Bank';
            if (balances[from] === undefined) balances[from] = 0;
            if (balances[to] === undefined) balances[to] = 0;
            balances[from] -= amount;
            balances[to] += amount;
            return;
        }
        const account = tx.account || 'Cash';
        if (balances[account] === undefined) balances[account] = 0;
        if (tx.type === 'income') balances[account] += amount;
        if (tx.type === 'expense') balances[account] -= amount;
    });
    return balances;
}
function getWalletBalances()  {
    return computeWalletBalances(getStorageData(KEYS.TRANSACTIONS));
}
function getWalletAvailable(wallet, excludeTxId)  {
    const balances = getWalletBalances();
    let available = Number(balances[wallet]) || 0;
    if (excludeTxId)  {
        const old = getStorageData(KEYS.TRANSACTIONS).find((tx) => tx.id === excludeTxId);
        if (old)  {
            if (old.type === 'expense' && (old.account || 'Cash') === wallet) available += Number(old.amount) || 0;
            if (old.type === 'transfer' && old.fromAccount === wallet) available += Number(old.amount) || 0;
        }
    }
    return available;
}
function totalNetBeforeMonth(monthKey, transactions)  {
    let total = 0;
    (transactions || []).forEach((tx) =>  {
        if (tx.type === 'transfer') return;
        const txMonth = monthKeyFromDate(tx.date);
        if (!txMonth || txMonth >= monthKey) return;
        const amount = Number(tx.amount) || 0;
        if (tx.type === 'income') total += amount;
        if (tx.type === 'expense') total -= amount;
    });
    return total;
}
function normalizeTransactionStore()  {
    const transactions = getStorageData(KEYS.TRANSACTIONS);
    if (!Array.isArray(transactions)) return;
    let changed = false;
    transactions.forEach((tx) =>  {
        const normalizedDate = toLocalISODate(tx.date);
        if (normalizedDate && normalizedDate !== tx.date)  {
            tx.date = normalizedDate;
            changed = true;
        }
        if (tx.type !== 'transfer' && !tx.account)  {
            tx.account = 'Cash';
            changed = true;
        }
    });
    if (changed) setStorageData(KEYS.TRANSACTIONS, transactions);
}
function getUserProfile()  {
    try  {
        const raw = localStorage.getItem(KEYS.USER_PROFILE);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
        return parsed;
    } catch  {
        return null;
    }
}
function saveUserProfile(profile)  {
    localStorage.setItem(KEYS.USER_PROFILE, JSON.stringify(profile));
    pushToCloud(KEYS.USER_PROFILE, profile);
}
// --- Currency helpers ---
const CURRENCY_MAP =  {
    LKR:  {
        symbol: 'Rs.', locale: 'en-LK', code: 'LKR'
    }, USD:  {
        symbol: '$', locale: 'en-US', code: 'USD'
    }, EUR:  {
        symbol: '€', locale: 'de-DE', code: 'EUR'
    }, GBP:  {
        symbol: '£', locale: 'en-GB', code: 'GBP'
    }, INR:  {
        symbol: '₹', locale: 'en-IN', code: 'INR'
    }
};
function getCurrency()  {
    const p = getUserProfile();
    const code = (p && p.currency) || 'LKR';
    return CURRENCY_MAP[code] || CURRENCY_MAP.LKR;
}
function formatMoney(amount)  {
    const c = getCurrency();
    const n = parseFloat(amount) || 0;
    return `${c.symbol} ${n.toLocaleString(c.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatRs(amount)  {
    return formatMoney(amount);
}
// --- Calendar event helpers ---
function getCalendarEvents()  {
    return getStorageData(KEYS.CALENDAR_EVENTS);
}
function setCalendarEvents(events)  {
    setStorageData(KEYS.CALENDAR_EVENTS, events);
}
function addCalendarEvent(event)  {
    const events = getCalendarEvents();
    events.push(event);
    setCalendarEvents(events);
    return event;
}
// --- Custom categories helpers ---
function getCustomCategories()  {
    const list = getStorageData(KEYS.CUSTOM_CATEGORIES);
    return Array.isArray(list) ? list.filter((c) => typeof c === 'string' && c.trim()) : [];
}
function setCustomCategories(list)  {
    const cleaned = (list || []) .map((c) => String(c || '').trim()) .filter(Boolean) .filter((c, i, arr) => arr.findIndex((x) => x.toLowerCase() === c.toLowerCase()) === i);
    setStorageData(KEYS.CUSTOM_CATEGORIES, cleaned);
    return cleaned;
}
function addCustomCategory(name)  {
    const n = String(name || '').trim();
    if (!n) return getCustomCategories();
    const list = getCustomCategories();
    if (list.some((c) => c.toLowerCase() === n.toLowerCase())) return list;
    list.push(n);
    return setCustomCategories(list);
}
function removeCustomCategory(name)  {
    const n = String(name || '').trim().toLowerCase();
    return setCustomCategories(getCustomCategories().filter((c) => c.toLowerCase() !== n));
}
// --- Date display preference helpers ---
function getDateFormat()  {
    const p = getUserProfile();
    return (p && p.dateFormat) || 'DD/MM/YYYY';
}
function formatAppDate(value)  {
    const d = parseTransactionDate(value);
    if (!d) return String(value || '');
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const f = getDateFormat();
    if (f === 'MM/DD/YYYY') return `${mm}/${dd}/${yyyy}`;
    if (f === 'YYYY-MM-DD') return `${yyyy}-${mm}-${dd}`;
    return `${dd}/${mm}/${yyyy}`;
}
function addDaysISO(iso, days)  {
    const d = parseTransactionDate(iso) || new Date();
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function addMonthsISO(iso, months)  {
    const d = parseTransactionDate(iso) || new Date();
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + months);
    const max = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, max));
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function advanceRecurringDate(iso, frequency)  {
    if (frequency === 'weekly') return addDaysISO(iso, 7);
    if (frequency === 'yearly') return addMonthsISO(iso, 12);
    return addMonthsISO(iso, 1);
}
function ensureAutoTransaction(def, kind)  {
    const today = toLocalISODate(new Date());
    if (!def.active || !def.nextDate || def.nextDate > today) return false;
    let changed = false;
    const transactions = getStorageData(KEYS.TRANSACTIONS);
    let guard = 0;
    while (def.active && def.nextDate && def.nextDate <= today && guard++ < 60)  {
        const occurrenceKey = `${kind}:${def.id}:${def.nextDate}`;
        if (!transactions.some((tx) => tx.autoKey === occurrenceKey))  {
            const amount = Number(def.amount) || 0;
            const account = def.wallet || 'Cash';
            if (def.type !== 'expense' || getWalletAvailable(account) + 1e-9 >= amount)  {
                transactions.push({
                    id: Date.now() + Math.floor(Math.random() * 100000), type: def.type || 'expense', category: def.category || (kind === 'subscription' ? 'Subscriptions' : 'Other'), account, amount, description: def.name || def.description || (kind === 'subscription' ? 'Subscription' : 'Recurring transaction'), date: def.nextDate, autoKey: occurrenceKey, sourceKind: kind, sourceId: def.id
                });
                changed = true;
            } else  {
                break;
            }
        }
        def.lastGenerated = def.nextDate;
        def.nextDate = advanceRecurringDate(def.nextDate, def.frequency || def.cycle || 'monthly');
        changed = true;
    }
    if (changed) setStorageData(KEYS.TRANSACTIONS, transactions);
    return changed;
}
function processAutomaticTransactions()  {
    const recurring = getStorageData(KEYS.RECURRING);
    let recurringChanged = false;
    recurring.forEach((r) =>  {
        if (ensureAutoTransaction(r, 'recurring')) recurringChanged = true;
    });
    if (recurringChanged) setStorageData(KEYS.RECURRING, recurring);
    const subscriptions = getStorageData(KEYS.SUBSCRIPTIONS);
    let subChanged = false;
    subscriptions.forEach((s) =>  {
        if (s.autoRecord && ensureAutoTransaction(s, 'subscription')) subChanged = true;
    });
    if (subChanged) setStorageData(KEYS.SUBSCRIPTIONS, subscriptions);
}
function isSavingsDeposit(tx)  {
    return tx && tx.type === 'expense' && tx.category === 'Savings Deposit';
}

function getMonthTotals(key)  {
    const txs = getStorageData(KEYS.TRANSACTIONS);
    let income = 0;
    let expense = 0;
    let savings = 0;

    txs.forEach((tx) =>  {
        if (tx.type === 'transfer' || monthKeyFromDate(tx.date) !== key) return;

        const amount = Number(tx.amount) || 0;

        if (tx.type === 'income')  {
            income += amount;
            return;
        }

        if (isSavingsDeposit(tx))  {
            savings += amount;
            return;
        }

        if (tx.type === 'expense')  {
            expense += amount;
        }
    });

    const opening = totalNetBeforeMonth(key, txs)
        + getWallets().reduce((sum, wallet) => sum + (Number(wallet.openingBalance) || 0), 0);

    return  {
        income,
        expense,
        savings,
        opening,
        cashChange: income - expense - savings,
        closing: opening + income - expense - savings
    };
}
function calculateFinancialHealth()  {
    const key = currentMonthKey();
    const totals = getMonthTotals(key);
    const budgets = getStorageData(KEYS.BUDGETS).filter((b) => !b.monthKey || b.monthKey === key);
    const bills = getStorageData(KEYS.BILLS);
    const goals = getStorageData(KEYS.SAVINGS_GOALS);
    const txs = getStorageData(KEYS.TRANSACTIONS).filter((t) => monthKeyFromDate(t.date) === key);
    const savings = totals.savings;
    let score = 60;
    const insights = [];
    if (totals.income > 0)  {
        const spendRate = totals.expense / totals.income;
        if (spendRate <= .7) score += 15;
        else if (spendRate > 1) score -= 20;
        else if (spendRate > .9) score -= 8;
        const saveRate = savings / totals.income;
        if (saveRate >= .2) score += 10;
        else if (saveRate >= .1) score += 5;
        insights.push(`You saved ${Math.round(saveRate*100)}% of this month's income.`);
    }
    const today = toLocalISODate(new Date());
    const overdue = bills.filter((b)=>!b.paid && b.dueDate && b.dueDate < today).length;
    if (overdue)  {
        score -= Math.min(20, overdue*5);
        insights.push(`${overdue} bill${overdue===1?' is':'s are'} overdue.`);
    }
    let budgetPressure = 0;
    budgets.forEach((b) =>  {
        const used = txs.filter((t)=>t.type==='expense' && t.category===b.category).reduce((s,t)=>s+(Number(t.amount)||0),0);
        const pct = Number(b.limit) ? used/Number(b.limit) : 0;
        if (pct >= 1)  {
            score -= 6;
            budgetPressure++;
        } else if (pct >= .8) insights.push(`${b.category} budget is ${Math.round(pct*100)}% used.`);
    });
    if (!overdue && bills.length) score += 5;
    if (goals.some((g)=>g.type==='emergency' && Number(g.saved)>=Number(g.target))) score += 10;
    score = Math.max(0, Math.min(100, Math.round(score)));
    const label = score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : 'Needs attention';
    const d = new Date();
    d.setMonth(d.getMonth()-1);
    const prevKey = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    const prev = getMonthTotals(prevKey);
    if (prev.expense > 0)  {
        const diff = ((totals.expense-prev.expense)/prev.expense)*100;
        insights.unshift(`Spending is ${Math.abs(diff).toFixed(1)}% ${diff>=0?'higher':'lower'} than last month.`);
    }
    if (!insights.length) insights.push('Add income, expenses, budgets and bills to get personalized insights.');
    return  {
        score, label, insights: insights.slice(0,4)
    };
}
// --- Savings goal <-> transaction sync ---
// Contributions share the same id as their Dashboard transaction.
function savingsDescForGoal(goalName)  {
    return 'Daily Savings contribution for: ' + goalName;
}
function recalcGoalSaved(goal)  {
    const sum = (goal.contributions || []).reduce((s, c) => s + (Number(c.amount) || 0), 0);
    goal.saved = sum;
    return goal;
}
function findGoalIndexForTx(goals, tx)  {
    if (!tx) return -1;
    const tid = tx.id;
    for (let i = 0; i < goals.length; i++)  {
        const g = goals[i];
        if ((g.contributions || []).some((c) => c.id === tid)) return i;
    }
    // Fallback: match by classic description
    if (tx.description && String(tx.description).startsWith('Daily Savings contribution for: '))  {
        const name = String(tx.description).slice('Daily Savings contribution for: '.length);
        return goals.findIndex((g) => g.name === name);
    }
    return -1;
}
/** Keep savings goals in sync after a transaction is updated on the Dashboard. */ function syncSavingsOnTxUpdate(oldTx, newTx)  {
    if (!oldTx && !newTx) return;
    const goals = getStorageData(KEYS.SAVINGS_GOALS);
    if (!Array.isArray(goals) || !goals.length) return;
    const wasSavings = oldTx && (oldTx.category === 'Savings Deposit' || (oldTx.description && String(oldTx.description).startsWith('Daily Savings contribution for: ')));
    const isSavings = newTx && newTx.type === 'expense' && newTx.category === 'Savings Deposit';
    let changed = false;
    // Case 1: was a savings deposit — update or remove linked contribution
    if (wasSavings && oldTx)  {
        const gi = findGoalIndexForTx(goals, oldTx);
        if (gi >= 0)  {
            const goal = goals[gi];
            if (!Array.isArray(goal.contributions)) goal.contributions = [];
            const ci = goal.contributions.findIndex((c) => c.id === oldTx.id);
            if (isSavings && newTx)  {
                // Still a savings deposit — update amount (and keep description tied to goal)
                if (ci >= 0)  {
                    goal.contributions[ci].amount = Number(newTx.amount) || 0;
                } else  {
                    goal.contributions.push({
                        id: newTx.id, amount: Number(newTx.amount) || 0, dateISO: (newTx.date && String(newTx.date).slice(0, 10)) || new Date().toISOString().slice(0, 10), dateLabel: newTx.date || new Date().toLocaleDateString()
                    });
                }
                // Force description to stay linked to this goal
                if (newTx) newTx.description = savingsDescForGoal(goal.name);
                recalcGoalSaved(goal);
                changed = true;
            } else  {
                // No longer a savings deposit — drop contribution
                if (ci >= 0)  {
                    goal.contributions.splice(ci, 1);
                    recalcGoalSaved(goal);
                    changed = true;
                }
            }
        }
    } else if (isSavings && newTx && !wasSavings)  {
        // Became a savings deposit but wasn't one — try attach by description goal name
        const desc = newTx.description || '';
        let goalName = null;
        if (desc.startsWith('Daily Savings contribution for: '))  {
            goalName = desc.slice('Daily Savings contribution for: '.length);
        }
        if (goalName)  {
            const gi = goals.findIndex((g) => g.name === goalName);
            if (gi >= 0)  {
                const goal = goals[gi];
                if (!Array.isArray(goal.contributions)) goal.contributions = [];
                if (!goal.contributions.some((c) => c.id === newTx.id))  {
                    goal.contributions.push({
                        id: newTx.id, amount: Number(newTx.amount) || 0, dateISO: (newTx.date && String(newTx.date).slice(0, 10)) || new Date().toISOString().slice(0, 10), dateLabel: newTx.date || new Date().toLocaleDateString()
                    });
                    recalcGoalSaved(goal);
                    changed = true;
                }
            }
        }
    }
    if (changed) setStorageData(KEYS.SAVINGS_GOALS, goals);
}
/** Keep savings goals in sync after a transaction is deleted on the Dashboard. */ function syncSavingsOnTxDelete(tx)  {
    if (!tx) return;
    const goals = getStorageData(KEYS.SAVINGS_GOALS);
    if (!Array.isArray(goals) || !goals.length) return;
    const gi = findGoalIndexForTx(goals, tx);
    if (gi < 0) return;
    const goal = goals[gi];
    if (!Array.isArray(goal.contributions)) return;
    const before = goal.contributions.length;
    goal.contributions = goal.contributions.filter((c) => c.id !== tx.id);
    if (goal.contributions.length === before)  {
        // fallback: match amount+description era without id
        if (tx.description === savingsDescForGoal(goal.name))  {
            const amt = Number(tx.amount) || 0;
            const idx = goal.contributions.findIndex((c) => Number(c.amount) === amt);
            if (idx >= 0) goal.contributions.splice(idx, 1);
        }
    }
    recalcGoalSaved(goal);
    setStorageData(KEYS.SAVINGS_GOALS, goals);
}
/** Update a contribution from the Savings page (edits matching Dashboard tx). */ function updateSavingsContribution(goalId, contribId, newAmount)  {
    const goals = getStorageData(KEYS.SAVINGS_GOALS);
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return  {
        ok: false, error: 'Goal not found.'
    };
    if (!Array.isArray(goal.contributions)) goal.contributions = [];
    const ci = goal.contributions.findIndex((c) => c.id === contribId);
    if (ci < 0) return  {
        ok: false, error: 'Contribution not found.'
    };
    const oldAmount = Number(goal.contributions[ci].amount) || 0;
    const amt = Number(newAmount) || 0;
    if (amt <= 0) return  {
        ok: false, error: 'Enter a valid amount.'
    };
    const others = goal.saved - oldAmount;
    if (others + amt > goal.target)  {
        const max = Math.max(0, goal.target - others);
        return  {
            ok: false, error: 'Amount too high. Max for this deposit: ' + formatMoney(max)
        };
    }
    goal.contributions[ci].amount = amt;
    recalcGoalSaved(goal);
    setStorageData(KEYS.SAVINGS_GOALS, goals);
    const transactions = getStorageData(KEYS.TRANSACTIONS);
    const ti = transactions.findIndex((t) => t.id === contribId);
    if (ti >= 0)  {
        transactions[ti].amount = amt;
        transactions[ti].category = 'Savings Deposit';
        transactions[ti].type = 'expense';
        transactions[ti].description = savingsDescForGoal(goal.name);
        setStorageData(KEYS.TRANSACTIONS, transactions);
    }
    return  {
        ok: true, goal
    };
}
/** Delete a contribution from the Savings page (also removes Dashboard tx). */ function deleteSavingsContribution(goalId, contribId)  {
    const goals = getStorageData(KEYS.SAVINGS_GOALS);
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return  {
        ok: false, error: 'Goal not found.'
    };
    if (!Array.isArray(goal.contributions)) goal.contributions = [];
    goal.contributions = goal.contributions.filter((c) => c.id !== contribId);
    recalcGoalSaved(goal);
    setStorageData(KEYS.SAVINGS_GOALS, goals);
    const transactions = getStorageData(KEYS.TRANSACTIONS);
    setStorageData( KEYS.TRANSACTIONS, transactions.filter((t) => t.id !== contribId) );
    return  {
        ok: true, goal
    };
}
// --- Reusable password visibility toggles -------------------------------
function initPasswordToggles()  {
    document.querySelectorAll('.password-field').forEach((wrap) =>  {
        const input = wrap.querySelector('input[type="password"], input[data-password-input]');
        const btn = wrap.querySelector('.password-toggle');
        if (!input || !btn || btn.dataset.bound === '1') return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', () =>  {
            const showing = input.type === 'text';
            input.type = showing ? 'password' : 'text';
            btn.textContent = showing ? '👁' : '⊘';
            btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
            btn.setAttribute('aria-pressed', String(!showing));
        });
    });
}
document.addEventListener('DOMContentLoaded', initPasswordToggles);
// --- 4. Global UI Initialization ---
document.addEventListener('DOMContentLoaded', () =>  {
    initPasswordToggles();
    // Show loading skeleton until Firebase data is pulled
    if (!isLoginPage && !_appReady)  {
        document.body.classList.add('app-loading');
    }
    const currentTheme = localStorage.getItem('theme');
    const themeToggleBtn = document.getElementById('theme-toggle');
    function applyThemeIcon(isDark)  {
        if (!themeToggleBtn) return;
        themeToggleBtn.textContent = isDark ? '☀️' : '🌙';
        themeToggleBtn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
        themeToggleBtn.title = isDark ? 'Light Mode' : 'Dark Mode';
    }
    const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldDark = currentTheme === 'dark' || (currentTheme === 'system' && systemDark);
    document.body.classList.toggle('dark-mode', shouldDark);
    applyThemeIcon(shouldDark);
    if (themeToggleBtn)  {
        themeToggleBtn.addEventListener('click', () =>  {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            applyThemeIcon(isDark);
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });
    }
    function doLogout()  {
        auth.signOut().finally(() =>  {
            window.location.href = 'login.html';
        });
    }
    document.querySelectorAll('#logout-btn, .mobile-menu-logout, .btn-logout').forEach((btn) =>  {
        btn.addEventListener('click', doLogout);
    });
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const navLinks = document.getElementById('nav-links') || document.querySelector('.nav-links');
    if (hamburgerBtn && navLinks)  {
        hamburgerBtn.addEventListener('click', (e) =>  {
            e.stopPropagation();
            const isOpen = navLinks.classList.toggle('open');
            hamburgerBtn.classList.toggle('open', isOpen);
            hamburgerBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
        navLinks.querySelectorAll('a.nav-link').forEach((link) =>  {
            link.addEventListener('click', () =>  {
                navLinks.classList.remove('open');
                hamburgerBtn.classList.remove('open');
                hamburgerBtn.setAttribute('aria-expanded', 'false');
            });
        });
        document.addEventListener('click', (e) =>  {
            if ( navLinks.classList.contains('open') && !navLinks.contains(e.target) && !hamburgerBtn.contains(e.target) )  {
                navLinks.classList.remove('open');
                hamburgerBtn.classList.remove('open');
                hamburgerBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }
    if ('Notification' in window && Notification.permission === 'default')  {
        // Soft prompt later from calendar page
    }
    onAppReady(() =>  {
        checkCalendarReminders();
        setInterval(checkCalendarReminders, 60 * 1000);
    });
});
function refreshSyncIndicator(mode) {
    const el = document.getElementById('sync-status');
    if (!el) return;
    const pending = pendingSyncCount();
    if (!navigator.onLine || mode === 'offline') {
        el.textContent = pending ? `📴 Offline · ${pending} change${pending === 1 ? '' : 's'} pending` : '📴 Offline · local data available';
        el.classList.toggle('has-pending', pending > 0);
        return;
    }
    if (mode === 'syncing' || pending) {
        el.textContent = pending ? `☁️ Syncing ${pending} pending change${pending === 1 ? '' : 's'}…` : '☁️ Syncing…';
        el.classList.toggle('has-pending', pending > 0);
        return;
    }
    el.classList.remove('has-pending');
    const last = localStorage.getItem('smarttracker_last_sync');
    el.textContent = last ? '☁️ Synced ' + new Date(last).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : '☁️ Online · Firebase sync active';
}
function installSyncIndicator() {
    let el = document.getElementById('sync-status');
    if (!el) {
        el = document.createElement('div');
        el.id = 'sync-status';
        el.className = 'sync-badge';
        document.body.appendChild(el);
    }
    window.addEventListener('online', () => {
        refreshSyncIndicator('syncing');
        flushPendingCloudWrites();
    });
    window.addEventListener('offline', () => refreshSyncIndicator('offline'));
    refreshSyncIndicator();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installSyncIndicator);
else installSyncIndicator();
function checkCalendarReminders()  {
    const events = getCalendarEvents();
    if (!events.length) return;
    const now = new Date();
    const notified = JSON.parse(sessionStorage.getItem('notified_events') || '[]');
    events.forEach((ev) =>  {
        if (!ev.date || !ev.time) return;
        const remindMin = Number(ev.remindMinutes) || 0;
        const when = new Date(`${ev.date}T${ev.time}:00`);
        if (isNaN(when.getTime())) return;
        const remindAt = new Date(when.getTime() - remindMin * 60 * 1000);
        const key = String(ev.id);
        if (now >= remindAt && now <= new Date(when.getTime() + 5 * 60 * 1000))  {
            if (notified.includes(key)) return;
            notified.push(key);
            sessionStorage.setItem('notified_events', JSON.stringify(notified));
            const title = ev.type === 'bill' ? 'Bill reminder' : 'Event reminder';
            const body = `${ev.title}${ev.description ? ' — ' + ev.description : ''} at ${ev.time}`;
            if ('Notification' in window && Notification.permission === 'granted')  {
                new Notification(title,  {
                    body, icon: 'images/logo 2.png'
                });
            }
            showInAppToast(`${title}: ${body}`);
        }
    });
}
function showInAppToast(message)  {
    let toast = document.getElementById('app-toast');
    if (!toast)  {
        toast = document.createElement('div');
        toast.id = 'app-toast';
        toast.className = 'app-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => toast.classList.remove('show'), 6000);
}


// -------------------- Global Search --------------------
function installGlobalSearch() {
    if (isLoginPage || document.getElementById('global-search-modal')) return;
    const actions = document.querySelector('.nav-actions');
    if (!actions) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn-global-search';
    button.id = 'global-search-button';
    button.setAttribute('aria-label', 'Search SmartTracker');
    button.title = 'Search everything (Ctrl/⌘ + K)';
    button.textContent = '🔎';
    actions.insertBefore(button, actions.firstChild);

    const modal = document.createElement('div');
    modal.id = 'global-search-modal';
    modal.className = 'global-search-modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
        <div class="global-search-panel" role="dialog" aria-modal="true" aria-label="Search SmartTracker">
            <div class="global-search-head">
                <div><strong>Search SmartTracker</strong><small>Transactions, savings, budgets, bills, subscriptions, debts, wallets, calendar and reports</small></div>
                <button type="button" class="global-search-close" aria-label="Close">×</button>
            </div>
            <input id="global-search-input" type="search" autocomplete="off" placeholder="Search everything…" />
            <div id="global-search-results" class="global-search-results"><p class="global-search-empty">Type at least 2 characters to search.</p></div>
        </div>`;
    document.body.appendChild(modal);
    const input = modal.querySelector('#global-search-input');
    const results = modal.querySelector('#global-search-results');
    const closeBtn = modal.querySelector('.global-search-close');
    const escape = (v) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const datasets = [
        [KEYS.TRANSACTIONS, 'Transaction', 'transactions.html'],
        [KEYS.SAVINGS_GOALS, 'Savings goal', 'savings.html'],
        [KEYS.BUDGETS, 'Budget', 'planning.html'],
        [KEYS.RECURRING, 'Recurring transaction', 'planning.html'],
        [KEYS.BILLS, 'Bill', 'planning.html'],
        [KEYS.SUBSCRIPTIONS, 'Subscription', 'planning.html'],
        [KEYS.DEBTS, 'Debt / loan', 'planning.html'],
        [KEYS.WALLETS, 'Wallet', 'planning.html'],
        [KEYS.CALENDAR_EVENTS, 'Calendar event', 'calendar.html'],
        [KEYS.MONTHLY_REPORTS, 'Monthly report', 'reports.html'],
        [KEYS.CUSTOM_CATEGORIES, 'Category', 'transactions.html']
    ];
    function itemText(item) {
        if (typeof item === 'string') return item;
        if (!item || typeof item !== 'object') return String(item || '');
        const safe = { ...item };
        delete safe.photo;
        delete safe.items;
        delete safe.contributions;
        return Object.values(safe).filter(v => ['string','number','boolean'].includes(typeof v)).join(' ');
    }
    function itemTitle(item, label) {
        if (typeof item === 'string') return item;
        return item.description || item.name || item.title || item.service || item.category || item.account || item.month || item.date || label;
    }
    function runSearch() {
        const q = input.value.trim().toLowerCase();
        if (q.length < 2) {
            results.innerHTML = '<p class="global-search-empty">Type at least 2 characters to search.</p>';
            return;
        }
        const found = [];
        for (const [key,label,url] of datasets) {
            const raw = getStorageData(key);
            const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : [];
            for (const item of list) {
                const text = itemText(item);
                if (!text.toLowerCase().includes(q)) continue;
                found.push({ label, url, title:itemTitle(item,label), detail:text });
                if (found.length >= 60) break;
            }
            if (found.length >= 60) break;
        }
        const profile = getUserProfile();
        if (profile) {
            const profileText = [profile.username,profile.fullname,profile.email,profile.job,profile.country,profile.phone].filter(Boolean).join(' ');
            if (profileText.toLowerCase().includes(q)) found.push({label:'Profile',url:'account.html',title:profile.fullname||profile.username||'Profile',detail:profileText});
        }
        if (!found.length) {
            results.innerHTML = '<p class="global-search-empty">No matching SmartTracker data found.</p>';
            return;
        }
        results.innerHTML = found.map((r) => `<a class="global-search-result" href="${r.url}"><span class="global-search-type">${escape(r.label)}</span><strong>${escape(r.title)}</strong><small>${escape(r.detail).slice(0,180)}</small></a>`).join('');
    }
    function openSearch() {
        modal.classList.add('open');
        modal.setAttribute('aria-hidden','false');
        setTimeout(() => input.focus(), 0);
    }
    function closeSearch() {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden','true');
    }
    button.addEventListener('click', openSearch);
    closeBtn.addEventListener('click', closeSearch);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeSearch(); });
    input.addEventListener('input', runSearch);
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
        if (e.key === 'Escape' && modal.classList.contains('open')) closeSearch();
    });
}
if (!isLoginPage) onAppReady(installGlobalSearch);

// -------------------- PWA update notification --------------------
function showPwaUpdateNotice(registration) {
    if (!registration || !registration.waiting || document.getElementById('pwa-update-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'pwa-update-banner';
    banner.className = 'pwa-update-banner';
    banner.innerHTML = '<span>✨ A new SmartTracker version is available.</span><div><button type="button" id="pwa-update-refresh">Refresh</button><button type="button" id="pwa-update-later" class="pwa-update-later">Later</button></div>';
    document.body.appendChild(banner);
    banner.querySelector('#pwa-update-refresh').addEventListener('click', () => {
        if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    });
    banner.querySelector('#pwa-update-later').addEventListener('click', () => banner.remove());
}

// SmartTracker PWA service worker registration
if ('serviceWorker' in navigator) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
    });
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js').then((registration) => {
            if (registration.waiting) showPwaUpdateNotice(registration);
            registration.addEventListener('updatefound', () => {
                const worker = registration.installing;
                if (!worker) return;
                worker.addEventListener('statechange', () => {
                    if (worker.state === 'installed' && navigator.serviceWorker.controller) showPwaUpdateNotice(registration);
                });
            });
            // Check for an updated app shell periodically while the app stays open.
            setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
        }).catch(error => console.warn('Service worker registration failed:', error));
    });
}
