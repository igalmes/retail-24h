const express = require('express');
const router = express.Router();
const productoController = require('../controllers/productoController');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// 1. Forzamos la carga de variables de entorno inmediatamente
require('dotenv').config();

// 2. Configuración Multicapa: Busca todos los nombres posibles (locales y de Render)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_NAME || process.env.CLOUD_NAME || 'dthve8h8s',
  api_key: process.env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_KEY || process.env.API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_SECRET || process.env.API_SECRET
});

// 3. Log de Diagnóstico: Nos avisa en la terminal de VS Code o Render si algo falta
if (!process.env.CLOUDINARY_API_KEY && !process.env.CLOUDINARY_KEY && !process.env.API_KEY) {
  console.error("⚠️ [CRÍTICO]: No se detectó ninguna API_KEY de Cloudinary en las variables de entorno.");
} else {
  console.log("✅ [SISTEMA]: Cloudinary inicializado correctamente.");
}

// 4. Configuración del almacenamiento en la nube
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'retail-24h-uploads',
    allowed_formats: ['jpg', 'png', 'jpeg'],
  },
});

// 5. Middleware de Multer para procesar la subida
const upload = multer({ storage });

// --- RUTAS ---

// Escaneo con IA: Sube a Cloudinary y luego procesa con Gemini
router.post('/detectar', upload.single('imagen'), productoController.detectarYGuardar);

// CRUD de Productos
router.get('/', productoController.obtenerTodos);
router.put('/:id', productoController.actualizar);
router.delete('/:id', productoController.eliminar);

module.exports = router;