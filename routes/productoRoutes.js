const express = require('express');
const router = express.Router();
const productoController = require('../controllers/productoController');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// 1. Configuración de Cloudinary (Usa las variables de entorno de Render)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. Configuración de Almacenamiento en la Nube
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'retail-24h-uploads', // Nombre de la carpeta en tu panel de Cloudinary
    allowed_formats: ['jpg', 'png', 'jpeg'],
    transformation: [{ width: 1000, crop: 'limit' }] // Opcional: optimiza el tamaño
  },
});

const upload = multer({ storage });

// 3. Rutas (se mantienen igual, pero 'upload' ahora es Cloudinary)
router.post('/detectar', upload.single('imagen'), productoController.detectarYGuardar);
router.get('/', productoController.obtenerTodos);
router.put('/:id', productoController.actualizar);
router.delete('/:id', productoController.eliminar);

module.exports = router;