import whatsappweb from 'whatsapp-web.js';
const { Client, LocalAuth } = whatsappweb;
import qrcode from 'qrcode-terminal';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, query, where, getDocs } from 'firebase/firestore';

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

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// WhatsApp Client configuration
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Adjust path as needed
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

// Function to save data to Firestore
async function saveToFirestore(key, value) {
  try {
    // Validation to ensure key and value are non-empty strings
    if (!key || typeof key !== 'string' || !value || typeof value !== 'string') {
      throw new Error('Invalid key or value. Both must be non-empty strings.');
    }

    // Validate the length of key and value
    if (key.length > 100 || value.length > 500) {
      throw new Error('Key or value exceeds allowed length.');
    }

    await addDoc(collection(db, 'data'), {
      key: key.trim(),
      value: value.trim(),
      timestamp: Date.now()
    });

    console.log(`Data saved successfully: ${key} -> ${value}`);
    return true;
  } catch (error) {
    console.error('Error saving to Firestore:', error.message);
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
