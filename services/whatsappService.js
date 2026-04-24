const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const QRCodeImage = require('qrcode'); 
const path = require('path');
const fs = require('fs');
const Producto = require('../models/Producto');
const geminiService = require('./geminiService');
const Usuario = require('../models/Usuario');

const sessions = {};
let qrImpreso = false; // Flag para controlar que el QR no sature los logs de Render

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

    // Evento QR: Solo se imprime en consola una vez por sesión/reinicio
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
        // Log de entrada
        if (msg.body.toLowerCase().startsWith('bot')) {
            console.log(`[WA-IN]: Mensaje de ${msg.from}: "${msg.body}"`);
        }

        // Filtro de seguridad
        if (!msg.from.endsWith('@c.us') || !msg.body.toLowerCase().startsWith('bot')) return;

        try {
            const numero = msg.from.replace('@c.us', '');
            const user = await Usuario.findOne({ where: { telefono: numero } });
            
            if (!user) {
                console.warn(`[WA-AUTH]: Número no registrado: ${numero}`);
                return;
            }

            const { id: dbUsuarioId, rol, nombre, comercioId } = user;
            const consulta = msg.body.replace(/^bot\s*/i, "");

            console.log(`[WA-PROC]: Usuario: ${nombre} | Rol: ${rol} | Comercio: ${comercioId}`);

            // Traemos solo los productos de ESTE comercio
            const inventario = await Producto.findAll({
                where: { comercioId: comercioId },
                attributes: ['nombre', 'precio_actualizado', 'stock_actual', 'imagen_url'], 
                raw: true
            });

            // Llamada a Gemini con contexto completo
            const resIA = await geminiService.procesarChatBot(consulta, rol, inventario, nombre, comercioId);

            console.log(`[WA-IA]: Accion: ${resIA.accion}`);

            // Lógica de DB (Solo para admin/socio)
            if ((rol === 'admin' || rol === 'socio') && resIA.accion !== 'ninguna') {
                try {
                    if (resIA.accion === 'crear') {
                        await Producto.create({
                            nombre: resIA.payload.nombre,
                            precio_actualizado: resIA.payload.precio || 0,
                            stock_actual: resIA.payload.cantidad || 0,
                            comercioId: comercioId,
                            UsuarioId: dbUsuarioId 
                        });
                        console.log(`[WA-DB]: "${resIA.payload.nombre}" CREADO.`);
                    } 
                    else if (resIA.accion === 'eliminar') {
                        await Producto.destroy({ 
                            where: { nombre: resIA.payload.nombre, comercioId: comercioId } 
                        });
                        console.log(`[WA-DB]: "${resIA.payload.nombre}" ELIMINADO.`);
                    }
                    else if (resIA.accion === 'actualizar') {
                        await Producto.update(
                            { precio_actualizado: resIA.payload.precio, stock_actual: resIA.payload.cantidad },
                            { where: { nombre: resIA.payload.nombre, comercioId: comercioId } }
                        );
                        console.log(`[WA-DB]: "${resIA.payload.nombre}" ACTUALIZADO.`);
                    }
                } catch (dbErr) {
                    console.error("[WA-DB-ERROR]:", dbErr.message);
                }
            }
            
            // --- CONSTRUCCIÓN DE RESPUESTA PERSONALIZADA ---
            // Siempre incluimos quién eres al principio
            const encabezado = `👤 *Usuario:* ${nombre}\n🛡️ *Rol:* ${rol.toUpperCase()}\n🏛️ *Comercio:* ${comercioId}\n\n`;
            const mensajeFinal = encabezado + resIA.mensaje;

            // Enviar con imagen si corresponde
            if (resIA.payload && resIA.payload.nombre) {
                const prodConImagen = inventario.find(p => 
                    p.nombre.toLowerCase() === resIA.payload.nombre.toLowerCase() && p.imagen_url
                );

                if (prodConImagen && prodConImagen.imagen_url) {
                    try {
                        const media = await MessageMedia.fromUrl(prodConImagen.imagen_url);
                        await client.sendMessage(msg.from, media, { caption: mensajeFinal });
                        return; 
                    } catch (imgErr) {
                        console.error("[WA-IMG-ERROR]:", imgErr.message);
                    }
                }
            }

            // Si no hay imagen, enviar texto plano con el encabezado
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