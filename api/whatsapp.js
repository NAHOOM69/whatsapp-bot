import whatsappweb from 'whatsapp-web.js';
const { Client, LocalAuth } = whatsappweb;
import qrcode from 'qrcode-terminal';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, query, where, getDocs, doc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';

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
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// ... (כל הפונקציות האחרות כמו getNextIndex, saveToFirestore וכו' נשארות אותו הדבר) ...

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

// Function to handle incoming messages
async function handleMessage(msg) {
    try {
        const cleanMessage = msg.body.replace(/^֠/, '').trim();

        if (cleanMessage === 'הצג הכל') {
            const allData = await getAllFromFirestore();
            console.log('All data from Firestore:', allData);
            if (allData.length > 0) {
                const response = allData.map((item) =>
                    `${item.index}. ${item.key}: ${item.value}`
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
        } else if (cleanMessage.startsWith('ערוך ')) {
            const parts = cleanMessage.slice(5).split(',');
            if (parts.length === 3) {
                const indexToUpdate = parseInt(parts[0].trim());
                const newKey = parts[1].trim();
                const newValue = parts[2].trim();

                const allData = await getAllFromFirestore();
                const docToUpdate = allData.find(item => item.index === indexToUpdate);

                if (docToUpdate) {
                    const updated = await updateFirestoreData(docToUpdate.id, newKey, newValue);
                    if (updated) {
                        msg.reply(`✅ עודכן בהצלחה: ${newKey} -> ${newValue}`);
                    } else {
                        msg.reply('❌ אירעה שגיאה בעדכון המידע');
                    }
                } else {
                    msg.reply('❌ לא נמצאה רשומה עם המזהה שצוין');
                }
            } else {
                msg.reply('❌ שגיאה: התבנית צריכה להיות "ערוך [מזהה],[שם המידע החדש],[ערך חדש]"');
            }
        } else if (cleanMessage.startsWith('מחק ')) {
            const indexToDelete = parseInt(cleanMessage.slice(4).trim());

            const allData = await getAllFromFirestore();
            const docToDelete = allData.find(item => item.index === indexToDelete);

            if (docToDelete) {
                const deleted = await deleteFromFirestore(docToDelete.id);
                if (deleted) {
                    msg.reply(`✅ נמחק בהצלחה`);
                } else {
                    msg.reply('❌ אירעה שגיאה במחיקת המידע');
                }
            } else {
                msg.reply('❌ לא נמצאה רשומה עם המזהה שצוין');
            }
        } else if (cleanMessage === 'פקודות') {
            const commands = [
                '📋 *הצג הכל* - מציג את כל המידע השמור',
                '💾 *שמור [שם המידע]: [ערך]* - שומר מידע חדש',
                '✍️ *ערוך [מזהה],[שם המידע החדש],[ערך חדש]* - עורך מידע קיים',
                '🗑️ *מחק [מזהה]* - מוחק מידע',
                '❓ *פקודות* - מציג את רשימת הפקודות'
            ];
            msg.reply(commands.join('\n'));
        } else {
            const results = await getFromFirestore(cleanMessage);
            if (results.length > 0) {
                const response = results.map(item =>
                    `🔍 ${item.key}: ${item.value} (מזהה: ${item.index})`
                ).join('\n\n');
                msg.reply(`מצאתי את המידע הבא:\n\n${response}`);
            } else {
                msg.reply('❌ לא נמצא מידע מתאים לחיפוש שלך');
            }
        }
    } catch (error) {
        console.error('Error:', error);
        msg.reply('אירעה שגיאה בעיבוד ההודעה');
    }
}

// Initialize the bot (call this only once)
async function startBot() {
    try {
        console.log('Initializing WhatsApp client...');
        await client.initialize();
        console.log('WhatsApp client initialized successfully.');
    } catch (error) {
        console.error('Error initializing WhatsApp client:', error);
    }
}

startBot(); // Call startBot() outside of the handler

// פונקציה שבודקת אם יש הודעות חדשות כל 5 שניות
async function checkNewMessages() {
    try {
        const chats = await client.getChats();
        for (const chat of chats) {
            const messages = await chat.fetchMessages({ limit: 10 }); // אפשר לשנות את ה limit
            for (const msg of messages) {
                if (!msg.fromMe && !msg.hasBeenRead) {
                    console.log(`New message from ${msg.from}: ${msg.body}`);
                    await handleMessage(msg);
                    await msg.markAsRead(); // סמן את ההודעה כנקראה
                }
            }
        }
    } catch (error) {
        console.error('Error fetching messages:', error);
    }
}

setInterval(checkNewMessages, 5000); // בדוק כל 5 שניות (5000 מילישניות)

// ה-handler הפשוט מחזיר הודעה שהבוט פעיל
export default async function handler(req, res) {
    console.log('Handler called.');
    console.log('WhatsApp bot is running.');
    res.status(200).send('WhatsApp Bot is running!');
}