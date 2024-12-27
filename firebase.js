// firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  // נשים את זה בהמשך מ-Firebase Console
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };