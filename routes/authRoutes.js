const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Ruta para el Login con Google (Comercial)
router.post('/google', authController.googleLogin);

// Podés agregar aquí el login tradicional más adelante
// router.post('/login', authController.login);

module.exports = router;