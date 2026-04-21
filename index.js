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

const app = express();
const PORT = process.env.PORT || 10000;

global.ultimoQR = null;

// 1. MIDDLEWARES GLOBALES
app.use(cors());
app.use(express.json());

// 2. CONFIGURACIÓN DE ARCHIVOS ESTÁTICOS
const distPath = path.resolve(process.cwd(), 'client', 'dist');

app.use('/assets', express.static(path.join(distPath, 'assets'), {
    immutable: true,
    maxAge: '1y',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css');
        if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
    }
}));

app.use(express.static(distPath));

// 3. RUTAS DE LA API
app.use('/api/auth', authRoutes);
// Importante: verifyToken protege el acceso a productos y pagos
app.use('/api/productos', verifyToken, require('./routes/productoRoutes'));
app.use('/api/pagos', verifyToken, pagoRoutes); 
app.use('/api/config', verifyToken, configRoutes);

// 4. RUTA PARA EL QR
app.get('/qr', (req, res) => {
    if (!global.ultimoQR) {
        return res.send(`
            <html>
                <body style="background:#0f172a;color:#f8fafc;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
                    <div style="padding:2rem;background:#1e293b;border-radius:1rem;text-align:center;">
                        <h2>⏳ Generando QR...</h2>
                        <p>El bot se está iniciando. Refrescamos en breve.</p>
                    </div>
                    <script>setTimeout(() => { location.reload(); }, 3000);</script>
                </body>
            </html>
        `);
    }
    res.send(`
        <html>
            <body style="background:#0f172a;margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
                <h2 style="color:#f8fafc;margin-bottom:1.5rem;">Escaneá para Vincular WhatsApp</h2>
                <div style="background:#fff;padding:1.5rem;border-radius:1.5rem;">
                    <img src="${global.ultimoQR}" style="width:350px;height:350px;display:block;" />
                </div>
                <script>setTimeout(() => { location.reload(); }, 30000);</script>
            </body>
        </html>
    `);
});

// 5. FALLBACK PARA REACT
app.get('*', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(200).send("API Online. Build de cliente no detectado.");
    }
});

// 6. ARRANQUE DEL SERVIDOR
const startServer = async () => {
    try {
	console.log('Intentando conectar a:', process.env.DATABASE_URL ? "URL Detectada" : "URL No definida");
        await sequelize.authenticate();
        console.log('📡 Conexión con DB OK.');
        
        // Sincronización con alter:true para actualizar columnas sin borrar datos
        await sequelize.sync({ alter: true }); 
        console.log('✅ Tablas sincronizadas correctamente.');
        
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 [READY]: Retail 24h en puerto ${PORT}`);
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