require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const sequelize = require('./config/db'); 
const whatsappBot = require('./services/whatsappService');
const authRoutes = require('./routes/authRoutes');
const verifyToken = require('./middleware/auth');
const pagoRoutes = require('./routes/pagoRoutes');
const configRoutes = require('./routes/configRoutes');
const comercioRoutes = require('./routes/comercioRoutes');

const app = express();
const PORT = process.env.PORT || 10000;

app.set('trust proxy', 1);
global.ultimoQR = null;

app.use(cors());
app.use(express.json());

const distPath = path.resolve(process.cwd(), 'client', 'dist');
app.use('/assets', express.static(path.join(distPath, 'assets'), {
    immutable: true,
    maxAge: '1y'
}));
app.use(express.static(distPath));

// --- RUTAS DE LA API ---
app.use('/api/auth', authRoutes);
app.use('/api/productos', verifyToken, require('./routes/productoRoutes'));
app.use('/api/pagos', verifyToken, pagoRoutes); 
app.use('/api/config', verifyToken, configRoutes);
app.use('/api/comercios', comercioRoutes)

app.get('/qr', (req, res) => {
    if (global.ultimoQR) {
        res.send(`<html><body style="display:flex;justify-content:center;align-items:center;height:100vh;background:#000;"><img src="${global.ultimoQR}" style="border:10px solid white;border-radius:10px;" /></body></html>`);
    } else {
        res.send("QR no disponible. El bot ya podría estar conectado.");
    }
});

app.get('*', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(200).send("API Online. Esperando build del cliente...");
    }
});

const startServer = async () => {
    try {
        await sequelize.authenticate();
        // IMPORTANTE: force: false y alter: false para producción (Render)
        // Esto evita que se borren los productos al reiniciar el server
        await sequelize.sync({ force: false, alter: false }); 
        console.log('✅ Base de datos conectada y estable.');
        
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Servidor en puerto ${PORT}`);
            setTimeout(() => {
                whatsappBot.initialize(1).catch(err => console.error("Error Bot:", err));
            }, 5000);
        });
    } catch (err) {
        console.error('❌ Error al iniciar:', err);
        process.exit(1);
    }
};

startServer();