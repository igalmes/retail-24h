require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const sequelize = require('./config/db'); 
const authRoutes = require('./routes/authRoutes');
const verifyToken = require('./middleware/auth');

// --- MODELOS ---
const Usuario = require('./models/Usuario');
const Producto = require('./models/Producto');
const Pedido = require('./models/Pedido');
const PedidoItem = require('./models/PedidoItem');

// --- ASOCIACIONES EXPLÍCITAS ---
Usuario.hasMany(Producto, { foreignKey: 'UsuarioId' });
Producto.belongsTo(Usuario, { foreignKey: 'UsuarioId' });

Usuario.hasMany(Pedido, { foreignKey: 'UsuarioId' });
Pedido.belongsTo(Usuario, { foreignKey: 'UsuarioId' });

Pedido.hasMany(PedidoItem, { foreignKey: { name: 'PedidoId', allowNull: false }, onDelete: 'CASCADE' });
PedidoItem.belongsTo(Pedido, { foreignKey: { name: 'PedidoId', allowNull: false } });

Producto.hasMany(PedidoItem, { foreignKey: { name: 'ProductoId', allowNull: false }, onDelete: 'CASCADE' });
PedidoItem.belongsTo(Producto, { foreignKey: { name: 'ProductoId', allowNull: false } });

// --- INICIALIZAR ADMIN ---
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
        console.log(created ? "✅ [ADMIN]: Creado." : "ℹ️ [ADMIN]: Verificado.");
    } catch (error) {
        console.error("❌ [ADMIN ERROR]:", error.message);
    }
};

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization', 'x-user-email'] }));
app.use(express.json());

// RUTAS
app.use('/api/auth', authRoutes);
app.use('/api/productos', verifyToken, require('./routes/productoRoutes')); 
app.use('/api/pagos', verifyToken, require('./routes/pagoRoutes')); 

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// --- ARRANQUE SECUENCIAL ---
const startServer = async () => {
    try {
        await sequelize.authenticate();
        console.log('📡 Conexión con Aiven OK. Iniciando Reconstrucción...');

        // 1. Limpieza total con checks desactivados
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
        const tablas = ['PedidoItems', 'Pedidos', 'productos', 'Usuarios'];
        for (const tabla of tablas) {
            await sequelize.query(`DROP TABLE IF EXISTS ${tabla}`);
        }
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('🧹 DB Limpia.');

        // 2. Sincronización por ORDEN DE JERARQUÍA
        await Usuario.sync({ force: true });
        console.log('✅ Usuarios OK.');
        
        await Producto.sync({ force: true });
        await Pedido.sync({ force: true });
        console.log('✅ Productos y Pedidos OK.');
        
        await PedidoItem.sync({ force: true });
        console.log('✅ PedidoItems OK.');

        // Sincronización final para asentar asociaciones
        await sequelize.sync(); 
        
        await inicializarAdmin();
        
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 [READY]: Retail 24h AI operativo en puerto ${PORT}`);
        });

    } catch (err) {
        console.error('❌ [CRITICAL ERROR]:', err.message);
        process.exit(1);
    }
};

startServer();