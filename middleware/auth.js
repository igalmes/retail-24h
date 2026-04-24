const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario'); 

/**
 * Middleware de Autenticación Híbrido
 * Soporta: 
 * 1. Authorization: Bearer <TOKEN_JWT> (Para el Bot y App)
 * 2. x-user-email: <EMAIL> (Para el Frontend actual)
 */
module.exports = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const userEmail = req.headers['x-user-email'];
        let userFound = null;

        // --- 1. VALIDACIÓN POR JWT (Prioridad Segura) ---
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                // Verificamos el token con la clave secreta de tu .env
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                
                // Buscamos al usuario excluyendo la contraseña por seguridad
                userFound = await Usuario.findByPk(decoded.id, {
                    attributes: { exclude: ['password'] }
                });

                if (userFound) {
                    req.user = userFound; // Inyectamos el usuario en la request
                    //console.log(`✅ [AUTH JWT] Usuario: ${userFound.email} (Rol: ${userFound.rol})`);
                    return next(); 
                }
            } catch (err) {
                console.error("⚠️ [AUTH JWT] Error:", err.message);
                return res.status(403).json({ error: "Sesión expirada o token inválido" });
            }
        }

        // --- 2. VALIDACIÓN POR EMAIL (Legacy/Frontend) ---
        if (userEmail) {
            userFound = await Usuario.findOne({ 
                where: { email: userEmail },
                attributes: { exclude: ['password'] }
            });
            
            if (userFound) {
                req.user = userFound;
                // Log de acceso para auditoría simple
                console.log(`ℹ️ [AUTH EMAIL] Acceso por header legacy: ${userEmail}`);
                return next(); 
            } else {
                console.log(`❌ [AUTH EMAIL] Denegado: ${userEmail} no existe en Aiven.`);
                return res.status(403).json({ error: "Acceso denegado: Usuario no registrado." });
            }
        }

        // --- 3. FALLO TOTAL DE IDENTIFICACIÓN ---
        console.warn("🚫 [AUTH] Intento de acceso sin credenciales.");
        return res.status(401).json({ 
            error: "Identificación requerida",
            message: "Debe proveer un Bearer Token o un x-user-email válido." 
        });

    } catch (error) {
        console.error("❌ [CRITICAL] Error en Middleware Auth:", error.message);
        res.status(500).json({ error: "Error interno de validación" });
    }
};