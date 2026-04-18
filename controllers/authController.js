const { OAuth2Client } = require('google-auth-library');
const Usuario = require('../models/Usuario');
const jwt = require('jsonwebtoken');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.googleLogin = async (req, res) => {
    const { idToken } = req.body; // El token que viene del frontend

    try {
        // 1. Validar el token con Google
        const ticket = await client.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { email, name, picture } = payload;

        // 2. Buscar o Crear el usuario en Aiven
        let user = await Usuario.findOne({ where: { email } });

        if (!user) {
            // Si no existe, lo creamos (Login Social)
            // Le ponemos una pass aleatoria porque usará OAuth
            user = await Usuario.create({
                nombre: name,
                email: email,
                password: Math.random().toString(36).slice(-10), // Pass dummy
                rol: 'admin' 
            });
            console.log(`✅ [AIVEN] Nuevo usuario creado vía Google: ${email}`);
        }

        // 3. Generar TU Token JWT para el resto de la sesión
        const token = jwt.sign(
            { id: user.id, email: user.email, rol: user.rol },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            mensaje: "Autenticación exitosa",
            token,
            user: { nombre: user.nombre, email: user.email, foto: picture }
        });

    } catch (error) {
        console.error("❌ Error en Google Auth:", error);
        res.status(400).json({ error: "Token de Google inválido" });
    }
};