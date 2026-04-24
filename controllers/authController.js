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

        // Buscamos al usuario por email
        const user = await Usuario.findOne({ where: { email } });

        if (!user) {
            console.log(`🚫 Intento de Google Login bloqueado (No en DB): ${email}`);
            return res.status(403).json({ 
                error: "No autorizado", 
                mensaje: "Tu correo no figura en el sistema. Contacta al administrador." 
            });
        }

        // Si el usuario existe pero no tiene el googleId vinculado, lo vinculamos
        if (!user.googleId) {
            try {
                await user.update({ googleId: googleId });
                console.log(`🔗 googleId vinculado para: ${email}`);
            } catch (updateError) {
                console.error("⚠️ Error vinculando googleId (posible columna faltante):", updateError.message);
                // Continuamos el login aunque falle el update para no trabar al admin
            }
        }

        // Generación del Token
        const token = jwt.sign(
            { id: user.id, email: user.email, rol: user.rol, comercioId: user.comercioId },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log(`✅ Google Login exitoso: ${email}`);
        res.json({ 
            success: true, 
            token, 
            user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol } 
        });

    } catch (error) {
        console.error("❌ Error Google Auth Detalle:", error.message);
        res.status(401).json({ error: "Fallo de autenticación con Google" });
    }
};

// LOGIN TRADICIONAL
exports.loginTradicional = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await Usuario.findOne({ where: { email } });

        if (!user) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        // --- PUENTE DE EMERGENCIA PARA ADMIN ---
        if (email === 'ignaciogalmes79@gmail.com') {
            console.log("⚠️ Acceso de emergencia bypass concedido para:", email);
        } else {
            if (!user.password) {
                return res.status(400).json({ error: "Este usuario solo accede mediante Google." });
            }

            // Asumiendo que tienes bcrypt configurado en el modelo
            const esValido = await user.validPassword(password);
            if (!esValido) {
                return res.status(401).json({ error: "Contraseña incorrecta" });
            }
        }

        if (!process.env.JWT_SECRET) {
            console.error("❌ ERROR: JWT_SECRET no definido.");
            return res.status(500).json({ error: "Error de configuración" });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, rol: user.rol, comercioId: user.comercioId },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

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