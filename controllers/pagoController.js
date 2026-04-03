const { Preference } = require('mercadopago');
const client = require('../config/mpConfig');
const Pedido = require('../models/Pedido');

exports.crearPreferencia = async (req, res) => {
    console.log("--- [RETAIL 24H] INICIO DE PROCESO DE PAGO ---");

    try {
        const { items } = req.body;

        if (!items || items.length === 0) {
            console.error("❌ ERROR: El carrito llegó vacío al backend.");
            return res.status(400).json({ error: "El carrito está vacío" });
        }

        // 1. Sanitización estricta (MP v2 rebota si unit_price es String)
        const itemsProcesados = items.map(item => ({
            id: item.id?.toString() || 'prod-gen',
            title: item.nombre || item.title || 'Producto Retail 24h', 
            unit_price: Number(item.unit_price || item.precio), 
            quantity: Number(item.quantity || 1),
            currency_id: 'ARS'
        }));

        // 2. Registro en DB local (Estado inicial)
        const totalPedido = itemsProcesados.reduce((acc, item) => acc + (item.unit_price * item.quantity), 0);
        const nuevoPedido = await Pedido.create({ 
            total: totalPedido,
            estado: 'pendiente' 
        });

        // 3. Configuración de la Preferencia
        const preference = new Preference(client);

        // Validación de Webhook: MP NO acepta localhost
        const urlWebhook = (process.env.URL_BACKEND && !process.env.URL_BACKEND.includes('localhost')) 
            ? `${process.env.URL_BACKEND}/api/pagos/webhook` 
            : null;

        const body = {
            items: itemsProcesados,
            back_urls: {
                success: `${process.env.URL_FRONTEND}/success`,
                failure: `${process.env.URL_FRONTEND}/failure`,
                pending: `${process.env.URL_FRONTEND}/pending`,
            },
            auto_return: "approved",
            external_reference: nuevoPedido.id.toString(),
            notification_url: urlWebhook,
        };

        const result = await preference.create({ body });

        // 4. Guardamos el ID de MP en nuestra base de datos
        await nuevoPedido.update({ mp_preference_id: result.id });

        console.log("✅ PREFERENCIA CREADA EXITOSAMENTE:", result.id);

        res.json({ 
            id: result.id, 
            init_point: result.init_point 
        });

    } catch (error) {
        console.error("❌ ERROR CRÍTICO AL CREAR PREFERENCIA:");
        
        // --- BLOQUE DE DEBUG PROFUNDO ---
        if (error.apiResponse) {
            // Este bloque extrae el error real de la API de Mercado Pago
            try {
                const errorData = await error.apiResponse.json();
                console.error("DETALLE TÉCNICO DE MP:", JSON.stringify(errorData, null, 2));
            } catch (e) {
                console.error("No se pudo parsear el JSON del error de MP.");
            }
        } else if (error.message) {
            console.error("MENSAJE:", error.message);
        } else {
            // Si todo falla, forzamos la visualización del objeto
            console.error("OBJETO DE ERROR COMPLETO:", JSON.stringify(error, null, 2));
        }

        res.status(500).json({ 
            error: "Error al generar el pago",
            detalle: error.message || "Error desconocido en la API de Mercado Pago"
        });
    }
};