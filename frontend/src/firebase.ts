import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const apiKey = process.env.REACT_APP_FIREBASE_API_KEY;
const isConfigured = apiKey && apiKey !== 'demo-key' && apiKey !== 'your-api-key';

let auth: ReturnType<typeof getAuth> | null = null;
let db: ReturnType<typeof getFirestore> | null = null;

if (isConfigured) {
  try {
    const app = initializeApp({
      apiKey,
      authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || '',
      projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || '',
      storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: process.env.REACT_APP_FIREBASE_APP_ID || '',
    });
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    console.warn('Firebase init failed:', e);
  }
} else {
  console.info('Firebase not configured — auth disabled. Set REACT_APP_FIREBASE_API_KEY in .env');
}

export { auth, db };
