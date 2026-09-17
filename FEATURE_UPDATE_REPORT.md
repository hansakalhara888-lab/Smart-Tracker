# SmartTracker Feature Update Report

Updated build features:

1. Dashboard customization
   - Summary cards can be shown/hidden individually.
   - Wallet and Financial Health sections can be shown/hidden.
   - Each Dashboard chart can be shown/hidden.
   - Preferences are stored in `app_dashboard_preferences` and sync through the same Firestore user document.

2. Bank CSV import
   - Added to Transactions.
   - Supports common Date, Description, Amount, Debit, Credit, Type, Category, Account/Wallet headings.
   - Shows a preview before import.
   - Skips exact duplicate transaction signatures already stored.
   - Imported records use the normal transaction store and Firebase sync path.

3. Global Search
   - Search button added to the app header.
   - Keyboard shortcut: Ctrl/Cmd + K.
   - Searches transactions, savings goals, budgets, recurring items, bills, subscriptions, debts/loans, wallets, calendar events, monthly reports, categories and profile fields.

4. Improved offline sync status
   - Local changes are marked as pending before cloud writes.
   - Pending datasets are preserved during cloud refresh.
   - The sync badge shows the pending-change count while offline.
   - Pending data is explicitly retried when the connection returns.
   - Account switching clears the previous user's pending-sync state.

5. PWA update notification
   - Service worker cache updated to v4.
   - New versions can wait safely instead of forcing an immediate refresh.
   - The app shows a Refresh/Later update banner when a new version is ready.

6. Data backup/restore
   - Added to Account.
   - Full JSON backup covers every SmartTracker storage dataset.
   - Restore supports Merge and Replace modes.
   - Replace mode automatically downloads a safety backup first.
   - Restored data uses the normal local + Firestore sync path.

Static validation completed:
- JavaScript syntax: passed for all JS files and service worker.
- CSS parsing: passed.
- HTML duplicate IDs: none found.
- Local HTML/CSS/JS/image/page references: no missing references found.

Note: live Firebase acknowledgement still depends on the configured Firebase project, signed-in account, Firestore rules and network connectivity. The build now exposes pending-sync state so this is easier to verify in real use.
