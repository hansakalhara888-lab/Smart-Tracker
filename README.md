# Money Tracker — Firebase Setup

This app now saves everything (login, transactions, savings goals, calendar
events, monthly reports, profile) to a real cloud database — **Firebase**
(Google's free backend-as-a-service). There is no server to host: it's just
static HTML/JS files that talk to Firebase directly, so you can run it
locally, share the repo on GitHub, or drop it on any static host later.

## 1. Create a free Firebase project

1. Go to https://console.firebase.google.com and click **Add project**
   (the free "Spark" plan is enough).
2. Once created, click the **`</>`** (Web) icon to register a web app.
   You don't need Firebase Hosting — just registering the app is enough.
3. Firebase will show you a `firebaseConfig` object. Copy your real values
   into `js/firebase-config.js` in this project (replace the placeholders).

## 2. Turn on Authentication

In the Firebase console: **Build → Authentication → Sign-in method** →
enable **Email/Password**.

SmartTracker now uses each user's **real email address** for Firebase Authentication.
New accounts receive a Firebase verification email, and the app blocks access until
the user verifies that email. The login screen also includes **Forgot password?**,
which sends Firebase's secure password-reset email.

## 3. Turn on Firestore (the database)

**Build → Firestore Database → Create database** → start in
**production mode** → pick any region.

Then go to the **Rules** tab and replace the default rules with this, so
each user can only ever read/write their *own* data:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Click **Publish**.

## 4. Run the app

Since the app now makes network calls (to Firebase), opening `index.html`
directly by double-clicking it can be blocked by the browser in some
setups. The safest way is to serve the folder locally, e.g.:

```
npx serve .
```

or, with Python:

```
python3 -m http.server 8000
```

Then open the printed `localhost` URL in your browser. Register an account on the login screen, open the verification email, click the
verification link, and then log in. Your data is saved to Firestore
under `users/<your-uid>` and will follow you to any browser/device you log
in from.

## How it works (for reference)

- `js/firebase-config.js` / `js/firebase-init.js` — connect the app to your
  Firebase project.
- `js/login.js` — sign up / log in using Firebase Authentication.
- `js/main.js` — on login, pulls your Firestore document down into
  `localStorage` as a fast local cache, then every save (`setStorageData`,
  `saveUserProfile`) writes to both `localStorage` and Firestore. All the
  other pages (`dashboard.js`, `savings.js`, `calendar.js`, `reports.js`,
  `account.js`) didn't need to change how they read/write data — they still
  just call `getStorageData()` / `setStorageData()` like before.

## Sharing this on GitHub

The values in `js/firebase-config.js` are safe to commit — they're not
secret, they just identify which Firebase project to use. Real security
comes from the Firestore rules above, which make sure nobody can read or
write another user's data. Just don't commit any real user passwords or
personal test data if you keep test accounts in Firestore.


## 2026 cleanup/update
- Dashboard transaction list and income/expense totals now show the current month only. Historical transactions are NOT deleted; Reports still use the full saved history and wallet balances remain cumulative.
- Firebase remains the source of truth; all app data arrays/profile are synced under `users/{uid}`.
- Google sign-in button added. In Firebase Console, enable Authentication > Sign-in method > Google and choose a support email. Also authorize your deployed domain.
- Login birthday entry now auto-generates only the birth year from Age. Month/day stay user-selected instead of being guessed from today's date.
- Each HTML page now has a dedicated CSS file plus `css/main.css` for shared styles. Each page keeps its own JS file plus `js/main.js` for shared code.
- Password visibility buttons and account email display added.


## Monthly accounting behaviour
- Dashboard shows only current-month transactions, while all historical transactions remain stored in Firebase.
- Current Balance = Month Opening Balance + This Month Income - This Month Expenses.
- Savings target creation does not change money. A savings contribution creates a Savings Deposit expense transaction and records the selected wallet.
- Monthly report archives are rebuilt from saved transactions so stale totals are corrected automatically.


## SmartTracker feature expansion
This build adds monthly budgets, recurring transactions, bills/reminders, advanced savings goals and emergency funds, debt/loan tracking, subscriptions, dashboard charts, month comparison, yearly reports, CSV/PDF export, transaction search/filtering, custom wallets with opening balances, financial health score, calendar finance activity, offline Firestore persistence, sync status, theme preference, currency and date-format preferences. All app datasets are stored under the signed-in Firebase user's Firestore document.


## Install SmartTracker as an App (PWA)

This project includes a web app manifest, service worker and app icons, so SmartTracker can be installed as a Progressive Web App (PWA).

### Requirements

- Serve the project from `localhost` during development or from an HTTPS website when deployed.
- Do not open the HTML files directly with `file://`.

### Install on Android / Desktop Chrome

1. Open SmartTracker in Chrome.
2. Use the browser menu and choose **Install app** or **Add to Home screen**.
3. SmartTracker will open in its own standalone app window.

The service worker caches the local application shell for faster loading and basic offline access. Firebase Authentication and cloud synchronization still require a network connection for operations that contact Firebase.

### PWA files

- `manifest.json` — app name, colors, start page and icons.
- `service-worker.js` — caches local app pages and assets.
- `icons/` — install icons used by supported browsers and devices.

## Current build notes

- The Dashboard shows a personalized time-based welcome using the signed-in user's saved full name/username.
- New accounts initialize every SmartTracker dataset in Firestore, including budgets, recurring transactions, bills, subscriptions, debts and wallets.
- Existing/migrated user documents are repaired only for missing dataset fields; existing data is not overwritten.
- The PWA starts at the Dashboard, redirects signed-out users to Login, supports standalone installation, and uses an unrestricted orientation for desktop/mobile app windows.
- Savings remain separate from normal expenses in monthly Dashboard and reporting calculations.



## 2026 product improvements

- Dashboard customization: users can choose which summary cards, sections and charts are visible; preferences sync through Firestore.
- Bank CSV import: Transactions can import common bank-statement CSV layouts with preview and duplicate skipping.
- Global Search: use the search button or Ctrl/Cmd + K to search across SmartTracker datasets.
- Improved offline sync status: pending local changes are counted and retried when connectivity returns.
- PWA update prompt: installed users are notified when a new app-shell version is ready and can refresh to activate it.
- Account backup/restore: full JSON backup and merge/replace restore are available from the Account page.
