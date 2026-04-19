require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const sequelize = require('./config/db'); 
const whatsappBot = require('./services/whatsappService');
const authRoutes = require('./routes/authRoutes');
const verifyToken = require('./middleware/auth');

// --- MODELOS ---
const Usuario = require('./models/Usuario');
const Producto = require('./models/Producto');
const Pedido = require('./models/Pedido');
const PedidoItem = require('./models/PedidoItem');

// --- CONFIGURACIÓN DE ASOCIACIONES (Sincronizadas con tus modelos) ---
Usuario.hasMany(Producto, { foreignKey: 'UsuarioId' });
Producto.belongsTo(Usuario, { foreignKey: 'UsuarioId' });

Usuario.hasMany(Pedido, { foreignKey: 'UsuarioId' });
Pedido.belongsTo(Usuario, { foreignKey: 'UsuarioId' });

Pedido.hasMany(PedidoItem, { foreignKey: 'PedidoId', onDelete: 'CASCADE' });
PedidoItem.belongsTo(Pedido, { foreignKey: 'PedidoId' });

Producto.hasMany(PedidoItem, { foreignKey: 'ProductoId', onDelete: 'CASCADE' });
PedidoItem.belongsTo(Producto, { foreignKey: 'ProductoId' });

const app = express();
const PORT = process.env.PORT || 4000;

// --- MIDDLEWARES ---
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-email']
}));
app.use(express.json());

// --- REGISTRO ADMIN INICIAL ---
const inicializarAdmin = async () => {
    try {
        const [admin, created] = await Usuario.findOrCreate({
            where: { email: 'ignaciogalmes79@gmail.com' },
            defaults: { 
                nombre: 'Ignacio Galmes',
                password: 'password_provisoria_123',
                rol: 'admin'
            }
        });
        console.log(created ? "✅ [SISTEMA]: Admin creado." : "ℹ️ [SISTEMA]: Admin ya existente.");
    } catch (error) {
        console.error("❌ [ERROR ADMIN]:", error.message);
    }
};

// --- RUTAS ---
app.use('/api/auth', authRoutes);
app.use('/api/productos', verifyToken, require('./routes/productoRoutes'));
app.use('/api/pagos', verifyToken, require('./routes/pagoRoutes'));

app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/status', (req, res) => res.status(200).json({ status: "online", project: "Retail 24h AI" }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// --- ARRANQUE ATÓMICO ---
const startServer = async () => {
    try {
        // 1. Conexión y Limpieza preventiva
        await sequelize.authenticate();
        console.log('📡 Conexión con Aiven establecida.');

        // 2. Sincronización Secuencial (Evita el error de Tabla No Existe)
        // Usamos force: true para que esta PRIMERA VEZ post-Workbench se asiente bien el esquema
        await Usuario.sync({ force: true });
        await Producto.sync({ force: true });
        await Pedido.sync({ force: true });
        await PedidoItem.sync({ force: true });
        console.log('🏗️  Estructura de Base de Datos recreada con éxito.');

        // 3. Datos iniciales
        await inicializarAdmin();
        
        // 4. Levantar Servidor Web
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 [READY]: Servidor corriendo en puerto ${PORT}`);
            
            // 5. WhatsApp Bot (Inicia en segundo plano para no bloquear a Render)
            whatsappBot.initialize(1).catch(err => {
                console.error("⚠️  [BOT]: Error al iniciar WhatsApp:", err.message);
            });
        });

    } catch (err) {
        console.error('❌ [CRITICAL ERROR]:', err.message);
        process.exit(1);
    }
};

startServer();