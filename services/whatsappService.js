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
            // Ruta estable en Render para Chrome
            executablePath: '/usr/bin/google-chrome-stable', 
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
        console.log(`🚀 [BOT]: WhatsApp de Usuario ${userId} conectado y operando.`);
    });

    client.on('message_create', async (msg) => {
        const textoOriginal = msg.body.trim();
        const textoLower = textoOriginal.toLowerCase();

        if (!msg.from.endsWith('@c.us')) return;

        const esComandoAdmin = textoLower === 'ping' || textoLower.startsWith('stock ');
        const tieneTriggerIA = textoLower.startsWith('bot');

        if (!esComandoAdmin && !tieneTriggerIA) return;

        if (textoLower === 'ping') return msg.reply('pong! 🏓');

        if (textoLower.startsWith('stock ')) {
            const ean = textoLower.split(' ')[1];
            try {
                const producto = await Producto.findOne({ 
                    where: { codigo_barras: ean, UsuarioId: userId } 
                });
                if (!producto) return msg.reply("❌ Producto no encontrado.");
                return msg.reply(`📦 *${producto.nombre}*\n📉 Stock: ${producto.stock_actual}\n💰 Precio: $${producto.precio_sugerido}`);
            } catch (e) {
                return msg.reply("❌ Error al consultar base de datos.");
            }
        }

        if (tieneTriggerIA && (!msg.fromMe || textoLower.startsWith('bot'))) {
            try {
                const consultaIA = textoOriginal.replace(/^bot\s*/i, "");
                const respuestaIA = await geminiService.procesarChatBot(consultaIA);

                if (respuestaIA.esPedido && respuestaIA.items.length > 0) {
                    let res = `🛒 *Pedido en Comercio:* \n\n`;
                    respuestaIA.items.forEach(p => {
                        res += `- ${p.cantidad}x ${p.producto}\n`;
                    });
                    res += `\n¿Es correcto? (Responde *SÍ* para confirmar)`;
                    await msg.reply(res);
                } else {
                    await msg.reply(respuestaIA.mensaje);
                }
            } catch (error) {
                console.error("❌ Error Capa IA:", error.message);
            }
        }
    });

    await client.initialize();
    sessions[userId] = client;
    return client;
};

module.exports = { initialize, sessions };