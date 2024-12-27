const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { google } = require('googleapis');
const fs = require('fs');
const express = require('express');
const app = express();
const port = 3000;

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const TOKEN_PATH = 'token.json';
const CREDENTIALS_PATH = 'credentials.json';
const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));

// הגדרת שרת Express
app.get('/', (req, res) => {
    const code = req.query.code;
    if (code) {
        res.send('Authorization successful! You can close this window.');
        global.authCode = code;
    } else {
        res.send('No authorization code received.');
    }
});

const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

async function authorize() {
    const { client_secret, client_id } = credentials.web;
    const oAuth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        'http://localhost:3000'
    );

    try {
        if (fs.existsSync(TOKEN_PATH)) {
            const token = fs.readFileSync(TOKEN_PATH);
            oAuth2Client.setCredentials(JSON.parse(token));
            return oAuth2Client;
        }
        return await getNewToken(oAuth2Client);
    } catch (err) {
        return await getNewToken(oAuth2Client);
    }
}

async function getNewToken(oAuth2Client) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    
    const code = await new Promise((resolve) => {
        const checkCode = setInterval(() => {
            if (global.authCode) {
                clearInterval(checkCode);
                resolve(global.authCode);
            }
        }, 1000);
    });

    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
    console.log('Token stored to', TOKEN_PATH);
    return oAuth2Client;
}

async function saveToSheet(auth, key, value) {
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '1W193zXhaDQgraE1DRhi1e5gJ4hMHbvUSo-imnxzDymI';
    await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Sheet1!A:B',
        valueInputOption: 'RAW',
        resource: {
            values: [[key, value]],
        },
    });
}

async function getFromSheet(auth, key) {
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '1W193zXhaDQgraE1DRhi1e5gJ4hMHbvUSo-imnxzDymI';
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Sheet1!A:B',
    });
    const rows = res.data.values || [];
    const found = rows.find((row) => row[0] === key);
    return found ? found[1] : 'לא נמצא';
}

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox']
    }
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    console.log('QR Code generated. Please scan it with WhatsApp.');
});

// הוספת לוגים לדיבאג
client.on('loading_screen', (percent, message) => {
    console.log('Loading:', percent, '%', message);
});

client.on('authenticated', () => {
    console.log('Authenticated successfully!');
});

client.on('ready', () => {
    console.log('Bot is ready and waiting for messages!');
});

// הוספת טיפול בשגיאות
client.on('disconnected', (reason) => {
    console.log('Client was disconnected:', reason);
});

async function ensureAuth() {
    try {
        const auth = await authorize();
        // בדיקת תקינות הטוקן
        const sheets = google.sheets({ version: 'v4', auth });
        await sheets.spreadsheets.values.get({
            spreadsheetId: '1W193zXhaDQgraE1DRhi1e5gJ4hMHbvUSo-imnxzDymI',
            range: 'Sheet1!A1',
        });
        return auth;
    } catch (error) {
        console.log('Auth error, getting new token...');
        return await getNewToken(new google.auth.OAuth2(
            credentials.web.client_id,
            credentials.web.client_secret,
            'http://localhost:3000'
        ));
    }
}

// עדכון הקוד של הטיפול בהודעות
// [כל הקוד הקיים עד client.on('message') נשאר אותו דבר]

// רק event listener אחד להודעות
client.on('message', async msg => {
    console.log('New message received:', msg.body);
    
    try {
        const auth = await ensureAuth();
        const cleanMessage = msg.body.replace(/^\u05A0/, '').trim();
        
        // פקודה להצגת כל המידע
        if (cleanMessage === 'הצג הכל') {
            const sheets = google.sheets({ version: 'v4', auth });
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: '1W193zXhaDQgraE1DRhi1e5gJ4hMHbvUSo-imnxzDymI',
                range: 'Sheet1!A:B',
            });
            
            const rows = res.data.values || [];
            if (rows.length > 0) {
                const dataRows = rows.slice(1);
                if (dataRows.length > 0) {
                    const response = dataRows.map((row, index) => 
                        `${index + 1}. ${row[0]}: ${row[1]}`
                    ).join('\n\n');
                    msg.reply(`📋 כל המידע השמור:\n\n${response}`);
                } else {
                    msg.reply('אין עדיין מידע שמור בקובץ');
                }
            } else {
                msg.reply('אין עדיין מידע שמור בקובץ');
            }
        }
        // פקודת שמירה
        else if (cleanMessage.startsWith('שמור ')) {
            const parts = cleanMessage.slice(5).split(':');
            if (parts.length === 2) {
                const key = parts[0].trim();
                const value = parts[1].trim();
                await saveToSheet(auth, key, value);
                msg.reply(`✅ נשמר בהצלחה: ${key} -> ${value}`);
                console.log('Data saved:', { key, value });
            } else {
                msg.reply('❌ שגיאה: התבנית צריכה להיות "שמור [שם המידע]: [ערך]"');
            }
        }
        // חיפוש מידע
        else {
            const searchTerm = cleanMessage;
            console.log('Searching for:', searchTerm);
            
            const sheets = google.sheets({ version: 'v4', auth });
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: '1W193zXhaDQgraE1DRhi1e5gJ4hMHbvUSo-imnxzDymI',
                range: 'Sheet1!A:B',
            });
            
            const rows = res.data.values || [];
            const found = rows.filter(row => 
                row[0]?.toLowerCase().includes(searchTerm.toLowerCase())
            );
            
            if (found.length > 0) {
                const response = found.map(row => 
                    `🔍 ${row[0]}: ${row[1]}`
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