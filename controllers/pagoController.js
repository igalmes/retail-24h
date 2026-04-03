const { Preference } = require('mercadopago');
const client = require('../config/mpConfig');
const Pedido = require('../models/Pedido');

exports.crearPreferencia = async (req, res) => {
    try {
        const { items } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ error: "El carrito está vacío" });
        }

        // 1. Normalización y limpieza de items (Mercado Pago es estricto con los tipos)
        const itemsProcesados = items.map(item => ({
            id: item.id?.toString() || 'prod-gen',
            title: item.nombre || item.title || 'Producto Retail 24h', 
            unit_price: Number(item.unit_price || item.precio), // Forzamos Number
            quantity: Number(item.quantity || 1),               // Forzamos Number
            currency_id: 'ARS'
        }));

        // 2. Calculamos el total para nuestra base de datos
        const totalPedido = itemsProcesados.reduce((acc, item) => acc + (item.unit_price * item.quantity), 0);

        // 3. Creamos el registro en nuestra DB como 'pendiente'
        const nuevoPedido = await Pedido.create({ 
            total: totalPedido,
            estado: 'pendiente' 
        });

        console.log(`--- [MP] GENERANDO PREFERENCIA PARA PEDIDO #${nuevoPedido.id} ---`);

        // 4. Inicializamos la Preferencia con el cliente de MP
        const preference = new Preference(client);

        const body = {
            items: itemsProcesados,
            back_urls: {
                success: `${process.env.URL_FRONTEND}/success`,
                failure: `${process.env.URL_FRONTEND}/failure`,
                pending: `${process.env.URL_FRONTEND}/pending`,
            },
            auto_return: "approved",
            external_reference: nuevoPedido.id.toString(),
            // NOTA: Mercado Pago NO acepta localhost en notification_url. 
            // Solo se activará si URL_BACKEND es una URL pública (Render/ngrok).
            notification_url: process.env.URL_BACKEND?.includes('localhost') 
                ? "" 
                : `${process.env.URL_BACKEND}/api/pagos/webhook`,
        };

        const result = await preference.create({ body });

        // 5. Guardamos el ID de la preferencia en nuestra DB
        await nuevoPedido.update({ mp_preference_id: result.id });

        console.log("✅ PREFERENCIA CREADA:", result.id);

        res.json({ 
            id: result.id, 
            init_point: result.init_point 
        });

    } catch (error) {
        console.error("❌ ERROR AL CREAR PREFERENCIA:");
        
        // Si el error viene de Mercado Pago, intentamos parsear la respuesta
        if (error.response) {
            console.error("DETALLE MP:", JSON.stringify(error.response, null, 2));
        } else {
            console.error("MENSAJE:", error.message);
        }

        res.status(500).json({ 
            error: "Error al generar el pago",
            detalle: error.message 
        });
    }
};