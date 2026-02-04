
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

/**
 * FIREBASE CONFIGURATION
 * 
 * IMPORTANT: If you see "Missing or insufficient permissions", you must update your 
 * Firestore Security Rules in the Firebase Console (Firestore -> Rules tab).
 * 
 * Recommended Rules for Development:
 * rules_version = '2';
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     match /{document=**} {
 *       allow read, write: if true;
 *     }
 *   }
 * }
 */

const firebaseConfig = {
  apiKey: "AIzaSyD-8VRSipqQKP7KKDRmHddJdO2NeBGZoZM",
  authDomain: "rubi-agency-crm.firebaseapp.com",
  projectId: "rubi-agency-crm",
  storageBucket: "rubi-agency-crm.firebasestorage.app",
  messagingSenderId: "229181882860",
  appId: "1:229181882860:web:d831beb730121e03ee80c9",
  measurementId: "G-XS2HXKVQJZ"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
