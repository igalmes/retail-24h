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

// --- ASOCIACIONES CON NOMBRES ÚNICOS (Blindaje anti-Aiven) ---
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

app.use('/api/auth', authRoutes);
app.use('/api/productos', verifyToken, require('./routes/productoRoutes'));
app.use('/api/pagos', verifyToken, require('./routes/pagoRoutes'));

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const startServer = async () => {
    try {
        await sequelize.authenticate();
        console.log('📡 Conexión con Aiven establecida.');

        // --- EL FIX DEFINITIVO ---
        // Ejecutamos SQL puro para romper todo antes de que Sequelize se trabe
        console.log('🧹 Ejecutando limpieza nuclear...');
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
        
        // Borramos absolutamente todas las variaciones de nombres que hubo
        const tablasABorrar = ['PedidoItems', 'pedidoitems', 'Pedidos', 'pedidos', 'productos', 'Productos', 'Usuarios', 'usuarios', 'SequelizeMeta'];
        for (const tabla of tablasABorrar) {
            await sequelize.query(`DROP TABLE IF EXISTS ${tabla}`);
        }
        
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('✨ DB reseteada a cero.');

        // --- RECONSTRUCCIÓN PASO A PASO ---
        // Ya no usamos force: true aquí porque ya borramos todo arriba con SQL puro
        await Usuario.sync();
        console.log('✅ Usuarios OK');
        
        await Producto.sync();
        await Pedido.sync();
        console.log('✅ Productos y Pedidos OK');
        
        await PedidoItem.sync();
        console.log('✅ PedidoItems OK');

        // Inicializar Admin
        await inicializarAdmin();
        
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 [READY]: Servidor corriendo en puerto ${PORT}`);
            whatsappBot.initialize(1).catch(err => console.error("Error Bot:", err.message));
        });

    } catch (err) {
        console.error('❌ [CRITICAL ERROR]:', err.message);
        process.exit(1);
    }
};
startServer();