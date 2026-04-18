const express = require('express');
const router = express.Router();
const productoController = require('../controllers/productoController');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const rateLimit = require('express-rate-limit');

require('dotenv').config();

// 1. Configuración de Cloudinary
// Usamos nombres estándar para evitar confusiones
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. Verificación de carga (Esto saldrá en tu PowerShell)
console.log("--- [DEBUG ROUTES] Verificando Env ---");
console.log("Cloud Name:", process.env.CLOUDINARY_NAME ? "✅ OK" : "❌ FALTANTE");
console.log("API Key:", process.env.CLOUDINARY_API_KEY ? "✅ OK" : "❌ FALTANTE");
console.log("--------------------------------------");

// 3. Configuración del almacenamiento
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'retail-24h-uploads',
    allowed_formats: ['jpg', 'png', 'jpeg','webp'],
  },
});

// 4. Middleware de Multer con manejo de errores interno
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // Límite de 5MB por imagen
});

// --- DEFINICIÓN DE RUTAS ---

// POST: Analizar imagen (IA)
// Agregamos un pequeño fix para capturar errores de subida antes del controlador
router.post('/detectar', (req, res, next) => {
  upload.single('imagen')(req, res, (err) => {
    if (err) {
      console.error("❌ [MULTER/CLOUDINARY ERROR]:", err.message);
      return res.status(500).json({ error: "Error al subir a la nube", details: err.message });
    }
    next();
  });
}, productoController.detectarYGuardar);

const scanLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // limita cada IP a 100 peticiones por ventana
    message: "Demasiadas consultas desde este dispositivo."
});

// Nueva ruta para el bot
router.get('/buscar/:ean', scanLimiter, productoController.buscarPorCodigo);

router.get('/', productoController.obtenerTodos);
router.put('/:id', productoController.actualizar);
router.delete('/:id', productoController.eliminar);
router.put('/stock/:ean', productoController.ajustarStock);

module.exports = router;