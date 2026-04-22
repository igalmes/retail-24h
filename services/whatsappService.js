const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const QRCodeImage = require('qrcode'); 
const path = require('path');
const fs = require('fs');
const Producto = require('../models/Producto');
const geminiService = require('./geminiService');
const Usuario = require('../models/Usuario');

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
        // Ignorar mensajes de grupos si se desea, o solo procesar chats individuales
        if (!msg.from.endsWith('@c.us')) return;

        const textoOriginal = msg.body.trim();
        const textoLower = textoOriginal.toLowerCase();
        
        // El trigger puede venir de otros o de vos mismo escribiendo "bot..."
        const tieneTriggerIA = textoLower.startsWith('bot');

        if (tieneTriggerIA) {
            try {
                // Obtenemos el número limpio (sin @c.us)
                const numeroWhatsApp = msg.from.replace('@c.us', '');
                
                // 1. Identificar al usuario en la DB para conocer su ROL
                const usuario = await Usuario.findOne({ where: { telefono: numeroWhatsApp } });
                const rol = usuario ? usuario.rol : 'cliente';
                const nombre = usuario ? usuario.nombre : 'Cliente';

                const consultaIA = textoOriginal.replace(/^bot\s*/i, "");
                if (!consultaIA) return;

                // 2. ¿La consulta requiere datos de la DB? (Basado en palabras clave)
                let datosDB = [];
                const disparadoresDB = ['stock', 'inventario', 'lista', 'precio', 'cuanto', 'hay', 'vende', 'resumen'];
                
                if (disparadoresDB.some(palabra => textoLower.includes(palabra))) {
                    datosDB = await Producto.findAll({
                        attributes: ['nombre', 'marca', 'precio_actualizado', 'stock_actual'],
                        raw: true
                    });
                }

                // 3. Procesar con Gemini pasando la data real, el rol y el nombre
                const respuestaIA = await geminiService.procesarChatBot(consultaIA, rol, datosDB, nombre);
                
                // Respondemos con el mensaje procesado por la IA
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