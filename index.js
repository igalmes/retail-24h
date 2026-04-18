require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const sequelize = require('./config/db'); 
const whatsappBot = require('./services/whatsappService');
const authRoutes = require('./routes/authRoutes');
const verifyToken = require('./middleware/auth');

// --- DEBUG DE VARIABLES ---
console.log("--- [DEBUG] ESTADO DE VARIABLES DE ENTORNO ---");
console.log("PORT:", process.env.PORT || "4000");
console.log("DB_HOST:", process.env.DB_HOST ? "✅ CONFIGURADO" : "❌ FALTA");
console.log("----------------------------------------------");

process.on('uncaughtException', (err) => {
    console.error("❌ ERROR CRÍTICO NO CAPTURADO:", err.message);
});

// --- MODELOS Y ASOCIACIONES ---
const Usuario = require('./models/Usuario');
const Producto = require('./models/Producto');
const Pedido = require('./models/Pedido');
const PedidoItem = require('./models/PedidoItem');

// Relaciones de Usuario (Dueño del negocio)
Usuario.hasMany(Producto, { foreignKey: 'UsuarioId' });
Producto.belongsTo(Usuario, { foreignKey: 'UsuarioId' });

Usuario.hasMany(Pedido, { foreignKey: 'UsuarioId' });
Pedido.belongsTo(Usuario, { foreignKey: 'UsuarioId' });

// Relaciones de Pedidos y Productos
Pedido.hasMany(PedidoItem, { foreignKey: 'PedidoId' });
PedidoItem.belongsTo(Pedido, { foreignKey: 'PedidoId' });

Producto.hasMany(PedidoItem, { foreignKey: 'ProductoId' });
PedidoItem.belongsTo(Producto, { foreignKey: 'ProductoId' });

// --- AUTO-REGISTRO ADMIN ---
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
        console.log(created ? "✅ [AIVEN]: Admin creado." : "ℹ️ [AIVEN]: Admin verificado.");
    } catch (error) {
        console.error("❌ [AIVEN]: Error al inicializar admin:", error.message);
    }
};

const app = express();
const PORT = process.env.PORT || 4000;

// --- CONFIGURACIÓN DE MIDDLEWARES ---
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-email']
}));

app.use(express.json());

// --- RUTAS API ---
const productoRoutes = require('./routes/productoRoutes');
const pagoRoutes = require('./routes/pagoRoutes');

// RUTAS PÚBLICAS
app.use('/api/auth', authRoutes);

// RUTAS PROTEGIDAS
app.use('/api/productos', verifyToken, productoRoutes); 
app.use('/api/pagos', verifyToken, pagoRoutes); 

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', (req, res) => {
    res.status(200).json({ status: "online", service: "Retail 24h AI" });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- ARRANQUE Y SINCRONIZACIÓN FORZADA (CLEAN SLATE) ---
const startServer = async () => {
    try {
        await sequelize.authenticate();
        console.log('📡 Conexión establecida con Aiven. Iniciando Hard Reset...');

        // 1. ELIMINACIÓN MANUAL DE RESTRICCIONES Y TABLAS
        // Nota: 'productos' va en minúscula porque así está en el modelo
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
        await sequelize.query('DROP TABLE IF EXISTS PedidoItems');
        await sequelize.query('DROP TABLE IF EXISTS Pedidos');
        await sequelize.query('DROP TABLE IF EXISTS productos'); 
        await sequelize.query('DROP TABLE IF EXISTS Usuarios');
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
        
        console.log('📡 [LIMPIEZA]: Tablas eliminadas (Bypass de FK activo).');

        // 2. SINCRONIZAR DE CERO
        await sequelize.sync({ force: true });
        console.log('📡 [SYSTEM]: Estructura de tablas recreada con éxito.');

        // 3. INICIALIZAR ADMIN Y ARRANCAR EXPRESS
        await inicializarAdmin();
        
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 [READY]: Retail 24h AI operativo en puerto ${PORT}`);
            // whatsappBot.initialize(1); 
        });

    } catch (err) {
        console.error('❌ [CRITICAL ERROR]:', err.message);
        process.exit(1);
    }
};

startServer();