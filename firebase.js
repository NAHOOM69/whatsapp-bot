import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD5jf0fpog-MXZQBcCu_2D9XsrdKxuG1xk",
  authDomain: "whatsapp-bot-97e72.firebaseapp.com",
  databaseURL: "https://whatsapp-bot-97e72-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "whatsapp-bot-97e72",
  storageBucket: "whatsapp-bot-97e72.firebasestorage.app",
  messagingSenderId: "553746243088",
  appId: "1:553746243088:web:5cbe509ceffdd37565f495",
  measurementId: "G-EPM8RCKQTC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const analytics = getAnalytics(app);

// Export Firestore instance for use in other files
export { db };
