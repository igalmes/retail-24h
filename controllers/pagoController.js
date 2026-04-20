const { Preference, Payment } = require('mercadopago');
const client = require('../config/mpConfig');
const Pedido = require('../models/Pedido');
const Producto = require('../models/Producto');

exports.crearPreferencia = async (req, res) => {
    try {
        const { items } = req.body;
        if (!items || items.length === 0) return res.status(400).json({ error: "Carrito vacío" });

        // SEGURIDAD: Cruzamos contra la DB para evitar manipulación de precios en el front
        const itemsVerificados = await Promise.all(items.map(async (item) => {
            const productoDB = await Producto.findOne({ 
                where: { id: item.id, UsuarioId: req.user.id } 
            });

            if (!productoDB) throw new Error(`Producto ${item.id} no autorizado`);

            return {
                id: productoDB.id.toString(),
                title: productoDB.nombre,
                unit_price: Number(productoDB.precio_actualizado || productoDB.precio_sugerido),
                quantity: Number(item.quantity || 1),
                currency_id: 'ARS'
            };
        }));

        const totalPedido = itemsVerificados.reduce((acc, i) => acc + (i.unit_price * i.quantity), 0);

        // Registro del pedido vinculado al usuario logueado
        const nuevoPedido = await Pedido.create({ 
            total: totalPedido, 
            estado_pago: 'pendiente',
            UsuarioId: req.user.id 
        });

        const preference = new Preference(client);
        const webhookUrl = (process.env.URL_BACKEND && !process.env.URL_BACKEND.includes('localhost')) 
            ? `${process.env.URL_BACKEND}/api/pagos/webhook` 
            : null;

        const response = await preference.create({
            body: {
                items: itemsVerificados,
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

        await nuevoPedido.update({ mp_preference_id: response.id });
        res.json({ id: response.id, init_point: response.init_point });

    } catch (error) {
        console.error("❌ Error en Preferencia:", error.message);
        res.status(500).json({ error: "Error al procesar el pago" });
    }
};

exports.recibirWebhook = async (req, res) => {
    try {
        const { query } = req;
        if ((query.topic || query.type) === 'payment') {
            const paymentId = query.id || query['data.id'];
            const payment = await new Payment(client).get({ id: paymentId });
            const pedidoId = payment.external_reference;

            if (pedidoId && payment.status === 'approved') {
                const pedido = await Pedido.findByPk(pedidoId);
                // Idempotencia: Solo actualizamos si no estaba aprobado
                if (pedido && pedido.estado_pago !== 'approved') {
                    await Pedido.update({ estado_pago: 'approved' }, { where: { id: pedidoId } });
                    console.log(`✅ Pago confirmado para Pedido #${pedidoId}`);
                }
            }
        }
        res.sendStatus(200);
    } catch (error) {
        console.error("❌ Webhook Error:", error.message);
        res.sendStatus(500);
    }
};