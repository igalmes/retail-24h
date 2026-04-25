const { Sequelize } = require('sequelize');
require('dotenv').config();

let sequelize;

// Caso 1: Producción con URL completa (ej. Render o Aiven URI)
if (process.env.DATABASE_URL) {
    sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'mysql',
        logging: false,
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false
            }
        },
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    });
} else {
    // Caso 2: Variables sueltas (.env local o configuración manual en servidor)
    const isAiven = process.env.DB_HOST && process.env.DB_HOST.includes('aivencloud');
    
    // Si detecta Aiven, usa defaultdb. Si es localhost, usa el nombre del .env
    const dbName = isAiven ? 'defaultdb' : process.env.DB_NAME;

    sequelize = new Sequelize(
        dbName,
        process.env.DB_USER,
        process.env.DB_PASS,
        {
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 3306,
            dialect: 'mysql',
            logging: false,
            // SSL obligatorio para Aiven, opcional para local
            dialectOptions: isAiven ? {
                ssl: {
                    require: true,
                    rejectUnauthorized: false
                }
            } : {},
            pool: {
                max: 5,
                min: 0,
                acquire: 30000,
                idle: 10000
            }
        }
    );
}

module.exports = sequelize;