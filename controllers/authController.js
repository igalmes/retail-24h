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
            return res.status(403).json({ error: "No autorizado", mensaje: "Tu correo no figura en el sistema." });
        }

        if (!user.googleId) await user.update({ googleId });

        const token = jwt.sign(
            { id: user.id, email: user.email, rol: user.rol, comercioId: user.comercioId },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ success: true, token, user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol } });
    } catch (error) {
        console.error("❌ Error Google Auth:", error.message);
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

        // Si el usuario se registró con Google y no tiene password
        if (!user.password) {
            return res.status(400).json({ error: "Este usuario solo accede mediante Google." });
        }

        const esValido = await user.validPassword(password);
        if (!esValido) {
            return res.status(401).json({ error: "Contraseña incorrecta" });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, rol: user.rol, comercioId: user.comercioId },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol }
        });
    } catch (error) {
        console.error("❌ Error Login Tradicional:", error.message);
        res.status(500).json({ error: "Error interno del servidor" });
    }
};