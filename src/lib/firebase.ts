
import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

// Validate that essential configuration, like apiKey, is present.
if (!firebaseConfig.apiKey) {
  throw new Error(
    "Firebase configuration error: The environment variable NEXT_PUBLIC_FIREBASE_API_KEY was not found or is empty. " +
    "This is critical for Firebase initialization. Please follow these steps:\n" +
    "1. Ensure a '.env.local' file exists at your project root (the same directory as package.json).\n" +
    "2. Verify it contains the line: NEXT_PUBLIC_FIREBASE_API_KEY=your_actual_api_key (and other NEXT_PUBLIC_ Firebase keys).\n" +
    "3. CRITICAL: You MUST restart your Next.js development server after creating or modifying the .env.local file for changes to take effect. Stop the server (Ctrl+C) and run 'npm run dev' (or your start command) again."
  );
}
// You can add similar checks for other critical variables like projectId if they also cause startup failures.
// For example:
// if (!firebaseConfig.projectId) {
//   throw new Error(
//     "Firebase configuration error: NEXT_PUBLIC_FIREBASE_PROJECT_ID is missing or empty. " +
//     "Please check your environment variables."
//   );
// }

// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth = getAuth(app);
const db = getFirestore(app);
const realtimeDb = getDatabase(app);

export { app, auth, db, realtimeDb };
