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
// Aquí agregamos las URLs que tienen permiso para hablar con el backend
const whiteList = [
    'http://localhost:5173', // Tu Vite cuando desarrollas local
    'https://tu-app-frontend.vercel.app' // <--- REEMPLAZA ESTO con tu URL real de Vercel/Netlify
];

app.use(cors({
    origin: function (origin, callback) {
        // Permitimos peticiones sin origen (como Postman o Insomnia) o las que están en la lista
        if (!origin || whiteList.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Bloqueado por seguridad (CORS)'));
        }
    }
}));

app.use(express.json());

// Middleware para saltear avisos de Ngrok (útil en pruebas externas)
app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
});

// Carpeta de archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// --- RUTAS DEL SISTEMA ---
app.use('/api/productos', productoRoutes);
app.use('/api/pagos', pagoRoutes);

// Ruta de estado del servidor
app.get('/', (req, res) => {
    res.json({ 
        proyecto: "Retail 24h AI",
        mensaje: "🚀 Sistema Online",
        puerto: PORT
    });
});

// --- SINCRONIZACIÓN Y ARRANQUE ---
sequelize.sync({ force: false }) 
    .then(() => {
        console.log('🗄️  Base de datos Retail sincronizada');
        // '0.0.0.0' permite que servicios como Render detecten el puerto correctamente
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`
            ==========================================
            ✅ Servidor RETAIL corriendo en puerto ${PORT}
            🔗 Local: http://localhost:${PORT}
            🌐 Público: ${process.env.URL_BACKEND || 'No definida'}
            ==========================================
            `);
        });
    })
    .catch(err => {
        console.error('❌ Error al sincronizar la base de datos:', err);
    });