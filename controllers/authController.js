const { OAuth2Client } = require('google-auth-library');
const Usuario = require('../models/Usuario');
const jwt = require('jsonwebtoken');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.googleLogin = async (req, res) => {
    const { idToken } = req.body; 

    try {
        // 1. Validar el token con Google
        const ticket = await client.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { email, name, picture } = payload;

        // 2. Buscar el usuario en la lista blanca (Base de datos Aiven)
        // IMPORTANTE: Aquí NO creamos al usuario si no existe.
        const user = await Usuario.findOne({ where: { email } });

        if (!user) {
            console.log(`🚫 Intento de acceso bloqueado: ${email} no está autorizado.`);
            return res.status(403).json({ 
                error: "No tienes permisos de acceso",
                mensaje: "Este correo no figura en la lista de personal autorizado."
            });
        }

        // 3. Generar JWT propio (usando tu JWT_SECRET de Render)
        const token = jwt.sign(
            { id: user.id, email: user.email, rol: user.rol },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log(`✅ Acceso concedido a: ${email}`);

        res.json({
            success: true,
            token,
            user: { 
                nombre: user.nombre, 
                email: user.email, 
                foto: picture // Usamos la de Google para el avatar
            }
        });

    } catch (error) {
        console.error("❌ Error en Google Auth:", error);
        res.status(400).json({ error: "Token de Google inválido" });
    }
};