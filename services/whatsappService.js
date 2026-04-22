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
    const numeroWhatsApp = msg.from.replace('@c.us', '');

    if (textoLower.startsWith('bot')) {
        try {
            // 1. Identificar al usuario en la DB
            const usuario = await Usuario.findOne({ where: { telefono: numeroWhatsApp } });
            const rol = usuario ? usuario.rol : 'cliente';
            const nombre = usuario ? usuario.nombre : 'Cliente';

            const consultaIA = textoOriginal.replace(/^bot\s*/i, "");

            // 2. ¿La consulta requiere datos de la DB? (Palabras clave)
            let datosDB = [];
            const disparadoresDB = ['stock', 'inventario', 'lista', 'precio', 'cuanto', 'hay', 'vende'];
            
            if (disparadoresDB.some(palabra => textoLower.includes(palabra))) {
                datosDB = await Producto.findAll({
                    attributes: ['nombre', 'precio_actualizado', 'stock_actual'],
                    raw: true
                });
            }

            // 3. Procesar con Gemini pasando la data real
            const respuestaIA = await geminiService.procesarChatBot(consultaIA, rol, datosDB, nombre);
            
            await msg.reply(respuestaIA.mensaje);

        } catch (error) {
            console.error("❌ Error en flujo Bot:", error);
            await msg.reply("Lo siento, hubo un error al consultar mi base de datos. 🤖");
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