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

// Variable global para capturar el QR
global.ultimoQR = null;

app.use(cors());
app.use(express.json());

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

// --- CONFIGURACIÓN CRÍTICA PARA EL FRONTEND (VITE) ---

// Definimos la ruta absoluta a la carpeta dist
const distPath = path.resolve(process.cwd(), 'client', 'dist');

// 1. Forzar el servicio de la carpeta 'assets' (Donde están el JS y el CSS)
// Esto asegura que el navegador encuentre /assets/index-XXXX.css
app.use('/assets', express.static(path.join(distPath, 'assets')));

// 2. Servir el resto de la carpeta dist (favicon, imágenes estáticas, etc)
app.use(express.static(distPath));

// 3. Fallback para React Router: Cualquier ruta que no sea API o Assets, sirve el index.html
app.get('*', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(200).send("API Online. Si ves esto, Render no terminó de buildeado el frontend en: " + distPath);
    }
});

// --- ARRANQUE DEL SISTEMA ---
const startServer = async () => {
    try {
        await sequelize.authenticate();
        console.log('📡 Conexión con DB (Aiven) OK.');

        const Usuario = require('./models/Usuario');
        await sequelize.sync({ alter: false }); 
        
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 [READY]: Retail 24h AI corriendo en puerto ${PORT}`);
            
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