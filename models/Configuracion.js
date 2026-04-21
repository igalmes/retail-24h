const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Configuracion = sequelize.define('Configuracion', {
    nombreEmpresa: {
        type: DataTypes.STRING,
        defaultValue: "Retail 24h AI"
    },
    logoUrl: {
        type: DataTypes.TEXT, // Usamos TEXT por si guardas el logo en Base64 o URLs largas
        allowNull: true
    }
});

module.exports = Configuracion;