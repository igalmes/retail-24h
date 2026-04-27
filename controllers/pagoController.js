const { Preference, Payment, MercadoPagoConfig } = require('mercadopago');
const Pedido = require('../models/Pedido');
const Producto = require('../models/Producto');
const Comercio = require('../models/Comercio');

exports.crearPreferencia = async (req, res) => {
    try {
        const { items } = req.body;
        if (!items || items.length === 0) return res.status(400).json({ error: "Carrito vacío" });

        // 1. Buscamos el comercio del usuario logueado para obtener su Access Token
        const comercioId = req.user.comercioId;
        
        // --- BLOQUE DE DEBUG ---
        console.log("DEBUG: Intentando crear preferencia...");
        console.log("DEBUG: comercioId extraído del Token:", comercioId);
        
        const comercioDB = await Comercio.findByPk(comercioId);
        
        if (!comercioDB) {
            console.error("DEBUG: Error - No se encontró ningún comercio con ID:", comercioId);
        } else {
            console.log("DEBUG: Comercio encontrado:", comercioDB.nombre);
            console.log("DEBUG: ¿Tiene token MP?:", comercioDB.mp_access_token ? "SÍ (empieza con " + comercioDB.mp_access_token.substring(0, 10) + "...)" : "NO");
        }
        // -----------------------

        if (!comercioDB || !comercioDB.mp_access_token) {
            throw new Error("El comercio no tiene configuradas credenciales de Mercado Pago.");
        }

        // 2. Inicializamos el cliente de MP DINÁMICAMENTE con el token del comercio
        const dynamicClient = new MercadoPagoConfig({ 
            accessToken: comercioDB.mp_access_token 
        });

        // SEGURIDAD: Cruzamos contra la DB y usamos el nuevo campo de precio
        const itemsVerificados = await Promise.all(items.map(async (item) => {
            const productoDB = await Producto.findOne({ 
                where: { id: item.id, comercioId: comercioId } 
            });

            if (!productoDB) throw new Error(`Producto ${item.id} no autorizado o no pertenece a tu comercio`);

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
            comercioId: comercioId, // Vinculamos el pedido al comercio
            UsuarioId: req.user.id 
        });

        const preference = new Preference(dynamicClient);
        
        // El webhook debe incluir el comercioId para saber con qué token validar la respuesta después
        const webhookUrl = (process.env.URL_BACKEND && !process.env.URL_BACKEND.includes('localhost')) 
            ? `${process.env.URL_BACKEND}/api/pagos/webhook/${comercioId}` 
            : null;

        const response = await preference.create({
            body: {
                items: itemsVerificados,
                back_urls: {
                    success: process.env.URL_FRONTEND ? `${process.env.URL_FRONTEND}/success` : "http://localhost:5173/success",
                    failure: process.env.URL_FRONTEND ? `${process.env.URL_FRONTEND}/failure` : "http://localhost:5173/failure",
                    pending: process.env.URL_FRONTEND ? `${process.env.URL_FRONTEND}/pending` : "http://localhost:5173/pending",
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
        res.status(500).json({ error: error.message });
    }
};

exports.recibirWebhook = async (req, res) => {
    try {
        const { query, params } = req;
        const { comercioId } = params; // Obtenemos el comercioId desde la URL del webhook

        if ((query.topic || query.type) === 'payment') {
            // Buscamos el token del comercio para este pago específico
            const comercio = await Comercio.findByPk(comercioId);
            if (!comercio) throw new Error("Comercio no encontrado en Webhook");

            const dynamicClient = new MercadoPagoConfig({ accessToken: comercio.mp_access_token });
            
            const paymentId = query.id || query['data.id'];
            const payment = await new Payment(dynamicClient).get({ id: paymentId });
            const pedidoId = payment.external_reference;

            if (pedidoId && payment.status === 'approved') {
                const pedido = await Pedido.findByPk(pedidoId);
                if (pedido && pedido.estado_pago !== 'approved') {
                    await Pedido.update({ estado_pago: 'approved' }, { where: { id: pedidoId } });
                    console.log(`✅ Pago confirmado para Pedido #${pedidoId} (Comercio: ${comercioId})`);
                }
            }
        }
        res.sendStatus(200);
    } catch (error) {
        console.error("❌ Webhook Error:", error.message);
        res.sendStatus(500);
    }
};