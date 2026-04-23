const { OAuth2Client } = require('google-auth-library');
const Usuario = require('../models/Usuario');
const jwt = require('jsonwebtoken');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// LOGIN CON GOOGLE
exports.googleLogin = async (req, res) => {
    const { idToken } = req.body; 
    if (!idToken) return res.status(400).json({ error: "Falta idToken" });

    try {
        const ticket = await client.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { email, sub: googleId } = payload;

        const user = await Usuario.findOne({ where: { email } });

        if (!user) {
            console.log(`🚫 Intento de Google Login bloqueado: ${email}`);
            return res.status(403).json({ error: "No autorizado", mensaje: "Tu correo no figura en el sistema." });
        }

        // Actualizamos el googleId si no lo tenía para vincular la cuenta
        if (!user.googleId) await user.update({ googleId });

        const token = jwt.sign(
            { id: user.id, email: user.email, rol: user.rol, comercioId: user.comercioId },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log(`✅ Google Login exitoso: ${email}`);
        res.json({ success: true, token, user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol } });
    } catch (error) {
        console.error("❌ Error Google Auth Detalle:", error.message);
        res.status(401).json({ error: "Fallo de autenticación con Google" });
    }
};

// LOGIN TRADICIONAL (Email/Password)
exports.loginTradicional = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await Usuario.findOne({ where: { email } });

        if (!user) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        // --- PUENTE DE EMERGENCIA PARA ADMIN ---
        // Si es tu mail, saltamos la validación de bcrypt temporalmente
        if (email === 'ignaciogalmes79@gmail.com') {
            console.log("⚠️ Acceso de emergencia bypass concedido para:", email);
        } else {
            // Para el resto, validación normal
            if (!user.password) {
                return res.status(400).json({ error: "Este usuario solo accede mediante Google." });
            }

            const esValido = await user.validPassword(password);
            if (!esValido) {
                return res.status(401).json({ error: "Contraseña incorrecta" });
            }
        }
        // --- FIN PUENTE ---

        // Verificamos que JWT_SECRET exista antes de firmar
        if (!process.env.JWT_SECRET) {
            console.error("❌ ERROR: JWT_SECRET no está definido en las variables de entorno.");
            return res.status(500).json({ error: "Error de configuración en el servidor" });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, rol: user.rol, comercioId: user.comercioId },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log(`✅ Login tradicional exitoso: ${email}`);

        res.json({
            success: true,
            token,
            user: { 
                id: user.id, 
                nombre: user.nombre, 
                email: user.email, 
                rol: user.rol,
                comercioId: user.comercioId 
            }
        });
    } catch (error) {
        console.error("❌ Error crítico en Login Tradicional:", error);
        res.status(500).json({ error: "Error interno del servidor", detalle: error.message });
    }
};