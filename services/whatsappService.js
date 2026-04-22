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

    const chromePath = path.join(process.cwd(), '.puppeteer_cache', 'chrome', 'linux-147.0.7727.56', 'chrome-linux64', 'chrome');

    const client = new Client({
        authStrategy: new LocalAuth({ clientId: `user-session-${userId}` }),
        takeoverOnConflict: true,
        puppeteer: {
            headless: true,
            executablePath: fs.existsSync(chromePath) ? chromePath : undefined,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process', '--no-zygote'],
        }
    });

    client.on('qr', async (qr) => {
        qrcodeTerminal.generate(qr, { small: true });
        try { global.ultimoQR = await QRCodeImage.toDataURL(qr); } catch (e) {}
    });

    client.on('ready', () => { console.log(`🚀 [BOT]: WhatsApp conectado y escuchando.`); });

    client.on('message_create', async (msg) => {
        // Ignorar si no empieza con "bot" o si es un grupo (opcional)
        if (!msg.from.endsWith('@c.us') || !msg.body.toLowerCase().startsWith('bot')) return;

        try {
            const numero = msg.from.replace('@c.us', '');
            
            // 1. Buscamos al usuario para obtener contexto
            const user = await Usuario.findOne({ where: { telefono: numero } });
            if (!user) return;

            const { id: dbUsuarioId, rol, nombre, comercioId } = user;
            const consulta = msg.body.replace(/^bot\s*/i, "");

            // 2. Inventario filtrado
            const inventario = await Producto.findAll({
                where: { comercioId: comercioId },
                attributes: ['nombre', 'precio_actualizado', 'stock_actual'],
                raw: true
            });

            // 3. Llamada a Gemini 2.5
            const resIA = await geminiService.procesarChatBot(consulta, rol, inventario, nombre);

            // 4. Ejecución en DB
            if ((rol === 'admin' || rol === 'socio') && resIA.accion !== 'ninguna') {
                console.log(`🛠️ Acción: ${resIA.accion} | Producto: ${resIA.payload.nombre} | UsuarioID: ${dbUsuarioId}`);
                
                try {
                    if (resIA.accion === 'crear') {
                        await Producto.create({
                            nombre: resIA.payload.nombre,
                            precio_actualizado: resIA.payload.precio || 0,
                            stock_actual: resIA.payload.cantidad || 0,
                            comercioId: comercioId,
                            UsuarioId: dbUsuarioId // CAMBIO CLAVE: Se añade el ID de usuario obligatorio
                        });
                    } 
                    else if (resIA.accion === 'eliminar') {
                        await Producto.destroy({ 
                            where: { nombre: resIA.payload.nombre, comercioId: comercioId } 
                        });
                    }
                    else if (resIA.accion === 'actualizar') {
                        await Producto.update(
                            { precio_actualizado: resIA.payload.precio, stock_actual: resIA.payload.cantidad },
                            { where: { nombre: resIA.payload.nombre, comercioId: comercioId } }
                        );
                    }
                } catch (dbErr) {
                    console.error("❌ Error DB:", dbErr.message);
                    return await msg.reply(`Error de base de datos: ${dbErr.message}`);
                }
            }
            
            await msg.reply(resIA.mensaje);
        } catch (err) {
            console.error("❌ Error flujo bot:", err.message);
        }
    });

    client.initialize().catch(err => console.error("Error inicializando:", err));
    sessions[userId] = client;
    return client;
};

module.exports = { initialize, sessions };