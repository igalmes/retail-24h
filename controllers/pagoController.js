const { Preference } = require('mercadopago');
const client = require('../config/mpConfig'); // Moví la config de MP a un archivo aparte
const Pedido = require('../models/Pedido');

exports.crearPreferencia = async (req, res) => {
    try {
        const { items } = req.body;

        // 1. Calculamos el total (podés sumarlo del array de items)
        const totalPedido = items.reduce((acc, item) => acc + (item.unit_price * item.quantity), 0);

        // 2. Creamos el pedido en NUESTRA DB primero como 'pendiente'
        const nuevoPedido = await Pedido.create({ total: totalPedido });

        // 3. Configuramos la preferencia de Mercado Pago
        const preference = new Preference(client);
        const result = await preference.create({
            body: {
                items: items,
                back_urls: {
                    success: `${process.env.URL_FRONTEND}/success`,
                    failure: `${process.env.URL_FRONTEND}/failure`,
                    pending: `${process.env.URL_FRONTEND}/pending`,
                },
                auto_return: "approved",
                // CRUCIAL: Vinculamos el ID de nuestro pedido con MP
                external_reference: nuevoPedido.id.toString(), 
                notification_url: `${process.env.URL_BACKEND}/api/pagos/webhook`, 
            }
        });

        // 4. Actualizamos el pedido con el ID de la preferencia
        await nuevoPedido.update({ mp_preference_id: result.id });

        res.json({ id: result.id, init_point: result.init_point });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al generar el pago" });
    }
};