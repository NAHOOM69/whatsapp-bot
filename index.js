import whatsappweb from 'whatsapp-web.js';
const { Client, LocalAuth } = whatsappweb;
import qrcode from 'qrcode-terminal';
import express from 'express';
import { initializeApp, getFirestore, collection, addDoc, query, where, getDocs } from 'firebase/firestore';

const app = express();
const port = process.env.PORT || 3000;

const firebaseConfig = {
  apiKey: "AIzaSyD5jf0fpog-MXZQBcCu_2D9XsrdKxuG1xk",
  authDomain: "whatsapp-bot-97e72.firebaseapp.com",
  projectId: "whatsapp-bot-97e72",
  storageBucket: "whatsapp-bot-97e72.firebasestorage.app",
  messagingSenderId: "553746243088",
  appId: "1:553746243088:web:5cbe509ceffdd37565f495"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox']
  }
});

app.get('/', (req, res) => {
  res.send('WhatsApp Bot is running!');
});

async function saveToFirestore(key, value) {
  try {
    await addDoc(collection(db, 'data'), {
      key,
      value,
      timestamp: Date.now()
    });
    return true;
  } catch (error) {
    console.error('Error saving to Firestore:', error);
    return false;
  }
}

async function getFromFirestore(searchTerm) {
  try {
    const q = query(
      collection(db, 'data'),
      where('key', '>=', searchTerm.toLowerCase()),
      where('key', '<=', searchTerm.toLowerCase() + '\uf8ff')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ key: doc.data().key, value: doc.data().value }));
  } catch (error) {
    console.error('Error getting from Firestore:', error);
    return [];
  }
}

async function getAllFromFirestore() {
  try {
    const snapshot = await getDocs(collection(db, 'data'));
    return snapshot.docs.map(doc => ({ key: doc.data().key, value: doc.data().value }));
  } catch (error) {
    console.error('Error getting all data:', error);
    return [];
  }
}

client.on('qr', qr => {
  qrcode.generate(qr, { small: true });
  console.log('QR Code generated. Please scan it with WhatsApp.');
});

client.on('loading_screen', (percent, message) => {
  console.log('Loading:', percent, '%', message);
});

client.on('authenticated', () => {
  console.log('Authenticated successfully!');
});

client.on('ready', () => {
  console.log('Bot is ready and waiting for messages!');
});

client.on('disconnected', (reason) => {
  console.log('Client was disconnected:', reason);
});

client.on('message', async msg => {
  console.log('New message received:', msg.body);

  try {
    const cleanMessage = msg.body.replace(/^\u05A0/, '').trim();

    if (cleanMessage === 'הצג הכל') {
      const allData = await getAllFromFirestore();
      if (allData.length > 0) {
        const response = allData.map((item, index) =>
          `${index + 1}. ${item.key}: ${item.value}`
        ).join('\n\n');
        msg.reply(`📋 כל המידע השמור:\n\n${response}`);
      } else {
        msg.reply('אין עדיין מידע שמור במערכת');
      }
    }
    else if (cleanMessage.startsWith('שמור ')) {
      const parts = cleanMessage.slice(5).split(':');
      if (parts.length === 2) {
        const key = parts[0].trim();
        const value = parts[1].trim();
        const saved = await saveToFirestore(key, value);
        if (saved) {
          msg.reply(`✅ נשמר בהצלחה: ${key} -> ${value}`);
        } else {
          msg.reply('❌ אירעה שגיאה בשמירת המידע');
        }
      } else {
        msg.reply('❌ שגיאה: התבנית צריכה להיות "שמור [שם המידע]: [ערך]"');
      }
    }
    else {
      const results = await getFromFirestore(cleanMessage);
      if (results.length > 0) {
        const response = results.map(item =>
          `🔍 ${item.key}: ${item.value}`
        ).join('\n\n');
        msg.reply(`מצאתי את המידע הבא:\n\n${response}`);
      } else {
        msg.reply('❌ לא נמצא מידע מתאים');
      }
    }
  } catch (error) {
    console.error('Error:', error);
    msg.reply('אירעה שגיאה בעיבוד ההודעה');
  }
});

client.initialize();

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    // בדיקה שהסקריפט הגיע לפה
    console.log(`script fully loaded`);
});