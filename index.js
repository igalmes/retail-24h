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

// --- ASOCIACIONES ---
Usuario.hasMany(Producto, { foreignKey: 'UsuarioId' });
Producto.belongsTo(Usuario, { foreignKey: 'UsuarioId', foreignKeyConstraintName: 'fk_prod_user_retail' });

Usuario.hasMany(Pedido, { foreignKey: 'UsuarioId' });
Pedido.belongsTo(Usuario, { foreignKey: 'UsuarioId', foreignKeyConstraintName: 'fk_ped_user_retail' });

Pedido.hasMany(PedidoItem, { foreignKey: 'PedidoId', onDelete: 'CASCADE' });
PedidoItem.belongsTo(Pedido, { foreignKey: 'PedidoId', foreignKeyConstraintName: 'fk_item_ped_retail' });

Producto.hasMany(PedidoItem, { foreignKey: 'ProductoId', onDelete: 'CASCADE' });
PedidoItem.belongsTo(Producto, { foreignKey: 'ProductoId', foreignKeyConstraintName: 'fk_item_prod_retail' });

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization', 'x-user-email'] }));
app.use(express.json());

// --- FUNCIÓN ADMIN ---
const ejecutarInicializacionAdmin = async () => {
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
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// --- ARRANQUE ---
const startServer = async () => {
    try {
        await sequelize.authenticate();
        console.log('📡 Conexión con Aiven establecida.');

        console.log('🧹 Ejecutando limpieza nuclear...');
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
        const tablas = ['PedidoItems', 'pedidoitems', 'Pedidos', 'pedidos', 'productos', 'Productos', 'Usuarios', 'usuarios', 'SequelizeMeta'];
        for (const t of tablas) { await sequelize.query(`DROP TABLE IF EXISTS ${t}`); }
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('✨ DB reseteada a cero.');

        await Usuario.sync();
        await Producto.sync();
        await Pedido.sync();
        await PedidoItem.sync();
        console.log('🏗️ Estructura recreada.');

        await ejecutarInicializacionAdmin();
        
        app.listen(PORT, '0.0.0.0', async () => {
            console.log(`🚀 [READY]: Servidor en puerto ${PORT}`);
            
            // BLINDAJE: Si falla el Chrome del bot, la API sigue viva
            try {
                await whatsappBot.initialize(1);
            } catch (err) {
                console.error("⚠️ [BOT ERROR]: No se pudo iniciar el bot:", err.message);
            }
        });

    } catch (err) {
        console.error('❌ [CRITICAL ERROR en startServer]:', err.message);
        process.exit(1);
    }
};

startServer();