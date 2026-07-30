document.addEventListener('DOMContentLoaded', () => {
  // Already signed in (e.g. refreshed login page) → go to app
  if (auth.currentUser) {
    window.location.href = 'index.html';
    return;
  }

  const registerBox = document.getElementById('register-box');
  const loginBox = document.getElementById('login-box');
  const toLoginBtn = document.getElementById('to-login-btn');
  const toRegisterBtn = document.getElementById('to-register-btn');

  const registerForm = document.getElementById('register-form');
  const registerError = document.getElementById('register-error');

  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');

  const regAge = document.getElementById('reg-age');
  const regDob = document.getElementById('reg-dob');

  function usernameToEmail(username) {
    return `${username.trim().toLowerCase()}@moneytracker.local`;
  }

  function showError(el, message) {
    if (!el) return;
    el.textContent = message;
    el.style.display = 'block';
  }

  function hideError(el) {
    if (!el) return;
    el.style.display = 'none';
  }

  function calcAgeFromDob(dobStr) {
    if (!dobStr) return '';
    const dob = new Date(dobStr + 'T00:00:00');
    if (isNaN(dob.getTime())) return '';
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age >= 0 ? String(age) : '';
  }

  function calcDobFromAge(ageStr) {
    const age = parseInt(ageStr, 10);
    if (isNaN(age) || age < 0 || age > 120) return '';
    const today = new Date();
    const year = today.getFullYear() - age;
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${year}-${m}-${d}`;
  }

  let syncingAgeDob = false;

  if (regAge) {
    regAge.addEventListener('input', () => {
      if (syncingAgeDob) return;
      const dob = calcDobFromAge(regAge.value.trim());
      if (!dob || !regDob) return;
      syncingAgeDob = true;
      regDob.value = dob;
      syncingAgeDob = false;
    });
  }

  if (regDob) {
    regDob.addEventListener('change', () => {
      if (syncingAgeDob) return;
      const age = calcAgeFromDob(regDob.value);
      if (age === '' || !regAge) return;
      syncingAgeDob = true;
      regAge.value = age;
      syncingAgeDob = false;
    });
    regDob.addEventListener('input', () => {
      if (syncingAgeDob) return;
      const age = calcAgeFromDob(regDob.value);
      if (age === '' || !regAge) return;
      syncingAgeDob = true;
      regAge.value = age;
      syncingAgeDob = false;
    });
  }

  if (registerBox) registerBox.style.display = 'none';
  if (loginBox) loginBox.style.display = 'block';

  // Time-based greeting on login / register
  const greetingEl = document.getElementById('login-greeting');
  function updateLoginGreeting() {
    if (!greetingEl) return;
    const isRegister = registerBox && registerBox.style.display !== 'none';
    if (isRegister) {
      greetingEl.textContent = getTimeGreeting() + ' Welcome — create your account.';
    } else {
      greetingEl.textContent = getTimeGreeting() + ' Welcome back — Login in to continue.';
    }
  }
  updateLoginGreeting();

  if (toLoginBtn) {
    toLoginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      registerBox.style.display = 'none';
      loginBox.style.display = 'block';
      updateLoginGreeting();
    });
  }

  if (toRegisterBtn) {
    toRegisterBtn.addEventListener('click', (e) => {
      e.preventDefault();
      loginBox.style.display = 'none';
      registerBox.style.display = 'block';
      updateLoginGreeting();
    });
  }

  // Registration
  if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      hideError(registerError);

      const username = document.getElementById('reg-username').value.trim();
      const fullname = document.getElementById('reg-fullname').value.trim();
      let age = document.getElementById('reg-age').value.trim();
      let dob = document.getElementById('reg-dob').value;
      const password = document.getElementById('reg-password').value;
      const confirmPassword = document.getElementById('reg-confirm-password').value;

      if (dob && !age) age = calcAgeFromDob(dob);
      if (age && !dob) dob = calcDobFromAge(age);
      if (dob && age) {
        age = calcAgeFromDob(dob) || age;
      }

      if (!username) {
        showError(registerError, 'Please choose a username.');
        return;
      }
      if (!fullname) {
        showError(registerError, 'Please enter your full name.');
        return;
      }
      if (!age || !dob) {
        showError(registerError, 'Please enter age or birthday (the other fills in automatically).');
        return;
      }
      if (password !== confirmPassword) {
        showError(registerError, 'Passwords do not match!');
        return;
      }
      if (password.length < 6) {
        showError(registerError, 'Password must be at least 6 characters long.');
        return;
      }

      const submitBtn = registerForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      const profile = {
        username,
        fullname,
        age: String(age),
        dob,
        job: '',
        country: '',
        phone: '',
        currency: 'LKR',
        photo: null
      };

      auth
        .createUserWithEmailAndPassword(usernameToEmail(username), password)
        .then(async (cred) => {
          localStorage.setItem(KEYS.USER_PROFILE, JSON.stringify(profile));
          localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify([]));
          localStorage.setItem(KEYS.SAVINGS_GOALS, JSON.stringify([]));
          localStorage.setItem(KEYS.MONTHLY_REPORTS, JSON.stringify([]));
          localStorage.setItem(KEYS.CALENDAR_EVENTS, JSON.stringify([]));
          localStorage.setItem(KEYS.CUSTOM_CATEGORIES, JSON.stringify([]));

          window.currentUserId = cred.user.uid;

          await db.collection('users').doc(cred.user.uid).set({
            [KEYS.USER_PROFILE]: profile,
            [KEYS.TRANSACTIONS]: [],
            [KEYS.SAVINGS_GOALS]: [],
            [KEYS.MONTHLY_REPORTS]: [],
            [KEYS.CALENDAR_EVENTS]: [],
            [KEYS.CUSTOM_CATEGORIES]: []
          });
        })
        .then(() => {
          window.location.href = 'index.html';
        })
        .catch((err) => {
          if (submitBtn) submitBtn.disabled = false;
          showError(registerError, friendlyAuthError(err));
        });
    });
  }

  // Login
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      hideError(loginError);

      const enteredUsername = document.getElementById('login-username').value.trim();
      const enteredPassword = document.getElementById('login-password').value;

      const submitBtn = loginForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      auth
        .signInWithEmailAndPassword(usernameToEmail(enteredUsername), enteredPassword)
        .then(() => {
          window.location.href = 'index.html';
        })
        .catch((err) => {
          if (submitBtn) submitBtn.disabled = false;
          showError(loginError, friendlyAuthError(err));
        });
    });
  }

  function friendlyAuthError(err) {
    switch (err && err.code) {
      case 'auth/email-already-in-use':
        return 'That username is already taken.';
      case 'auth/invalid-email':
        return 'Please enter a valid username.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters long.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Invalid username or password.';
      default:
        return (err && err.message) || 'Something went wrong. Please try again.';
    }
  }
});
