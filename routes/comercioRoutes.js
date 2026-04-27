const express = require('express');
const router = express.Router();
const Comercio = require('../models/Comercio');
const authMiddleware = require('../middleware/auth');
const axios = require('axios');

// 1. Iniciar el flujo de OAuth (Redirige al usuario a MP)
router.get('/vincular-mp', authMiddleware, (req, res) => {
    const { comercioId } = req.user;
    // El state sirve para saber qué comercio está volviendo en el callback
    const mpUrl = `https://auth.mercadopago.com.ar/authorization?client_id=${process.env.MP_CLIENT_ID}&response_type=code&platform_id=mp&state=${comercioId}&redirect_uri=${process.env.MP_REDIRECT_URI}`;
    res.json({ url: mpUrl });
});

// 2. Callback: Donde MP envía el código de autorización
router.get('/callback', async (req, res) => {
    const { code, state } = req.query; // state es nuestro comercioId

    if (!code) return res.status(400).send("Código no proporcionado");

    try {
        // Intercambiamos el código por el Access Token real
        const response = await axios.post('https://api.mercadopago.com/oauth/token', {
            client_id: process.env.MP_CLIENT_ID,
            client_secret: process.env.MP_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: process.env.MP_REDIRECT_URI
        });

        const { access_token } = response.data;

        // Guardamos el token en el comercio correspondiente
        await Comercio.update(
            { mp_access_token: access_token },
            { where: { id: state } }
        );

        // Redirigimos al usuario de vuelta al frontend con éxito
        res.send(`
            <html>
                <body style="font-family:sans-serif; text-align:center; padding-top:50px;">
                    <h2>¡Conexión Exitosa!</h2>
                    <p>Ya podés cerrar esta ventana y volver al panel.</p>
                    <script>setTimeout(() => window.close(), 3000);</script>
                </body>
            </html>
        `);
    } catch (error) {
        console.error("Error en OAuth MP:", error.response?.data || error.message);
        res.status(500).send("Error al vincular cuenta");
    }
});

module.exports = router;