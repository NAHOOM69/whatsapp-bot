import whatsappweb from 'whatsapp-web.js';
const { Client, LocalAuth } = whatsappweb;
import qrcode from 'qrcode-terminal';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, query, where, getDocs } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// WhatsApp Client configuration
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  },
  useDeprecatedSessionAuth: true // משבית את השימוש ב-LocalWebCache
});

(async () => {
  const puppeteer = require('puppeteer');
  try {
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('Puppeteer launched successfully!');
    await browser.close();
  } catch (err) {
    console.error('Error launching Puppeteer:', err);
  }
})();



// Function to save data to Firestore
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

// Function to get data from Firestore by search term
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

// Function to get all data from Firestore
async function getAllFromFirestore() {
  try {
    const snapshot = await getDocs(collection(db, 'data'));
    return snapshot.docs.map(doc => ({ key: doc.data().key, value: doc.data().value }));
  } catch (error) {
    console.error('Error getting all data:', error);
    return [];
  }
}

// WhatsApp client events
client.on('qr', qr => {
  console.log('Event triggered: QR Code generated.');
  console.log('Please scan the QR code with WhatsApp:');
  qrcode.generate(qr, { small: true });
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
    const cleanMessage = msg.body.replace(/^֠/, '').trim();

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
    } else if (cleanMessage.startsWith('שמור ')) {
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
    } else {
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

// Function to initialize the bot
async function startBot() {
  try {
    console.log('Initializing WhatsApp client...');
    await client.initialize();
    console.log('WhatsApp client initialized successfully.');
  } catch (error) {
    console.error('Error initializing WhatsApp client:', error);
  }
}

// Automatically start the bot when the server starts
(async () => {
  console.log('Starting bot at server initialization...');
  await startBot();
})();

// Exported handler for serverless function
export default async function handler(req, res) {
  console.log('Handler called. Checking if bot needs initialization...');
  if (!client.pupPage) { // Check if the bot is initialized
    console.log('Initializing WhatsApp bot...');
    await startBot();
    res.status(200).send('WhatsApp Bot is initializing. Please check the logs for the QR code.');
  } else {
    console.log('WhatsApp bot is already running.');
    res.status(200).send('WhatsApp Bot is already running!');
  }
}
