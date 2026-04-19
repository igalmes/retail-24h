require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const sequelize = require('./config/db'); 
const whatsappBot = require('./services/whatsappService');
const authRoutes = require('./routes/authRoutes');
const verifyToken = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// --- RUTAS API ---
app.use('/api/auth', authRoutes);
app.use('/api/productos', verifyToken, require('./routes/productoRoutes'));
app.use('/api/pagos', verifyToken, require('./routes/pagoRoutes'));

// --- FRONTEND ---
const distPath = path.resolve(__dirname, 'client', 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(200).send("API Online. El frontend aún no está listo en: " + distPath);
    }
});

// --- ARRANQUE ---
const startServer = async () => {
    try {
        await sequelize.authenticate();
        console.log('📡 Conexión con DB OK.');

        // Sincronización segura (no borra datos)
        const Usuario = require('./models/Usuario');
        await Usuario.sync(); 
        
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 [READY]: Servidor en puerto ${PORT}`);
            // Iniciamos el bot con un delay para asegurar que el sistema está estable
            setTimeout(() => {
                whatsappBot.initialize(1).catch(err => {
                    console.error("⚠️ [BOT ERROR]:", err.message);
                });
            }, 5000);
        });
    } catch (err) {
        console.error('❌ [CRITICAL ERROR]:', err.message);
        process.exit(1);
    }
};

startServer();