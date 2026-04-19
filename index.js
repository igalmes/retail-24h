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
        console.log('📡 Conexión establecida. Iniciando sincronización limpia...');

        // Sincronización en orden de jerarquía
        await Usuario.sync({ force: true });
        await Producto.sync({ force: true });
        await Pedido.sync({ force: true });
        await PedidoItem.sync({ force: true });
        
        console.log('🏗️ Estructura recreada con éxito.');

        await Usuario.findOrCreate({
            where: { email: 'ignaciogalmes79@gmail.com' },
            defaults: { nombre: 'Ignacio Galmes', password: 'password_provisoria_123', rol: 'admin' }
        });
        
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 [READY]: Retail 24h AI operativo.`);
            // El bot se inicializa en segundo plano para no demorar el deploy
            whatsappBot.initialize(1).catch(e => console.log("Bot cargando..."));
        });

    } catch (err) {
        console.error('❌ [CRITICAL ERROR]:', err.message);
        process.exit(1);
    }
};

startServer();