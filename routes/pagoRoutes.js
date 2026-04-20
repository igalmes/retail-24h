const express = require('express');
const router = express.Router();
const pagoController = require('../controllers/pagoController');
const authMiddleware = require('../middleware/auth'); // Ruta corregida

router.post('/crear-preferencia', authMiddleware, pagoController.crearPreferencia);
router.post('/webhook', pagoController.recibirWebhook);

module.exports = router;