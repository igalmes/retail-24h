const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const Producto = require('../models/Producto');
const geminiService = require('./geminiService');

const sessions = {};

const initialize = async (userId = 1) => {
    if (sessions[userId]) return sessions[userId];

    console.log(`⏳ [BOT]: Iniciando instancia para usuario ${userId}...`);

    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: `user-session-${userId}`
        }),
        puppeteer: {
            headless: true,
            // IMPORTANTE: Dejamos que la variable de entorno PUPPETEER_CACHE_DIR maneje la ruta
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--single-process',
                '--no-zygote'
            ],
        }
    });

    client.on('qr', (qr) => {
        console.log(`✅ [BOT]: QR GENERADO PARA USUARIO ${userId}`);
        qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
        console.log(`🚀 [BOT]: WhatsApp de Usuario ${userId} conectado.`);
    });

    client.on('message_create', async (msg) => {
        if (!msg.from.endsWith('@c.us')) return;
        const textoOriginal = msg.body.trim();
        const textoLower = textoOriginal.toLowerCase();

        if (textoLower === 'ping') return msg.reply('pong! 🏓');

        // Lógica de IA/Comandos
        const tieneTriggerIA = textoLower.startsWith('bot');
        if (tieneTriggerIA && (!msg.fromMe || textoLower.startsWith('bot'))) {
            try {
                const consultaIA = textoOriginal.replace(/^bot\s*/i, "");
                const respuestaIA = await geminiService.procesarChatBot(consultaIA);
                await msg.reply(respuestaIA.mensaje);
            } catch (error) {
                console.error("❌ IA Error:", error.message);
            }
        }
    });

    await client.initialize();
    sessions[userId] = client;
    return client;
};

module.exports = { initialize, sessions };