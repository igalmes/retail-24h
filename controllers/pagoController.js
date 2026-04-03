const { Preference } = require('mercadopago');
const client = require('../config/mpConfig');
const Pedido = require('../models/Pedido');

exports.crearPreferencia = async (req, res) => {
    console.log("--- [RETAIL 24H] INICIO DE PROCESO DE PAGO ---");
    try {
        const { items } = req.body;

        // 1. Validación de entrada
        if (!items || items.length === 0) {
            console.error("❌ ERROR: Carrito vacío");
            return res.status(400).json({ error: "El carrito está vacío" });
        }

        // 2. Normalización estricta para MP v2
        const itemsProcesados = items.map(item => ({
            id: item.id?.toString() || 'prod-gen',
            title: item.nombre || item.title || 'Producto Retail 24h',
            unit_price: Number(item.unit_price || item.precio), // DEBE SER NUMBER
            quantity: Number(item.quantity || 1),               // DEBE SER NUMBER
            currency_id: 'ARS'
        }));

        // 3. Crear pedido en DB (Estado inicial)
        const totalPedido = itemsProcesados.reduce((acc, item) => acc + (item.unit_price * item.quantity), 0);
        const nuevoPedido = await Pedido.create({ total: totalPedido, estado: 'pendiente' });

        // 4. Configurar Preferencia
        const preference = new Preference(client);
        
        // Evitamos que explote si URL_BACKEND no está definida o es localhost
        const webhookUrl = (process.env.URL_BACKEND && !process.env.URL_BACKEND.includes('localhost')) 
            ? `${process.env.URL_BACKEND}/api/pagos/webhook` 
            : null;

        const response = await preference.create({
            body: {
                items: itemsProcesados,
                back_urls: {
                    success: `${process.env.URL_FRONTEND}/success`,
                    failure: `${process.env.URL_FRONTEND}/failure`,
                    pending: `${process.env.URL_FRONTEND}/pending`,
                },
                auto_return: "approved",
                external_reference: nuevoPedido.id.toString(),
                notification_url: webhookUrl
            }
        });

        // 5. Guardar ID de preferencia
        await nuevoPedido.update({ mp_preference_id: response.id });

        console.log("✅ PREFERENCIA CREADA:", response.id);
        res.json({ id: response.id, init_point: response.init_point });

    } catch (error) {
        console.error("❌ ERROR CRÍTICO EN PREFERENCIA:");
        
        // ESTA PARTE ES LA QUE VA A MATAR EL [object Object]
        if (error.apiResponse) {
            // Error específico de la API de Mercado Pago
            const errorDetalle = await error.apiResponse.json();
            console.log("🔍 DETALLE TÉCNICO MP:", JSON.stringify(errorDetalle, null, 2));
        } else {
            // Error de código u otro tipo
            console.log("🔍 MENSAJE DE ERROR:", error.message);
            console.log("🔍 STACK:", error.stack);
        }

        res.status(500).json({ error: "Error interno en el servidor de pagos" });
    }
};