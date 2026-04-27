const { Preference, Payment } = require('mercadopago');
const client = require('../config/mpConfig');
const Pedido = require('../models/Pedido');
const Producto = require('../models/Producto');

exports.crearPreferencia = async (req, res) => {
    try {
        const { items } = req.body;
        if (!items || items.length === 0) return res.status(400).json({ error: "Carrito vacío" });

        // SEGURIDAD: Cruzamos contra la DB y usamos el nuevo campo de precio
        const itemsVerificados = await Promise.all(items.map(async (item) => {
            const productoDB = await Producto.findOne({ 
                where: { id: item.id, UsuarioId: req.user.id } 
            });

            if (!productoDB) throw new Error(`Producto ${item.id} no autorizado`);

            // Validación de precio: Prioriza el actualizado por el usuario
            const precioFinal = parseFloat(productoDB.precio_actualizado) || parseFloat(productoDB.precio_sugerido) || 0;

            if (precioFinal <= 0) {
                throw new Error(`El producto ${productoDB.nombre} no tiene un precio válido asignado.`);
            }

            return {
                id: productoDB.id.toString(),
                title: productoDB.nombre,
                unit_price: precioFinal,
                quantity: Number(item.quantity || 1),
                currency_id: 'ARS'
            };
        }));

        const totalPedido = itemsVerificados.reduce((acc, i) => acc + (i.unit_price * i.quantity), 0);

        // Registro del pedido
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
            // Mercado Pago requiere estas URLs para el auto_return
            success: process.env.URL_FRONTEND ? `${process.env.URL_FRONTEND}/success` : "http://localhost:5173/success",
            failure: process.env.URL_FRONTEND ? `${process.env.URL_FRONTEND}/failure` : "http://localhost:5173/failure",
            pending: process.env.URL_FRONTEND ? `${process.env.URL_FRONTEND}/pending` : "http://localhost:5173/pending",
        },
        auto_return: "approved", // Ahora sí funcionará porque definimos success arriba
        external_reference: nuevoPedido.id.toString(),
        notification_url: webhookUrl
    }
});

        await nuevoPedido.update({ mp_preference_id: response.id });
        res.json({ id: response.id, init_point: response.init_point });

    } catch (error) {
        console.error("❌ Error en Preferencia:", error.message);
        res.status(500).json({ error: error.message });
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