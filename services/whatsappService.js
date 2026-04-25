const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const QRCodeImage = require('qrcode'); 
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize'); 
const Producto = require('../models/Producto');
const geminiService = require('./geminiService');
const Usuario = require('../models/Usuario');

const sessions = {};
let qrImpreso = false; 

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
        if (!qrImpreso) {
            console.log("=== NUEVO QR GENERADO (Escanealo para conectar) ===");
            qrcodeTerminal.generate(qr, { small: true });
            qrImpreso = true; 
        }
        try { 
            global.ultimoQR = await QRCodeImage.toDataURL(qr); 
        } catch (e) {
            console.error("Error generando DataURL del QR");
        }
    });

    client.on('ready', () => { 
        console.log(`🚀 [BOT]: WhatsApp conectado y escuchando.`); 
        qrImpreso = false; 
        global.ultimoQR = null; 
    });

    client.on('message_create', async (msg) => {
        if (!msg.from.endsWith('@c.us') || !msg.body.toLowerCase().startsWith('bot')) return;

        try {
            const numero = msg.from.replace('@c.us', '');
            const user = await Usuario.findOne({ where: { telefono: numero } });
            
            if (!user) {
                console.warn(`[WA-AUTH]: Número no registrado: ${numero}`);
                return;
            }

            const { id: dbUsuarioId, rol, nombre, comercioId } = user;
            const consulta = msg.body.replace(/^bot\s*/i, "").trim();

            console.log(`\n[WA-PROC]: 👤 ${nombre} | 💬 "${consulta}"`);

            // BÚSQUEDA FILTRADA
            const terminos = consulta.split(' ').filter(t => t.length > 2);
            const inventarioRelevante = await Producto.findAll({
                where: { 
                    [Op.and]: [
                        { comercioId: { [Op.in]: [comercioId, 0, 2, 3] } }, 
                        {
                            [Op.or]: [
                                { nombre: { [Op.like]: `%${terminos.join('%')}%` } },
                                { marca: { [Op.like]: `%${terminos[0] || ''}%` } }
                            ]
                        }
                    ]
                },
                attributes: ['nombre', 'marca', 'categoria', 'precio_actualizado', 'stock_actual', 'precio_sugerido', 'comercioId', 'imagen_url'], 
                limit: 30, 
                raw: true
            });

            const resIA = await geminiService.procesarChatBot(consulta, rol, inventarioRelevante, nombre, comercioId);

            // LOGICA DE BASE DE DATOS CON LOGS SEGUROS
            if ((rol === 'admin' || rol === 'socio') && resIA.accion !== 'ninguna') {
                try {
                    console.log(`[WA-DB]: Iniciando acción "${resIA.accion}" para el comercio ${comercioId}...`);

                    if (resIA.accion === 'crear') {
                        const nuevoProd = await Producto.create({
                            nombre: resIA.payload.nombre,
                            marca: resIA.payload.marca || 'S/M',
                            categoria: resIA.payload.categoria || 'General',
                            precio_actualizado: resIA.payload.precio || 0,
                            precio_sugerido: resIA.payload.precio || 0,
                            stock_actual: resIA.payload.cantidad || 0,
                            comercioId: comercioId,
                            UsuarioId: dbUsuarioId,
                            proveedor: 'BOT' // Evita errores si la columna es obligatoria
                        });
                        console.log(`✅ [WA-DB]: Producto creado con ID: ${nuevoProd.id}`);
                    } 
                    else if (resIA.accion === 'eliminar') {
                        const filas = await Producto.destroy({ 
                            where: { nombre: resIA.payload.nombre, comercioId: comercioId } 
                        });
                        console.log(`🗑️ [WA-DB]: Se eliminaron ${filas} registros.`);
                    }
                    else if (resIA.accion === 'actualizar') {
                        const [actualizados] = await Producto.update({
                            precio_actualizado: resIA.payload.precio,
                            stock_actual: resIA.payload.cantidad,
                            marca: resIA.payload.marca,
                            categoria: resIA.payload.categoria
                        }, { 
                            where: { nombre: resIA.payload.nombre, comercioId: comercioId } 
                        });
                        console.log(`🔄 [WA-DB]: Se actualizaron ${actualizados} registros.`);
                    }
                } catch (dbErr) {
                    console.error("❌ [WA-DB-ERROR]: Detalle técnico del error:");
                    console.error(dbErr.parent || dbErr.message); 
                }
            }
            
            const encabezado = `👤 *Usuario:* ${nombre}\n🛡️ *Rol:* ${rol.toUpperCase()}\n🏛️ *Comercio:* ${comercioId}\n\n`;
            const mensajeFinal = encabezado + resIA.mensaje;

            if (resIA.payload && resIA.payload.nombre) {
                const prodConImagen = inventarioRelevante.find(p => 
                    p.nombre.toLowerCase().includes(resIA.payload.nombre.toLowerCase()) && p.imagen_url
                );

                if (prodConImagen) {
                    try {
                        const media = await MessageMedia.fromUrl(prodConImagen.imagen_url);
                        await client.sendMessage(msg.from, media, { caption: mensajeFinal });
                        return; 
                    } catch (imgErr) {
                        console.error("[WA-IMG-ERROR]: No se pudo cargar la imagen de Cloudinary.");
                    }
                }
            }

            await msg.reply(mensajeFinal);

        } catch (err) {
            console.error("[WA-CRITICAL]:", err.message);
        }
    });

    client.initialize().catch(err => console.error("Error inicializando:", err));
    sessions[userId] = client;
    return client;
};

module.exports = { initialize, sessions };