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

// --- ASOCIACIONES CON NOMBRES ÚNICOS ---
// Definimos nombres de constraints específicos para que Aiven no use los genéricos (ibfk_1)
Usuario.hasMany(Producto, { foreignKey: 'UsuarioId' });
Producto.belongsTo(Usuario, { foreignKey: 'UsuarioId', foreignKeyConstraintName: 'fk_prod_user_24h' });

Usuario.hasMany(Pedido, { foreignKey: 'UsuarioId' });
Pedido.belongsTo(Usuario, { foreignKey: 'UsuarioId', foreignKeyConstraintName: 'fk_ped_user_24h' });

Pedido.hasMany(PedidoItem, { foreignKey: 'PedidoId', onDelete: 'CASCADE' });
PedidoItem.belongsTo(Pedido, { foreignKey: 'PedidoId', foreignKeyConstraintName: 'fk_item_ped_24h' });

Producto.hasMany(PedidoItem, { foreignKey: 'ProductoId', onDelete: 'CASCADE' });
PedidoItem.belongsTo(Producto, { foreignKey: 'ProductoId', foreignKeyConstraintName: 'fk_item_prod_24h' });

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
        console.log('📡 Conexión establecida. Iniciando sincronización limpia...');

        // SINCRONIZACIÓN SECUENCIAL PARA EVITAR CONFLICTOS DE TABLA NO EXISTENTE
        await Usuario.sync({ force: true });
        console.log('✅ Usuarios sincronizados.');
        
        await Producto.sync({ force: true });
        await Pedido.sync({ force: true });
        console.log('✅ Productos y Pedidos sincronizados.');
        
        await PedidoItem.sync({ force: true });
        console.log('✅ PedidoItems sincronizados.');

        // Inicializar Admin
        await Usuario.findOrCreate({
            where: { email: 'ignaciogalmes79@gmail.com' },
            defaults: { nombre: 'Ignacio Galmes', password: 'password_provisoria_123', rol: 'admin' }
        });
        
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 [READY]: Retail 24h AI operativo.`);
        });

    } catch (err) {
        console.error('❌ [CRITICAL ERROR]:', err.message);
        process.exit(1);
    }
};

startServer();