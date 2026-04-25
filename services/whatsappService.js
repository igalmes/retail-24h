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

    client.on('authenticated', () => {
        console.log("✅ [BOT]: Autenticado correctamente.");
        qrImpreso = true; 
    });

    client.on('message_create', async (msg) => {
        // Filtro inicial
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

            console.log(`[WA-PROC]: Usuario: ${nombre} | Consulta: "${consulta}"`);

            // 🔍 BÚSQUEDA FILTRADA (Para no saturar el contexto de Gemini)
            // Extraemos palabras clave de la consulta para buscar coincidencias en la DB
            const terminos = consulta.split(' ').filter(t => t.length > 2);
            
            const inventarioRelevante = await Producto.findAll({
    where: { 
        [Op.and]: [
            // Filtro 1: O es del comercio del usuario, o es un dato global (id 0)
            { comercioId: { [Op.in]: [comercioId, 0] } }, 
            
            // Filtro 2: Coincidencia de nombre o marca
            {
                [Op.or]: [
                    { nombre: { [Op.like]: `%${terminos[0] || ''}%` } },
                    { marca: { [Op.like]: `%${terminos[0] || ''}%` } }
                ]
            }
        ]
    },
    attributes: [
        'nombre', 
        'marca', 
        'categoria', 
        'precio_actualizado', 
        'stock_actual', 
        'precio_sugerido', // <--- Clave para el SEPA
        'comercioId'       // Para que Gemini sepa cuál es local y cuál global
    ], 
    limit: 25, 
    raw: true
});

            // Llamada a Gemini con el inventario filtrado
            const resIA = await geminiService.procesarChatBot(consulta, rol, inventarioRelevante, nombre, comercioId);

            console.log(`[WA-IA]: Accion sugerida: ${resIA.accion}`);

            // Lógica de DB (Admin/Socio)
            if ((rol === 'admin' || rol === 'socio') && resIA.accion !== 'ninguna') {
                try {
                    if (resIA.accion === 'crear') {
                        await Producto.create({
                            nombre: resIA.payload.nombre,
                            marca: resIA.payload.marca || 'S/M',
                            categoria: resIA.payload.categoria || 'General',
                            precio_actualizado: resIA.payload.precio || 0,
                            stock_actual: resIA.payload.cantidad || 0,
                            comercioId: comercioId,
                            UsuarioId: dbUsuarioId 
                        });
                    } 
                    else if (resIA.accion === 'eliminar') {
                        await Producto.destroy({ 
                            where: { nombre: resIA.payload.nombre, comercioId: comercioId } 
                        });
                    }
                    else if (resIA.accion === 'actualizar') {
                        const updateData = {
                            precio_actualizado: resIA.payload.precio,
                            stock_actual: resIA.payload.cantidad
                        };
                        if (resIA.payload.marca) updateData.marca = resIA.payload.marca;
                        if (resIA.payload.categoria) updateData.categoria = resIA.payload.categoria;

                        await Producto.update(updateData, { 
                            where: { nombre: resIA.payload.nombre, comercioId: comercioId } 
                        });
                    }
                } catch (dbErr) {
                    console.error("[WA-DB-ERROR]:", dbErr.message);
                }
            }
            
            const encabezado = `👤 *Usuario:* ${nombre}\n🛡️ *Rol:* ${rol.toUpperCase()}\n🏛️ *Comercio:* ${comercioId}\n\n`;
            const mensajeFinal = encabezado + resIA.mensaje;

            // Enviar con imagen si Gemini identificó un producto específico
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
                        console.error("[WA-IMG-ERROR]:", imgErr.message);
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