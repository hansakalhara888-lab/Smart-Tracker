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

(The app's login screen only asks for a username, but under the hood it
turns that into a fake email like `yourname@moneytracker.local` — you don't
need to change anything, this is handled in `js/login.js`.)

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

Then open the printed `localhost` URL in your browser. Register an account
on the login screen and you're in — your data is now saved to Firestore
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
