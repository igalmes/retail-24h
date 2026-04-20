const express = require('express');
const router = express.Router();
const productoController = require('../controllers/productoController');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const rateLimit = require('express-rate-limit');

require('dotenv').config();

// 1. Cloudinary Config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. Almacenamiento
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'retail-24h-uploads',
    allowed_formats: ['jpg', 'png', 'jpeg','webp'],
  },
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } 
});

// --- RUTAS PROTEGIDAS Y SEGURAS ---

const scanLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100,
    message: "Demasiadas consultas."
});

// IA: Escaneo y detección
router.post('/detectar', (req, res, next) => {
  upload.single('imagen')(req, res, (err) => {
    if (err) return res.status(500).json({ error: "Error en carga de imagen" });
    next();
  });
}, productoController.detectarYGuardar);

// CRUD de Productos (Aquí usaremos Sequelize en el controlador)
router.get('/', productoController.obtenerTodos);
router.get('/buscar/:ean', scanLimiter, productoController.buscarPorCodigo);
router.put('/:id', productoController.actualizar); // Este es el que usa el frontend para precios
router.delete('/:id', productoController.eliminar);

// Stock para el bot de WhatsApp
router.put('/stock/:ean', productoController.ajustarStock);

module.exports = router;