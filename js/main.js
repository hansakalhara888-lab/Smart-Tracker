// --- 1. Global Storage Keys ---
const KEYS = {
  TRANSACTIONS: 'app_transactions',
  SAVINGS_GOALS: 'app_savings_goals',
  USER_PROFILE: 'app_user_profile',
  MONTHLY_REPORTS: 'app_monthly_reports',
  CALENDAR_EVENTS: 'app_calendar_events',
  CUSTOM_CATEGORIES: 'app_custom_categories'
};

// --- Time-based greeting helper ---
function getTimeGreeting(name) {
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

function onAppReady(cb) {
  if (_appReady) cb();
  else _readyCallbacks.push(cb);
}

function markAppReady() {
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

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.currentUserId = null;
    if (!isLoginPage) window.location.href = 'login.html';
    return;
  }

  if (isLoginPage) {
    return;
  }

  window.currentUserId = user.uid;
  await pullCloudDataIntoCache(user.uid);
  markAppReady();
});

async function pullCloudDataIntoCache(uid) {
  try {
    const snap = await db.collection('users').doc(uid).get();
    if (snap.exists) {
      const data = snap.data() || {};
      Object.values(KEYS).forEach((storageKey) => {
        if (data[storageKey] !== undefined) {
          localStorage.setItem(storageKey, JSON.stringify(data[storageKey]));
        }
      });
    }
  } catch (err) {
    console.error('Could not load cloud data, using local cache instead:', err);
  }

  if (!getUserProfile()) {
    const user = auth.currentUser;
    let username = 'user';
    if (user && user.email) username = user.email.split('@')[0] || 'user';
    const seed = {
      username: username,
      fullname: '',
      age: '',
      dob: '',
      job: '',
      country: '',
      phone: '',
      currency: 'LKR',
      photo: null
    };
    localStorage.setItem(KEYS.USER_PROFILE, JSON.stringify(seed));
  }
}

function pushToCloud(key, value) {
  const uid = window.currentUserId;
  if (!uid) return;
  db.collection('users')
    .doc(uid)
    .set({ [key]: value }, { merge: true })
    .catch((err) => console.error('Cloud save failed for', key, err));
}

// --- 4. Storage Helper Functions -------------------------------------------
function getStorageData(key) {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

function setStorageData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  pushToCloud(key, value);
}

function getUserProfile() {
  try {
    const raw = localStorage.getItem(KEYS.USER_PROFILE);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveUserProfile(profile) {
  localStorage.setItem(KEYS.USER_PROFILE, JSON.stringify(profile));
  pushToCloud(KEYS.USER_PROFILE, profile);
}

// --- Currency helpers ---
const CURRENCY_MAP = {
  LKR: { symbol: 'Rs.', locale: 'en-LK', code: 'LKR' },
  USD: { symbol: '$', locale: 'en-US', code: 'USD' },
  EUR: { symbol: '€', locale: 'de-DE', code: 'EUR' },
  GBP: { symbol: '£', locale: 'en-GB', code: 'GBP' },
  INR: { symbol: '₹', locale: 'en-IN', code: 'INR' }
};

function getCurrency() {
  const p = getUserProfile();
  const code = (p && p.currency) || 'LKR';
  return CURRENCY_MAP[code] || CURRENCY_MAP.LKR;
}

function formatMoney(amount) {
  const c = getCurrency();
  const n = parseFloat(amount) || 0;
  return `${c.symbol} ${n.toLocaleString(c.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatRs(amount) {
  return formatMoney(amount);
}

// --- Calendar event helpers ---
function getCalendarEvents() {
  return getStorageData(KEYS.CALENDAR_EVENTS);
}

function setCalendarEvents(events) {
  setStorageData(KEYS.CALENDAR_EVENTS, events);
}

function addCalendarEvent(event) {
  const events = getCalendarEvents();
  events.push(event);
  setCalendarEvents(events);
  return event;
}

// --- Custom categories helpers ---
function getCustomCategories() {
  const list = getStorageData(KEYS.CUSTOM_CATEGORIES);
  return Array.isArray(list) ? list.filter((c) => typeof c === 'string' && c.trim()) : [];
}

function setCustomCategories(list) {
  const cleaned = (list || [])
    .map((c) => String(c || '').trim())
    .filter(Boolean)
    .filter((c, i, arr) => arr.findIndex((x) => x.toLowerCase() === c.toLowerCase()) === i);
  setStorageData(KEYS.CUSTOM_CATEGORIES, cleaned);
  return cleaned;
}

function addCustomCategory(name) {
  const n = String(name || '').trim();
  if (!n) return getCustomCategories();
  const list = getCustomCategories();
  if (list.some((c) => c.toLowerCase() === n.toLowerCase())) return list;
  list.push(n);
  return setCustomCategories(list);
}

function removeCustomCategory(name) {
  const n = String(name || '').trim().toLowerCase();
  return setCustomCategories(getCustomCategories().filter((c) => c.toLowerCase() !== n));
}



// --- Savings goal <-> transaction sync ---
// Contributions share the same id as their Dashboard transaction.
function savingsDescForGoal(goalName) {
  return 'Daily Savings contribution for: ' + goalName;
}

function recalcGoalSaved(goal) {
  const sum = (goal.contributions || []).reduce((s, c) => s + (Number(c.amount) || 0), 0);
  goal.saved = sum;
  return goal;
}

function findGoalIndexForTx(goals, tx) {
  if (!tx) return -1;
  const tid = tx.id;
  for (let i = 0; i < goals.length; i++) {
    const g = goals[i];
    if ((g.contributions || []).some((c) => c.id === tid)) return i;
  }
  // Fallback: match by classic description
  if (tx.description && String(tx.description).startsWith('Daily Savings contribution for: ')) {
    const name = String(tx.description).slice('Daily Savings contribution for: '.length);
    return goals.findIndex((g) => g.name === name);
  }
  return -1;
}

/** Keep savings goals in sync after a transaction is updated on the Dashboard. */
function syncSavingsOnTxUpdate(oldTx, newTx) {
  if (!oldTx && !newTx) return;
  const goals = getStorageData(KEYS.SAVINGS_GOALS);
  if (!Array.isArray(goals) || !goals.length) return;

  const wasSavings =
    oldTx &&
    (oldTx.category === 'Savings Deposit' ||
      (oldTx.description && String(oldTx.description).startsWith('Daily Savings contribution for: ')));
  const isSavings =
    newTx &&
    newTx.type === 'expense' &&
    newTx.category === 'Savings Deposit';

  let changed = false;

  // Case 1: was a savings deposit — update or remove linked contribution
  if (wasSavings && oldTx) {
    const gi = findGoalIndexForTx(goals, oldTx);
    if (gi >= 0) {
      const goal = goals[gi];
      if (!Array.isArray(goal.contributions)) goal.contributions = [];
      const ci = goal.contributions.findIndex((c) => c.id === oldTx.id);

      if (isSavings && newTx) {
        // Still a savings deposit — update amount (and keep description tied to goal)
        if (ci >= 0) {
          goal.contributions[ci].amount = Number(newTx.amount) || 0;
        } else {
          goal.contributions.push({
            id: newTx.id,
            amount: Number(newTx.amount) || 0,
            dateISO: (newTx.date && String(newTx.date).slice(0, 10)) || new Date().toISOString().slice(0, 10),
            dateLabel: newTx.date || new Date().toLocaleDateString()
          });
        }
        // Force description to stay linked to this goal
        if (newTx) newTx.description = savingsDescForGoal(goal.name);
        recalcGoalSaved(goal);
        changed = true;
      } else {
        // No longer a savings deposit — drop contribution
        if (ci >= 0) {
          goal.contributions.splice(ci, 1);
          recalcGoalSaved(goal);
          changed = true;
        }
      }
    }
  } else if (isSavings && newTx && !wasSavings) {
    // Became a savings deposit but wasn't one — try attach by description goal name
    const desc = newTx.description || '';
    let goalName = null;
    if (desc.startsWith('Daily Savings contribution for: ')) {
      goalName = desc.slice('Daily Savings contribution for: '.length);
    }
    if (goalName) {
      const gi = goals.findIndex((g) => g.name === goalName);
      if (gi >= 0) {
        const goal = goals[gi];
        if (!Array.isArray(goal.contributions)) goal.contributions = [];
        if (!goal.contributions.some((c) => c.id === newTx.id)) {
          goal.contributions.push({
            id: newTx.id,
            amount: Number(newTx.amount) || 0,
            dateISO: (newTx.date && String(newTx.date).slice(0, 10)) || new Date().toISOString().slice(0, 10),
            dateLabel: newTx.date || new Date().toLocaleDateString()
          });
          recalcGoalSaved(goal);
          changed = true;
        }
      }
    }
  }

  if (changed) setStorageData(KEYS.SAVINGS_GOALS, goals);
}

/** Keep savings goals in sync after a transaction is deleted on the Dashboard. */
function syncSavingsOnTxDelete(tx) {
  if (!tx) return;
  const goals = getStorageData(KEYS.SAVINGS_GOALS);
  if (!Array.isArray(goals) || !goals.length) return;
  const gi = findGoalIndexForTx(goals, tx);
  if (gi < 0) return;
  const goal = goals[gi];
  if (!Array.isArray(goal.contributions)) return;
  const before = goal.contributions.length;
  goal.contributions = goal.contributions.filter((c) => c.id !== tx.id);
  if (goal.contributions.length === before) {
    // fallback: match amount+description era without id
    if (tx.description === savingsDescForGoal(goal.name)) {
      const amt = Number(tx.amount) || 0;
      const idx = goal.contributions.findIndex((c) => Number(c.amount) === amt);
      if (idx >= 0) goal.contributions.splice(idx, 1);
    }
  }
  recalcGoalSaved(goal);
  setStorageData(KEYS.SAVINGS_GOALS, goals);
}

/** Update a contribution from the Savings page (edits matching Dashboard tx). */
function updateSavingsContribution(goalId, contribId, newAmount) {
  const goals = getStorageData(KEYS.SAVINGS_GOALS);
  const goal = goals.find((g) => g.id === goalId);
  if (!goal) return { ok: false, error: 'Goal not found.' };
  if (!Array.isArray(goal.contributions)) goal.contributions = [];
  const ci = goal.contributions.findIndex((c) => c.id === contribId);
  if (ci < 0) return { ok: false, error: 'Contribution not found.' };

  const oldAmount = Number(goal.contributions[ci].amount) || 0;
  const amt = Number(newAmount) || 0;
  if (amt <= 0) return { ok: false, error: 'Enter a valid amount.' };

  const others = goal.saved - oldAmount;
  if (others + amt > goal.target) {
    const max = Math.max(0, goal.target - others);
    return {
      ok: false,
      error: 'Amount too high. Max for this deposit: ' + formatMoney(max)
    };
  }

  goal.contributions[ci].amount = amt;
  recalcGoalSaved(goal);
  setStorageData(KEYS.SAVINGS_GOALS, goals);

  const transactions = getStorageData(KEYS.TRANSACTIONS);
  const ti = transactions.findIndex((t) => t.id === contribId);
  if (ti >= 0) {
    transactions[ti].amount = amt;
    transactions[ti].category = 'Savings Deposit';
    transactions[ti].type = 'expense';
    transactions[ti].description = savingsDescForGoal(goal.name);
    setStorageData(KEYS.TRANSACTIONS, transactions);
  }
  return { ok: true, goal };
}

/** Delete a contribution from the Savings page (also removes Dashboard tx). */
function deleteSavingsContribution(goalId, contribId) {
  const goals = getStorageData(KEYS.SAVINGS_GOALS);
  const goal = goals.find((g) => g.id === goalId);
  if (!goal) return { ok: false, error: 'Goal not found.' };
  if (!Array.isArray(goal.contributions)) goal.contributions = [];
  goal.contributions = goal.contributions.filter((c) => c.id !== contribId);
  recalcGoalSaved(goal);
  setStorageData(KEYS.SAVINGS_GOALS, goals);

  const transactions = getStorageData(KEYS.TRANSACTIONS);
  setStorageData(
    KEYS.TRANSACTIONS,
    transactions.filter((t) => t.id !== contribId)
  );
  return { ok: true, goal };
}


// --- 4. Global UI Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  // Show loading skeleton until Firebase data is pulled
  if (!isLoginPage && !_appReady) {
    document.body.classList.add('app-loading');
  }

  const currentTheme = localStorage.getItem('theme');
  const themeToggleBtn = document.getElementById('theme-toggle');

  function applyThemeIcon(isDark) {
    if (!themeToggleBtn) return;
    themeToggleBtn.textContent = isDark ? '☀️' : '🌙';
    themeToggleBtn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    themeToggleBtn.title = isDark ? 'Light Mode' : 'Dark Mode';
  }

  if (currentTheme === 'dark') {
    document.body.classList.add('dark-mode');
    applyThemeIcon(true);
  } else {
    applyThemeIcon(false);
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      const isDark = document.body.classList.contains('dark-mode');
      applyThemeIcon(isDark);
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
  }

  function doLogout() {
    auth.signOut().finally(() => {
      window.location.href = 'login.html';
    });
  }

  document.querySelectorAll('#logout-btn, .mobile-menu-logout, .btn-logout').forEach((btn) => {
    btn.addEventListener('click', doLogout);
  });

  const hamburgerBtn = document.getElementById('hamburger-btn');
  const navLinks = document.getElementById('nav-links') || document.querySelector('.nav-links');

  if (hamburgerBtn && navLinks) {
    hamburgerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = navLinks.classList.toggle('open');
      hamburgerBtn.classList.toggle('open', isOpen);
      hamburgerBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    navLinks.querySelectorAll('a.nav-link').forEach((link) => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        hamburgerBtn.classList.remove('open');
        hamburgerBtn.setAttribute('aria-expanded', 'false');
      });
    });

    document.addEventListener('click', (e) => {
      if (
        navLinks.classList.contains('open') &&
        !navLinks.contains(e.target) &&
        !hamburgerBtn.contains(e.target)
      ) {
        navLinks.classList.remove('open');
        hamburgerBtn.classList.remove('open');
        hamburgerBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  if ('Notification' in window && Notification.permission === 'default') {
    // Soft prompt later from calendar page
  }

  onAppReady(() => {
    checkCalendarReminders();
    setInterval(checkCalendarReminders, 60 * 1000);
  });
});

function checkCalendarReminders() {
  const events = getCalendarEvents();
  if (!events.length) return;

  const now = new Date();
  const notified = JSON.parse(sessionStorage.getItem('notified_events') || '[]');

  events.forEach((ev) => {
    if (!ev.date || !ev.time) return;
    const remindMin = Number(ev.remindMinutes) || 0;
    const when = new Date(`${ev.date}T${ev.time}:00`);
    if (isNaN(when.getTime())) return;

    const remindAt = new Date(when.getTime() - remindMin * 60 * 1000);
    const key = String(ev.id);

    if (now >= remindAt && now <= new Date(when.getTime() + 5 * 60 * 1000)) {
      if (notified.includes(key)) return;
      notified.push(key);
      sessionStorage.setItem('notified_events', JSON.stringify(notified));

      const title = ev.type === 'bill' ? 'Bill reminder' : 'Event reminder';
      const body = `${ev.title}${ev.description ? ' — ' + ev.description : ''} at ${ev.time}`;

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: 'images/logo 2.png' });
      }
      showInAppToast(`${title}: ${body}`);
    }
  });
}

function showInAppToast(message) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
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
