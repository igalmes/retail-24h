const express = require('express');
const router = express.Router();
const productoController = require('../controllers/productoController');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// FORZAR CARGA DE VARIABLES (Esto soluciona el 'Must supply api_key')
require('dotenv').config();

// CONFIGURACIÓN ROBUSTA: Intenta todos los nombres posibles que podrías tener en Render
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME || process.env.CLOUD_NAME || 'dthve8h8s',
  api_key: process.env.CLOUDINARY_API_KEY || process.env.API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET || process.env.API_SECRET
});

// Verificación interna en Logs (solo verás esto en Render)
if (!process.env.CLOUDINARY_API_KEY && !process.env.API_KEY) {
  console.error("⚠️ [CRÍTICO]: No se detectó ninguna API_KEY en las variables de entorno.");
}

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'retail-24h-uploads',
    allowed_formats: ['jpg', 'png', 'jpeg'],
  },
});

const upload = multer({ storage });

router.post('/detectar', upload.single('imagen'), productoController.detectarYGuardar);
router.get('/', productoController.obtenerTodos);
router.put('/:id', productoController.actualizar);
router.delete('/:id', productoController.eliminar);

module.exports = router;