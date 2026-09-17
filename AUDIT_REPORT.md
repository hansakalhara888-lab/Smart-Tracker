# SmartTracker Build Audit

## Changes made

- Added a personalized Dashboard welcome shown every time `index.html` opens after Firebase data is ready.
- The welcome uses the saved full name first, then Firebase display name, username, or email prefix as a fallback.
- New Email/Password accounts now initialize all SmartTracker datasets in Firestore, not only the original six datasets.
- Existing/migrated Firestore user documents automatically receive only missing dataset fields. Existing values are never overwritten by this repair.
- PWA start page changed to the Dashboard. Signed-out users are still redirected to Login by the existing auth guard.
- PWA orientation changed to `any` for desktop/mobile installed-app compatibility.
- Service worker cache version updated and external JS/CSS libraries are runtime-cached after first successful load.
- Firebase auth refresh now tolerates a temporary offline state for an already verified, locally persisted session.
- Removed a duplicate global `main` CSS block that was overriding the small-screen mobile spacing rule.
- Removed an unnecessary duplicate `font-weight` declaration in the navigation styling.

## Firestore datasets checked

All of these datasets are defined under the signed-in user's `users/{uid}` document and use the shared local-cache + Firestore save path:

1. `app_transactions`
2. `app_savings_goals`
3. `app_user_profile`
4. `app_monthly_reports`
5. `app_calendar_events`
6. `app_custom_categories`
7. `app_budgets`
8. `app_recurring_transactions`
9. `app_bills`
10. `app_subscriptions`
11. `app_debts`
12. `app_wallets`

`setStorageData()` saves to localStorage and then calls `pushToCloud()`. `saveUserProfile()` also updates localStorage and calls `pushToCloud()`.

## Static checks completed

- JavaScript syntax: PASS for every JS file and the service worker.
- CSS parsing: PASS for every CSS file.
- HTML duplicate IDs: PASS; none found.
- Local HTML/CSS/JS/image/page references: PASS; no broken local references found.
- PWA manifest: PASS (`standalone`, Dashboard start URL, unrestricted orientation).
- PWA icon dimensions: PASS (192x192, 512x512, Apple 180x180).
- Service-worker app-shell files: PASS; all listed local files exist.
- Local HTTP test: PASS; all main pages, manifest and service worker returned HTTP 200.
- Duplicate JavaScript function declarations: none found.

## Duplicate CSS note

Some CSS selectors intentionally appear more than once because later sections add theme, component, or responsive overrides. They are valid CSS and are not duplicate HTML IDs or duplicate JavaScript logic. The duplicate global `main` rule that could interfere with mobile spacing was removed.

## Important verification note

This audit verifies the source-code save paths and project structure. A true end-to-end Firestore write test still requires signing in to the deployed app with a real Firebase user and checking the Firebase Console/network connection.
