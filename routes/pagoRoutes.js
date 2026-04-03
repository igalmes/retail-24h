const express = require('express');
const router = express.Router();
const client = require('../config/mpConfig');
const { Preference, Payment } = require('mercadopago');
const Pedido = require('../models/Pedido');
const PedidoItem = require('../models/PedidoItem');

// 1. RUTA PARA CREAR LA PREFERENCIA (GENERAR LINK DE PAGO)
router.post('/crear-preferencia', async (req, res) => {
    console.log("\n--- [RETAIL 24H] INICIO DE PROCESO DE PAGO ---");
    
    try {
        const { items, total, email_cliente } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ error: "El carrito está vacío." });
        }

        // Registro del pedido en la base de datos local (estado inicial: pending)
        const nuevoPedido = await Pedido.create({
            total: total,
            estado_pago: 'pending',
            email_cliente: email_cliente || "comprador@retail24h.com"
        });
        console.log(`1. DB: Pedido #${nuevoPedido.id} creado.`);

        // Formateo de ítems según los requisitos de Mercado Pago
        const itemsMP = items.map(item => ({
            id: String(item.id),
            title: String(item.title).substring(0, 250),
            unit_price: Number(item.unit_price),
            quantity: Number(item.quantity),
            currency_id: 'ARS',
            picture_url: item.picture_url,
            description: "Compra en Retail 24h AI"
        }));

        const preference = new Preference(client);

        // Configuración de la preferencia
        const preferenceData = {
            body: {
                items: itemsMP,
                back_urls: {
                    success: `${process.env.URL_FRONTEND}/success`,
                    failure: `${process.env.URL_FRONTEND}/failure`,
                    pending: `${process.env.URL_FRONTEND}/pending`
                },
                auto_return: "approved", 
                // external_reference es la clave para conectar MP con nuestra DB
                external_reference: String(nuevoPedido.id),
                notification_url: `${process.env.URL_BACKEND}/api/pagos/webhook`
            }
        };

        const resMP = await preference.create(preferenceData);
        console.log("✅ 2. MP: Preferencia generada con éxito.");

        // Devolvemos el init_point para que el frontend redirija al usuario
        res.json({ 
            id: resMP.id, 
            init_point: resMP.init_point,
            pedidoId: nuevoPedido.id 
        });

    } catch (error) {
        console.error("\n❌ ERROR AL CREAR PREFERENCIA:");
        if (error.api_response && error.api_response.data) {
            console.error("DETALLE MP:", JSON.stringify(error.api_response.data, null, 2));
        }
        res.status(500).json({ error: "No se pudo generar el pago" });
    }
});

// 2. RUTA DE WEBHOOK (NOTIFICACIONES IPN)
// Escucha los avisos de Mercado Pago cuando cambia el estado del pago
router.post('/webhook', async (req, res) => {
    console.log("--- WEBHOOK RECIBIDO ---");
    
    const { query } = req;
    const topic = query.topic || query.type;

    try {
        // Solo procesamos si la notificación es de un pago
        if (topic === 'payment') {
            const paymentId = query.id || query['data.id'];
            console.log(`Consultando pago ID: ${paymentId}`);

            // Consultamos la API de Mercado Pago para verificar el estado real
            const payment = await new Payment(client).get({ id: paymentId });
            
            // Recuperamos nuestra referencia y el estado final
            const pedidoId = payment.external_reference;
            const estadoFinal = payment.status; // approved, rejected, etc.

            if (pedidoId) {
                // Sincronizamos con nuestra base de datos
                await Pedido.update(
                    { estado_pago: estadoFinal },
                    { where: { id: pedidoId } }
                );
                console.log(`✅ Pedido #${pedidoId} actualizado a: ${estadoFinal}`);
            }
        }

        // Es obligatorio responder 200 para que MP deje de enviar la notificación
        res.sendStatus(200);

    } catch (error) {
        console.error("Error en Webhook:", error.message);
        // Si falla algo nuestro, respondemos 500 para que MP reintente más tarde
        res.sendStatus(500);
    }
});

module.exports = router;