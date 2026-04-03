require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const sequelize = require('./config/db'); 

// --- DEBUG DE VARIABLES (PARA RENDER) ---
console.log("--- [DEBUG] ESTADO DE VARIABLES DE ENTORNO ---");
console.log("PORT:", process.env.PORT || "4000 (default)");
console.log("MP_ACCESS_TOKEN:", process.env.MP_ACCESS_TOKEN ? "✅ CARGADO" : "❌ VACÍO");
console.log("CLOUDINARY_NAME:", (process.env.CLOUDINARY_NAME || process.env.CLOUD_NAME) ? "✅ CARGADO" : "❌ VACÍO");
console.log("GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "✅ CARGADO" : "❌ VACÍO");
console.log("----------------------------------------------");

// Capturador de errores globales para ver el detalle de "Must supply api_key"
process.on('uncaughtException', (err) => {
    console.error("❌ ERROR CRÍTICO NO CAPTURADO:");
    console.error("Mensaje:", err.message);
    console.error("Stack:", err.stack);
});

// Importación de Modelos
const Producto = require('./models/Producto');
const Pedido = require('./models/Pedido');
const PedidoItem = require('./models/PedidoItem');

// Definir Asociaciones (MVC Integrity)
Pedido.hasMany(PedidoItem, { foreignKey: 'PedidoId' });
PedidoItem.belongsTo(Pedido, { foreignKey: 'PedidoId' });
Producto.hasMany(PedidoItem, { foreignKey: 'ProductoId' });
PedidoItem.belongsTo(Producto, { foreignKey: 'ProductoId' });

// Importación de Rutas
const productoRoutes = require('./routes/productoRoutes');
const pagoRoutes = require('./routes/pagoRoutes');

const app = express();
const PORT = process.env.PORT || 4000;

// --- CONFIGURACIÓN DE CORS (PRODUCCIÓN) ---
const whiteList = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    process.env.URL_FRONTEND, 
    process.env.URL_BACKEND
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || whiteList.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(null, false);
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
});

// 1. Archivos estáticos y Frontend Build
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use(express.static(path.join(__dirname, 'client', 'dist')));

// --- RUTAS DE LA API ---
app.use('/api/productos', productoRoutes);
app.use('/api/pagos', pagoRoutes);

// Status minimalista para monitoreo
app.get('/api/status', (req, res) => {
    res.status(200).json({ status: "online", service: "Retail 24h AI" });
});

// 2. CAPTURA DE RUTAS DEL FRONTEND (SPA Routing)
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'client', 'dist', 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            res.status(500).send("Error cargando el frontend. Verificá el build.");
        }
    });
});

// --- SINCRONIZACIÓN Y ARRANQUE SEGURO ---
sequelize.sync({ force: false }) 
    .then(() => {
        console.log('[SYSTEM]: Database connected.');
        levantarServidor();
    })
    .catch(err => {
        if (err.parent && err.parent.code === 'ER_FK_DUP_NAME') {
            console.log('[SYSTEM]: Database tables verified.');
            levantarServidor();
        } else {
            console.error('[CRITICAL ERROR]: DB connection failed.');
        }
    });

function levantarServidor() {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`[READY]: Retail 24h AI operational on port ${PORT}`);
    });
}