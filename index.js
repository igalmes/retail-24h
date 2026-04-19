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

// --- CONFIGURACIÓN DE ASOCIACIONES (Fix: Nombres de FK específicos para Aiven) ---
Usuario.hasMany(Producto, { foreignKey: 'UsuarioId' });
Producto.belongsTo(Usuario, { 
    foreignKey: 'UsuarioId', 
    foreignKeyConstraintName: 'fk_productos_usuarios_retail' 
});

Usuario.hasMany(Pedido, { foreignKey: 'UsuarioId' });
Pedido.belongsTo(Usuario, { 
    foreignKey: 'UsuarioId', 
    foreignKeyConstraintName: 'fk_pedidos_usuarios_retail' 
});

Pedido.hasMany(PedidoItem, { foreignKey: 'PedidoId', onDelete: 'CASCADE' });
PedidoItem.belongsTo(Pedido, { 
    foreignKey: 'PedidoId', 
    foreignKeyConstraintName: 'fk_items_pedidos_retail' 
});

Producto.hasMany(PedidoItem, { foreignKey: 'ProductoId', onDelete: 'CASCADE' });
PedidoItem.belongsTo(Producto, { 
    foreignKey: 'ProductoId', 
    foreignKeyConstraintName: 'fk_items_productos_retail' 
});

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

// --- ARRANQUE ATÓMICO REPARADO ---
const startServer = async () => {
    try {
        await sequelize.authenticate();
        console.log('📡 Conexión con Aiven establecida.');

        // 1. DESACTIVAR CHECKS Y BORRAR EN ORDEN INVERSO
        // Esto rompe el bloqueo de "Cannot drop table Usuarios"
        console.log('🧹 Limpiando residuos de deploys anteriores...');
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
        
        // Borramos primero las tablas que tienen FKs (las hijas)
        await sequelize.query('DROP TABLE IF EXISTS PedidoItems');
        await sequelize.query('DROP TABLE IF EXISTS Pedidos');
        await sequelize.query('DROP TABLE IF EXISTS productos'); // Tu modelo usa tableName: 'productos'
        await sequelize.query('DROP TABLE IF EXISTS Productos'); 
        await sequelize.query('DROP TABLE IF EXISTS Usuarios');
        
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('✨ DB lista para reconstrucción.');

        // 2. SINCRONIZACIÓN SECUENCIAL (Orden de jerarquía)
        // Primero el dueño de todo
        await Usuario.sync({ force: true });
        console.log('✅ Tabla Usuarios creada.');

        // Luego los que dependen de Usuario
        await Producto.sync({ force: true });
        await Pedido.sync({ force: true });
        console.log('✅ Tablas Productos y Pedidos creadas.');

        // Al final el detalle que depende de Producto y Pedido
        await PedidoItem.sync({ force: true });
        console.log('✅ Tabla PedidoItems creada.');

        // 3. Datos iniciales
        await inicializarAdmin();
        
        // 4. Levantar Servidor Web
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 [READY]: Servidor corriendo en puerto ${PORT}`);
            
            // 5. WhatsApp Bot (En segundo plano)
            whatsappBot.initialize(1).catch(err => {
                console.error("⚠️ [BOT]: Error al iniciar WhatsApp:", err.message);
            });
        });

    } catch (err) {
        console.error('❌ [CRITICAL ERROR]:', err.message);
        process.exit(1);
    }
};
startServer();