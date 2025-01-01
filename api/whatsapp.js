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

// Function to get the next available index
async function getNextIndex() {
    try {
        const snapshot = await getDocs(query(collection(db, 'data'), orderBy('index', 'desc')));
        if (snapshot.empty) {
            return 1;
        } else {
            const lastDoc = snapshot.docs[0];
            return (lastDoc.data().index || 0) + 1;
        }
    } catch (error) {
        console.error('Error getting next index:', error);
        return -1; // Indicate an error
    }
}

// Function to save data to Firestore with an index
async function saveToFirestore(key, value) {
    try {
        if (!key || typeof key !== 'string' || !value || typeof value !== 'string') {
            throw new Error('Invalid key or value. Both must be non-empty strings.');
        }
        if (key.length > 100 || value.length > 500) {
            throw new Error('Key or value exceeds allowed length.');
        }

        const nextIndex = await getNextIndex();
        if (nextIndex === -1) {
            throw new Error('Failed to get next index.');
        }

        await addDoc(collection(db, 'data'), {
            index: nextIndex, // Add the index field
            key: key.trim().toLowerCase(),
            value: value.trim(),
            timestamp: Date.now()
        });

        console.log(`Data saved successfully: ${key} -> ${value} (index: ${nextIndex})`);
        return true;
    } catch (error) {
        console.error('Error saving to Firestore:', error.message);
        return false;
    }
}

// Function to get data from Firestore by partial search term
async function getFromFirestore(searchTerm) {
    try {
        const q = query(
            collection(db, 'data'),
            orderBy('key')
        );
        const snapshot = await getDocs(q);
        const results = [];
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.key.includes(searchTerm.toLowerCase())) {
                results.push({ id: doc.id, index: data.index, key: data.key, value: data.value });
            }
        });
        return results;
    } catch (error) {
        console.error('Error getting from Firestore:', error);
        return [];
    }
}

// Function to get all data from Firestore
async function getAllFromFirestore() {
    try {
        const snapshot = await getDocs(query(collection(db, 'data'), orderBy('index')));
        return snapshot.docs.map(doc => ({ id: doc.id, index: doc.data().index, key: doc.data().key, value: doc.data().value }));
    } catch (error) {
        console.error('Error getting all data:', error);
        return [];
    }
}

// Function to update data in Firestore
async function updateFirestoreData(docId, newKey, newValue) {
    try {
        const docRef = doc(db, 'data', docId);
        await updateDoc(docRef, {
            key: newKey.trim().toLowerCase(),
            value: newValue.trim(),
            timestamp: Date.now()
        });
        console.log(`Data updated successfully: ${newKey} -> ${newValue}`);
        return true;
    } catch (error) {
        console.error('Error updating data in Firestore:', error);
        return false;
    }
}

// Function to delete data from Firestore
async function deleteFromFirestore(docId) {
    try {
        const docRef = doc(db, 'data', docId);
        await deleteDoc(docRef);
        console.log(`Data deleted successfully: ${docId}`);
        return true;
    } catch (error) {
        console.error('Error deleting data from Firestore:', error);
        return false;
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
    await handleMessage(msg); // Call the message handler
});

// Function to handle incoming messages
async function handleMessage(msg) {
    try {
        const cleanMessage = msg.body.replace(/^֠/, '').trim();

        if (cleanMessage === 'הצג הכל') {
            const allData = await getAllFromFirestore();
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

// Exported handler for serverless function
export default async function handler(req, res) {
    console.log('Handler called.');

    // Check if the bot is already initialized
    if (!client.info) {
        console.log('WhatsApp client not initialized.');
        return res.status(500).send('WhatsApp client not initialized.');
    }

    console.log('WhatsApp bot is running.');

    // Respond to the request
    res.status(200).send('WhatsApp Bot is running!');
}