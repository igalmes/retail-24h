const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const PedidoItem = sequelize.define('PedidoItem', {
    cantidad: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },
    precio_unitario: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    }
});

module.exports = PedidoItem;