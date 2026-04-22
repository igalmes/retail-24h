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
        qrcodeTerminal.generate(qr, { small: true });
        try {
            global.ultimoQR = await QRCodeImage.toDataURL(qr);
        } catch (err) {
            console.error("Error generando QR imagen:", err);
        }
    });

    client.on('ready', () => {
        console.log(`🚀 [BOT]: WhatsApp de Usuario ${userId} conectado.`);
        global.ultimoQR = null;
    });

    client.on('message_create', async (msg) => {
        if (!msg.from.endsWith('@c.us')) return;

        const textoOriginal = msg.body.trim();
        const textoLower = textoOriginal.toLowerCase();
        
        if (textoLower.startsWith('bot')) {
            try {
                const numeroWhatsApp = msg.from.replace('@c.us', '');
                
                // 1. Identificación de usuario
                const usuario = await Usuario.findOne({ where: { telefono: numeroWhatsApp } });
                const rol = usuario ? usuario.rol : 'cliente';
                const nombre = usuario ? usuario.nombre : 'Cliente';

                const consultaIA = textoOriginal.replace(/^bot\s*/i, "");
                if (!consultaIA) return;

                // 2. Obtener inventario para contexto
                const datosDB = await Producto.findAll({
                    attributes: ['nombre', 'precio_actualizado', 'stock_actual'],
                    raw: true
                });

                // 3. Procesar con Gemini
                const respuestaIA = await geminiService.procesarChatBot(consultaIA, rol, datosDB, nombre);
                
                // 4. EJECUCIÓN DE ACCIONES (Solo para ADMIN/SOCIO)
                if ((rol === 'admin' || rol === 'socio') && respuestaIA.accion !== 'ninguna') {
                    console.log(`🛠️ Ejecutando acción DB: ${respuestaIA.accion} sobre ${respuestaIA.payload.nombre}`);
                    
                    try {
                        if (respuestaIA.accion === 'crear') {
                            await Producto.create({
                                nombre: respuestaIA.payload.nombre,
                                precio_actualizado: respuestaIA.payload.precio || 0,
                                stock_actual: respuestaIA.payload.cantidad || 0
                            });
                        } 
                        else if (respuestaIA.accion === 'eliminar') {
                            await Producto.destroy({
                                where: { nombre: respuestaIA.payload.nombre }
                            });
                        }
                        else if (respuestaIA.accion === 'actualizar') {
                            await Producto.update(
                                { 
                                    precio_actualizado: respuestaIA.payload.precio, 
                                    stock_actual: respuestaIA.payload.cantidad 
                                },
                                { where: { nombre: respuestaIA.payload.nombre } }
                            );
                        }
                    } catch (dbError) {
                        console.error("❌ Error ejecutando en DB:", dbError);
                        return await msg.reply("Error al intentar modificar la base de datos.");
                    }
                }

                // 5. Enviar respuesta final
                await msg.reply(respuestaIA.mensaje);

            } catch (error) {
                console.error("❌ Error en flujo Bot:", error);
                await msg.reply("Lo siento, hubo un error técnico. 🤖");
            }
        }
    });

    try {
        await client.initialize();
        sessions[userId] = client;
        return client;
    } catch (err) {
        console.error(`❌ [BOT ERROR]:`, err.message);
        throw err;
    }
};

module.exports = { initialize, sessions };