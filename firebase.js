import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD5jf0fpog-MXZQBcCu_2D9XsrdKxuG1xk",
  authDomain: "whatsapp-bot-97e72.firebaseapp.com",
  projectId: "whatsapp-bot-97e72",
  storageBucket: "whatsapp-bot-97e72.firebasestorage.app",
  messagingSenderId: "553746243088",
  appId:"1:553746243088:web:5cbe509ceffdd37565f495"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };