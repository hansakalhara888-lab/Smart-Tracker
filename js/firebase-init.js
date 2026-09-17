// Initializes Firebase once, using the config from js/firebase-config.js.
// Loaded (via <script>) after the Firebase SDK and firebase-config.js,
// and before main.js on every page.
firebase.initializeApp(firebaseConfig);
// Handy shortcuts used throughout the app
const auth = firebase.auth();
const db = firebase.firestore();
// Firestore offline cache: keeps already loaded data available when connection drops.
try  {
    db.enablePersistence({
        synchronizeTabs: true
    }).catch((err) =>  {
        if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') console.warn('Offline persistence:', err);
    });
} catch (e)  {
    console.warn('Offline persistence unavailable:', e);
}
