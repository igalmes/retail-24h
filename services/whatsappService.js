const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');
const Producto = require('../models/Producto');
const geminiService = require('./geminiService');

const sessions = {};

const initialize = async (userId = 1) => {
    if (sessions[userId]) return sessions[userId];

    console.log(`⏳ [BOT]: Iniciando instancia para usuario ${userId}...`);

    // Construimos la ruta absoluta hacia el Chrome instalado en el build de Render
    // La versión 147.0.7727.56 es la que figura en tus logs actuales
    const chromePath = path.join(
        process.cwd(), 
        '.puppeteer_cache', 
        'chrome', 
        'linux-147.0.7727.56', 
        'chrome-linux64', 
        'chrome'
    );

    console.log(`🔍 [DEBUG-PATH]: Verificando existencia de Chrome en: ${chromePath}`);

    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: `user-session-${userId}`
        }),
        puppeteer: {
            headless: true,
            // Si el archivo existe en esa ruta, lo usamos. Si no, dejamos que Puppeteer busque solo.
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

    client.on('qr', (qr) => {
        console.log(`✅ [BOT]: QR GENERADO PARA USUARIO ${userId}`);
        qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
        console.log(`🚀 [BOT]: WhatsApp de Usuario ${userId} conectado.`);
    });

    client.on('message_create', async (msg) => {
        // Ignorar mensajes que no sean de contactos individuales
        if (!msg.from.endsWith('@c.us')) return;

        const textoOriginal = msg.body.trim();
        const textoLower = textoOriginal.toLowerCase();

        // Comando simple de prueba
        if (textoLower === 'ping') return msg.reply('pong! 🏓');

        // Lógica de activación de IA
        const tieneTriggerIA = textoLower.startsWith('bot');
        
        // Respondemos si empieza con "bot" (ya sea mensaje entrante o nuestro si escribimos "bot")
        if (tieneTriggerIA && (!msg.fromMe || textoLower.startsWith('bot'))) {
            try {
                const consultaIA = textoOriginal.replace(/^bot\s*/i, "");
                
                // Si el mensaje está vacío después del "bot", no hacemos nada
                if (!consultaIA) return;

                const respuestaIA = await geminiService.procesarChatBot(consultaIA);
                await msg.reply(respuestaIA.mensaje);
            } catch (error) {
                console.error("❌ IA Error:", error.message);
            }
        }
    });

    // Manejo de errores de inicialización para que no rompa el servidor principal
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