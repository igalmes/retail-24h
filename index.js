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

// --- GENERADOR DE NOMBRES ÚNICOS PARA CONSTRAINTS ---
// Esto evita el error "Duplicate foreign key constraint name"
const uid = Math.floor(Math.random() * 10000);

// --- ASOCIACIONES CON NOMBRES DINÁMICOS ---
Usuario.hasMany(Producto, { foreignKey: 'UsuarioId' });
Producto.belongsTo(Usuario, { foreignKey: 'UsuarioId' });

Usuario.hasMany(Pedido, { foreignKey: 'UsuarioId' });
Pedido.belongsTo(Usuario, { foreignKey: 'UsuarioId' });

// PedidoItem -> Pedido
Pedido.hasMany(PedidoItem, { 
    foreignKey: { name: 'PedidoId', allowNull: false }, 
    onDelete: 'CASCADE',
    constraints: true,
    foreignKeyConstraintName: `fk_pedido_item_ped_${uid}` // Nombre único
});
PedidoItem.belongsTo(Pedido, { 
    foreignKey: { name: 'PedidoId', allowNull: false },
    foreignKeyConstraintName: `fk_pedido_item_ped_rev_${uid}`
});

// PedidoItem -> Producto
Producto.hasMany(PedidoItem, { 
    foreignKey: { name: 'ProductoId', allowNull: false }, 
    onDelete: 'CASCADE',
    constraints: true,
    foreignKeyConstraintName: `fk_pedido_item_prod_${uid}` // Nombre único
});
PedidoItem.belongsTo(Producto, { 
    foreignKey: { name: 'ProductoId', allowNull: false },
    foreignKeyConstraintName: `fk_pedido_item_prod_rev_${uid}`
});

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

app.use('/api/auth', authRoutes);
app.use('/api/productos', verifyToken, require('./routes/productoRoutes')); 
app.use('/api/pagos', verifyToken, require('./routes/pagoRoutes')); 

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// --- ARRANQUE SECUENCIAL ---
const startServer = async () => {
    try {
        await sequelize.authenticate();
        console.log(`📡 Conexión OK. ID Sesión: ${uid}. Reconstruyendo...`);

        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
        await sequelize.query('DROP TABLE IF EXISTS PedidoItems, Pedidos, productos, Productos, Usuarios');
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('🧹 DB Limpia.');

        // Sincronización manual en orden estricto
        await Usuario.sync({ force: true });
        await Producto.sync({ force: true });
        await Pedido.sync({ force: true });
        await PedidoItem.sync({ force: true });
        
        console.log('✅ Estructura recreada con IDs únicos.');

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