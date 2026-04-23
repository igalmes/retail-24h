const { OAuth2Client } = require('google-auth-library');
const Usuario = require('../models/Usuario');
const jwt = require('jsonwebtoken');

// LOG CRÍTICO: Si esto sale como undefined en Render, el 401 seguirá
console.log("Configurando Google Client con ID:", process.env.GOOGLE_CLIENT_ID ? "Detectado ✅" : "FALTANTE ❌");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.googleLogin = async (req, res) => {
    const { idToken } = req.body; 

    if (!idToken) return res.status(400).json({ error: "Falta idToken" });

    try {
        const ticket = await client.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { email, name, sub: googleId } = payload;

        // 2. Buscar usuario en DB
        const user = await Usuario.findOne({ where: { email } });

        if (!user) {
            console.log(`🚫 Acceso bloqueado: ${email} no está en la lista blanca.`);
            return res.status(403).json({ 
                error: "No autorizado",
                mensaje: "Tu correo no figura en el sistema de gestión."
            });
        }

        // 3. Si existe pero no tiene googleId, se lo actualizamos
        if (!user.googleId) {
            await user.update({ googleId });
        }

        // 4. Generar JWT
        const token = jwt.sign(
            { id: user.id, email: user.email, rol: user.rol, comercioId: user.comercioId },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log(`✅ Sesión iniciada: ${email} (Rol: ${user.rol})`);

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
        console.error("❌ Error en Google Auth Detalle:", error.message);
        res.status(401).json({ error: "Fallo de autenticación con Google" });
    }
};