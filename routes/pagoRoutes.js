const express = require('express');
const router = express.Router();
const pagoController = require('../controllers/pagoController');
const authMiddleware = require('../middleware/auth');

router.post('/crear-preferencia', authMiddleware, pagoController.crearPreferencia);

// CAMBIO CRÍTICO: Agregamos el parámetro :comercioId
router.post('/webhook/:comercioId', pagoController.recibirWebhook);

module.exports = router;