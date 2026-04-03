const { Sequelize } = require('sequelize');
require('dotenv').config();

// Verificamos si estamos en producción (Render)
const isProduction = process.env.NODE_ENV === 'production';

const sequelize = new Sequelize(
    process.env.DB_NAME, 
    process.env.DB_USER, 
    process.env.DB_PASS, 
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306, // Usa 28756 de Aiven o 3306 local
        dialect: 'mysql',
        logging: false,
        /* CONFIGURACIÓN DE SEGURIDAD PARA AIVEN
           Se activa automáticamente si detecta que estás en producción
        */
        dialectOptions: isProduction ? {
            ssl: {
                require: true,
                rejectUnauthorized: false 
            }
        } : {}, // En local (sin SSL) queda vacío
    }
);

// Test de conexión rápido (opcional, ayuda a ver errores en los logs)
sequelize.authenticate()
    .then(() => console.log('📡 Conexión con el servidor de DB establecida.'))
    .catch(err => console.error('❌ No se pudo conectar con la DB:', err));

module.exports = sequelize;