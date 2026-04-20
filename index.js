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

const app = express();
const PORT = process.env.PORT || 10000;

global.ultimoQR = null;

app.use(cors());
app.use(express.json());

// --- CONFIGURACIÓN DE FRONTEND (Prioridad para Assets) ---
const distPath = path.resolve(process.cwd(), 'client', 'dist');

// Servir la carpeta assets con prioridad absoluta
app.use('/assets', express.static(path.join(distPath, 'assets'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.css')) res.setHeader('Content-Type', 'text/css');
        if (path.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
    }
}));

// Servir el resto de dist
app.use(express.static(distPath));

// --- RUTA PARA EL QR ---
app.get('/qr', (req, res) => {
    if (!global.ultimoQR) {
        return res.send(`
            <html>
                <body style="background: #1a1a1a; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;">
                    <h2>El QR aún no se ha generado o el bot ya está conectado.</h2>
                    <p>Esperá unos segundos y refrescá la página.</p>
                    <script>setTimeout(() => { location.reload(); }, 3000);</script>
                </body>
            </html>
        `);
    }
    res.send(`
        <html>
            <body style="background: #1a1a1a; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; margin: 0;">
                <h2 style="margin-bottom: 20px;">Escaneá este QR con WhatsApp</h2>
                <div style="background: white; padding: 20px; border-radius: 15px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                    <img src="${global.ultimoQR}" style="width: 350px; height: 350px; image-rendering: pixelated;" />
                </div>
                <script>setTimeout(() => { location.reload(); }, 30000);</script>
            </body>
        </html>
    `);
});

// --- RUTAS API ---
app.use('/api/auth', authRoutes);
app.use('/api/productos', verifyToken, require('./routes/productoRoutes'));
app.use('/api/pagos', pagoRoutes); 

// Fallback para React Router
app.get('*', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(200).send("API Online. Esperando build final en: " + distPath);
    }
});

// --- ARRANQUE ---
const startServer = async () => {
    try {
        await sequelize.authenticate();
        console.log('📡 Conexión con DB OK.');
        const Usuario = require('./models/Usuario');
        await sequelize.sync({ alter: false }); 
        
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 [READY]: Retail 24h corriendo en puerto ${PORT}`);
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