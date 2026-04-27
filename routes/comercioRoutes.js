const express = require('express');
const router = express.Router();
const Comercio = require('../models/Comercio');
const authMiddleware = require('../middleware/auth');

// Ruta para que el dueño actualice sus propios datos de Mercado Pago
router.put('/mis-credenciales', authMiddleware, async (req, res) => {
    try {
        const { mp_access_token } = req.body;
        const comercioId = req.user.comercioId;

        if (!mp_access_token) return res.status(400).json({ error: "Token requerido" });

        await Comercio.update(
            { mp_access_token },
            { where: { id: comercioId } }
        );

        res.json({ success: true, message: "Credenciales actualizadas correctamente" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;