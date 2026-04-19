const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const QRCodeImage = require('qrcode'); // Necesitás instalarlo: npm install qrcode
const path = require('path');
const fs = require('fs');
const Producto = require('../models/Producto');
const geminiService = require('./geminiService');

const sessions = {};

const initialize = async (userId = 1) => {
    if (sessions[userId]) return sessions[userId];

    console.log(`⏳ [BOT]: Iniciando instancia para usuario ${userId}...`);

    const chromePath = path.join(
        process.cwd(), 
        '.puppeteer_cache', 
        'chrome', 
        'linux-147.0.7727.56', 
        'chrome-linux64', 
        'chrome'
    );

    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: `user-session-${userId}`
        }),
        puppeteer: {
            headless: true,
            executablePath: fs.existsSync(chromePath) ? chromePath : undefined,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--single-process',
                '--no-zygote'
            ],
        }
    });

    client.on('qr', async (qr) => {
        console.log(`✅ [BOT]: QR GENERADO PARA USUARIO ${userId}`);
        
        // 1. Seguimos mostrándolo en consola por las dudas
        qrcodeTerminal.generate(qr, { small: true });

        // 2. Generamos la imagen para la ruta web /qr
        try {
            global.ultimoQR = await QRCodeImage.toDataURL(qr);
        } catch (err) {
            console.error("Error generando QR imagen:", err);
        }
    });

    client.on('ready', () => {
        console.log(`🚀 [BOT]: WhatsApp de Usuario ${userId} conectado.`);
        global.ultimoQR = null; // Limpiamos el QR cuando ya conectó
    });

    client.on('message_create', async (msg) => {
        if (!msg.from.endsWith('@c.us')) return;

        const textoOriginal = msg.body.trim();
        const textoLower = textoOriginal.toLowerCase();

        if (textoLower === 'ping') return msg.reply('pong! 🏓');

        const tieneTriggerIA = textoLower.startsWith('bot');
        if (tieneTriggerIA && (!msg.fromMe || textoLower.startsWith('bot'))) {
            try {
                const consultaIA = textoOriginal.replace(/^bot\s*/i, "");
                if (!consultaIA) return;

                const respuestaIA = await geminiService.procesarChatBot(consultaIA);
                await msg.reply(respuestaIA.mensaje);
            } catch (error) {
                console.error("❌ IA Error:", error.message);
            }
        }
    });

    try {
        await client.initialize();
        sessions[userId] = client;
        return client;
    } catch (err) {
        console.error(`❌ [BOT ERROR] Error al inicializar cliente ${userId}:`, err.message);
        throw err;
    }
};

module.exports = { initialize, sessions };