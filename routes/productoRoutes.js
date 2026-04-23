const express = require('express');
const router = express.Router();
const productoController = require('../controllers/productoController');
const authMiddleware = require('../middleware/auth'); // Ruta corregida según tu estructura real
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

// 2. Almacenamiento en Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'retail-24h-uploads',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
  },
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } 
});

// --- SEGURIDAD ---

// Limitador de tasa para evitar abusos en el escaneo de EANs
const scanLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100,
    message: "Demasiadas consultas desde esta IP."
});

/**
 * MIDDLEWARE DE AUTENTICACIÓN GLOBAL PARA PRODUCTOS
 * Esto asegura que req.user esté disponible en todos los controladores de abajo.
 */
router.use(authMiddleware); 

// --- RUTAS ---

// IA: Escaneo y detección de productos mediante imagen
router.post('/detectar-lote', (req, res, next) => {
  upload.single('imagen')(req, res, (err) => {
    if (err) {
      console.error("Error Multer/Cloudinary:", err.message);
      return res.status(500).json({ error: "Error en carga de imagen" });
    }
    next();
  });
}, productoController.detectarYGuardar);



// Obtener inventario completo del usuario logueado
router.get('/', productoController.obtenerTodos);

// Buscar un producto específico por EAN (con limitador de tasa)
router.get('/buscar/:ean', scanLimiter, productoController.buscarPorCodigo);

// Actualización de producto (Precios, nombres, etc.)
router.put('/:id', productoController.actualizar);

// Eliminación de producto
router.delete('/:id', productoController.eliminar);

// Ajuste de stock (Utilizado por el bot de WhatsApp o integraciones)
router.put('/stock/:ean', productoController.ajustarStock);

router.post('/confirmar-repetido', productoController.confirmarRepetido);

module.exports = router;