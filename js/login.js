document.addEventListener('DOMContentLoaded', () =>  {
    const registerBox = document.getElementById('register-box');
    const loginBox = document.getElementById('login-box');
    const toLoginBtn = document.getElementById('to-login-btn');
    const toRegisterBtn = document.getElementById('to-register-btn');
    const forgotPasswordBtn = document.getElementById('forgot-password-btn');
    const resendVerificationBtn = document.getElementById('resend-verification-btn');
    const authStatus = document.getElementById('auth-status');
    const registerForm = document.getElementById('register-form');
    const registerError = document.getElementById('register-error');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const regAge = document.getElementById('reg-age');
    const regBirthYear = document.getElementById('reg-birth-year');
    const regBirthMonth = document.getElementById('reg-birth-month');
    const regBirthDay = document.getElementById('reg-birth-day');
    let lastUnverifiedEmail = '';
    function showError(el, message)  {
        if (!el) return;
        el.textContent = message;
        el.style.display = 'block';
    }
    function hideError(el)  {
        if (!el) return;
        el.style.display = 'none';
    }
    function showStatus(message)  {
        if (!authStatus) return;
        authStatus.textContent = message;
        authStatus.style.display = 'block';
    }
    function clearStatus()  {
        if (authStatus) authStatus.style.display = 'none';
        if (resendVerificationBtn) resendVerificationBtn.style.display = 'none';
    }
    function birthYearFromAge(ageStr)  {
        const age = parseInt(ageStr, 10);
        if (isNaN(age) || age < 1 || age > 120) return '';
        return String(new Date().getFullYear() - age);
    }
    function buildDob(year, month, day)  {
        const y = parseInt(year, 10);
        const m = parseInt(month, 10);
        const d = parseInt(day, 10);
        if (!y || m < 1 || m > 12 || d < 1 || d > 31) return '';
        const date = new Date(y, m - 1, d);
        if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return '';
        return String(y).padStart(4, '0') + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    }
    if (regAge)  {
        regAge.addEventListener('input', () =>  {
            if (!regBirthYear) return;
            // Only the YEAR is automatic. Month and day stay at 0 until the user chooses them.
            regBirthYear.value = birthYearFromAge(regAge.value.trim());
        });
    }
    if (registerBox) registerBox.style.display = 'none';
    if (loginBox) loginBox.style.display = 'block';
    const greetingEl = document.getElementById('login-greeting');
    function updateLoginGreeting()  {
        if (!greetingEl) return;
        const isRegister = registerBox && registerBox.style.display !== 'none';
        greetingEl.textContent = isRegister ? getTimeGreeting() + ' Welcome — create your account.' : getTimeGreeting() + ' Welcome back — log in to continue.';
    }
    updateLoginGreeting();
    if (toLoginBtn)  {
        toLoginBtn.addEventListener('click', (e) =>  {
            e.preventDefault();
            registerBox.style.display = 'none';
            loginBox.style.display = 'block';
            clearStatus();
            updateLoginGreeting();
        });
    }
    if (toRegisterBtn)  {
        toRegisterBtn.addEventListener('click', (e) =>  {
            e.preventDefault();
            loginBox.style.display = 'none';
            registerBox.style.display = 'block';
            clearStatus();
            updateLoginGreeting();
        });
    }
    // If an already verified user opens login.html, send them to the app.
    auth.onAuthStateChanged(async (user) =>  {
        if (!user) return;
        await user.reload();
        if (auth.currentUser && auth.currentUser.emailVerified)  {
            window.location.href = 'index.html';
        }
    });
    // Registration: real email + verification email.
    if (registerForm)  {
        registerForm.addEventListener('submit', async (e) =>  {
            e.preventDefault();
            hideError(registerError);
            clearStatus();
            const username = document.getElementById('reg-username').value.trim();
            const fullname = document.getElementById('reg-fullname').value.trim();
            const email = document.getElementById('reg-email').value.trim().toLowerCase();
            const age = document.getElementById('reg-age').value.trim();
            const birthYear = document.getElementById('reg-birth-year').value.trim();
            const birthMonth = document.getElementById('reg-birth-month').value;
            const birthDay = document.getElementById('reg-birth-day').value.trim();
            const dob = buildDob(birthYear, birthMonth, birthDay);
            const password = document.getElementById('reg-password').value;
            const confirmPassword = document.getElementById('reg-confirm-password').value;
            if (!username) return showError(registerError, 'Please choose a username.');
            if (!fullname) return showError(registerError, 'Please enter your full name.');
            if (!email) return showError(registerError, 'Please enter your email address.');
            if (!age || !birthYear) return showError(registerError, 'Please enter a valid age.');
            if (!dob) return showError(registerError, 'Please choose a valid birth month and day.');
            if (password !== confirmPassword) return showError(registerError, 'Passwords do not match!');
            if (password.length < 6) return showError(registerError, 'Password must be at least 6 characters long.');
            const submitBtn = registerForm.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;
            const profile =  {
                username, fullname, email, age: String(age), dob, job: '', country: '', phone: '', currency: 'LKR', photo: null
            };
            try  {
                const cred = await auth.createUserWithEmailAndPassword(email, password);
                window.currentUserId = cred.user.uid;
                const initialData = {
                    [KEYS.USER_PROFILE]: profile,
                    [KEYS.TRANSACTIONS]: [],
                    [KEYS.SAVINGS_GOALS]: [],
                    [KEYS.MONTHLY_REPORTS]: [],
                    [KEYS.CALENDAR_EVENTS]: [],
                    [KEYS.CUSTOM_CATEGORIES]: [],
                    [KEYS.BUDGETS]: [],
                    [KEYS.RECURRING]: [],
                    [KEYS.BILLS]: [],
                    [KEYS.SUBSCRIPTIONS]: [],
                    [KEYS.DEBTS]: [],
                    [KEYS.WALLETS]: defaultWallets()
                };
                Object.entries(initialData).forEach(([key, value]) => {
                    localStorage.setItem(key, JSON.stringify(value));
                });
                await db.collection('users').doc(cred.user.uid).set(initialData);
                await cred.user.sendEmailVerification();
                lastUnverifiedEmail = email;
                await auth.signOut();
                registerBox.style.display = 'none';
                loginBox.style.display = 'block';
                document.getElementById('login-email').value = email;
                showStatus('Account created. We sent a verification link to your email. Verify it, then log in.');
                if (resendVerificationBtn) resendVerificationBtn.style.display = 'block';
                updateLoginGreeting();
            } catch (err)  {
                showError(registerError, friendlyAuthError(err));
            } finally  {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }
    // Login: only verified email accounts can enter SmartTracker.
    if (loginForm)  {
        loginForm.addEventListener('submit', async (e) =>  {
            e.preventDefault();
            hideError(loginError);
            clearStatus();
            const email = document.getElementById('login-email').value.trim().toLowerCase();
            const password = document.getElementById('login-password').value;
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;
            try  {
                const cred = await auth.signInWithEmailAndPassword(email, password);
                await cred.user.reload();
                if (!auth.currentUser.emailVerified)  {
                    lastUnverifiedEmail = email;
                    await auth.signOut();
                    showStatus('Your email is not verified yet. Open the verification email, click the link, then log in again.');
                    if (resendVerificationBtn) resendVerificationBtn.style.display = 'block';
                    return;
                }
                window.location.href = 'index.html';
            } catch (err)  {
                showError(loginError, friendlyAuthError(err));
            } finally  {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }
    // Google: login or create an account without typing email/password.
    document.querySelectorAll('[data-google-auth]').forEach((button) =>  {
        button.addEventListener('click', async () =>  {
            hideError(loginError);
            hideError(registerError);
            clearStatus();
            button.disabled = true;
            try  {
                const provider = new firebase.auth.GoogleAuthProvider();
                provider.setCustomParameters({
                    prompt: 'select_account'
                });
                await auth.signInWithPopup(provider);
                window.location.href = 'index.html';
            } catch (err)  {
                if (err && err.code !== 'auth/popup-closed-by-user')  {
                    const target = loginBox && loginBox.style.display !== 'none' ? loginError : registerError;
                    showError(target, friendlyAuthError(err));
                }
            } finally  {
                button.disabled = false;
            }
        });
    });
    // Forgot password: Firebase emails a secure reset link.
    if (forgotPasswordBtn)  {
        forgotPasswordBtn.addEventListener('click', async (e) =>  {
            e.preventDefault();
            hideError(loginError);
            clearStatus();
            const emailInput = document.getElementById('login-email');
            const email = emailInput.value.trim().toLowerCase();
            if (!email)  {
                showError(loginError, 'Enter your email address first, then click Forgot password.');
                emailInput.focus();
                return;
            }
            try  {
                await auth.sendPasswordResetEmail(email);
                showStatus('If that email belongs to an account, a password-reset link has been sent. Check your inbox and spam folder.');
            } catch (err)  {
                // Keep this message generic so the page does not reveal which emails are registered.
                if (err && err.code === 'auth/invalid-email')  {
                    showError(loginError, 'Please enter a valid email address.');
                } else  {
                    showStatus('If that email belongs to an account, a password-reset link has been sent. Check your inbox and spam folder.');
                }
            }
        });
    }
    // Resend verification. Firebase requires a short sign-in first.
    if (resendVerificationBtn)  {
        resendVerificationBtn.addEventListener('click', async () =>  {
            const email = (lastUnverifiedEmail || document.getElementById('login-email').value).trim().toLowerCase();
            const password = document.getElementById('login-password').value;
            if (!email || !password)  {
                showError(loginError, 'Enter the same email and password, then click Resend verification email.');
                return;
            }
            resendVerificationBtn.disabled = true;
            try  {
                const cred = await auth.signInWithEmailAndPassword(email, password);
                await cred.user.reload();
                if (auth.currentUser.emailVerified)  {
                    window.location.href = 'index.html';
                    return;
                }
                await auth.currentUser.sendEmailVerification();
                await auth.signOut();
                showStatus('A new verification email was sent. Check your inbox and spam folder.');
            } catch (err)  {
                showError(loginError, friendlyAuthError(err));
            } finally  {
                resendVerificationBtn.disabled = false;
            }
        });
    }
    function friendlyAuthError(err)  {
        switch (err && err.code)  {
            case 'auth/email-already-in-use': return 'An account already exists with that email address.';
            case 'auth/invalid-email': return 'Please enter a valid email address.';
            case 'auth/weak-password': return 'Password must be at least 6 characters long.';
            case 'auth/user-disabled': return 'This account has been disabled.';
            case 'auth/popup-blocked': return 'The browser blocked the Google sign-in window. Allow popups and try again.';
            case 'auth/operation-not-allowed': return 'Google sign-in is not enabled in Firebase yet.';
            case 'auth/too-many-requests': return 'Too many attempts. Please try again later.';
            case 'auth/user-not-found': case 'auth/wrong-password': case 'auth/invalid-credential': return 'Invalid email or password.';
            default: return (err && err.message) || 'Something went wrong. Please try again.';
        }
    }
});
