const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Pedido = sequelize.define('Pedido', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    total: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    estado_pago: {
        type: DataTypes.STRING,
        defaultValue: 'pendiente' // pendiente, aprobado, rechazado
    },
    mp_preference_id: {
        type: DataTypes.STRING, // Guardamos el ID que nos da Mercado Pago
        allowNull: true
    },
    external_reference: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4 // Un ID único para identificar la operación
    }
});

module.exports = Pedido;