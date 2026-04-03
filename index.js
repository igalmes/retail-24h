require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const sequelize = require('./config/db'); 

// Importación de Modelos
const Producto = require('./models/Producto');
const Pedido = require('./models/Pedido');
const PedidoItem = require('./models/PedidoItem');

// Definir Asociaciones
Pedido.hasMany(PedidoItem, { foreignKey: 'PedidoId' });
PedidoItem.belongsTo(Pedido, { foreignKey: 'PedidoId' });

Producto.hasMany(PedidoItem, { foreignKey: 'ProductoId' });
PedidoItem.belongsTo(Producto, { foreignKey: 'ProductoId' });

// Importación de Rutas
const productoRoutes = require('./routes/productoRoutes');
const pagoRoutes = require('./routes/pagoRoutes');

const app = express();
const PORT = process.env.PORT || 4000;

// --- CONFIGURACIÓN DE CORS ---
const whiteList = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    process.env.URL_FRONTEND, // Tu URL de producción (ej. Vercel o la misma de Render)
    process.env.URL_BACKEND
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || whiteList.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Bloqueado por seguridad (CORS)'));
        }
    }
}));

app.use(express.json());

// Middleware de utilidad
app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
});

// 1. Archivos estáticos de uploads (imágenes locales si existieran)
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// 2. CONFIGURACIÓN PARA SERVIR EL FRONTEND DESDE RENDER
// Esto le dice a Express que busque los archivos compilados de Vite
app.use(express.static(path.join(__dirname, 'client', 'dist')));

// --- RUTAS DE LA API ---
app.use('/api/productos', productoRoutes);
app.use('/api/pagos', pagoRoutes);

// Ruta de estado de la API (opcional, ahora es secundaria)
app.get('/api/status', (req, res) => {
    res.json({ 
        proyecto: "Retail 24h AI",
        mensaje: "🚀 API Online",
        puerto: PORT
    });
});

// 3. CAPTURA DE RUTAS DEL FRONTEND
// Si el usuario entra a cualquier ruta que no sea de la API, le damos el index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

// --- SINCRONIZACIÓN Y ARRANQUE ---
sequelize.sync({ force: false }) 
    .then(() => {
        console.log('🗄️  Base de datos Retail sincronizada');
        levantarServidor();
    })
    .catch(err => {
        if (err.name === 'SequelizeDatabaseError' && err.parent && err.parent.code === 'ER_FK_DUP_NAME') {
            console.log('⚠️  Tablas ya existentes con relaciones. Iniciando servidor igual...');
            levantarServidor();
        } else {
            console.error('❌ Error crítico al sincronizar:', err);
        }
    });

function levantarServidor() {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`
        ==========================================
        ✅ Servidor RETAIL ONLINE en puerto ${PORT}
        🔗 Acceso: http://localhost:${PORT}
        ==========================================
        `);
    });
}