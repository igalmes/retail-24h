const express = require('express');
const router = express.Router();
const pagoController = require('../controllers/pagoController');
const authMiddleware = require('../middlewares/authMiddleware'); 

// Generar pago - Ahora usa tu middleware híbrido
router.post('/crear-preferencia', authMiddleware, pagoController.crearPreferencia);

// Webhook - Público (la validación se hace con el client de MP en el controller)
router.post('/webhook', pagoController.recibirWebhook);

module.exports = router;