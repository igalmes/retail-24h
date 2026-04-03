const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = process.env.DATABASE_URL 
    ? new Sequelize(process.env.DATABASE_URL, { // Para producción (Render)
        dialect: 'mysql',
        logging: false,
        dialectOptions: { ssl: { rejectUnauthorized: false } } 
      })
    : new Sequelize( // Para tu local
        process.env.DB_NAME, 
        process.env.DB_USER, 
        process.env.DB_PASS, 
        {
            host: process.env.DB_HOST,
            dialect: 'mysql',
            logging: false
        }
    );

module.exports = sequelize;