const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Producto = sequelize.define('Producto', {
    nombre: {
        type: DataTypes.STRING,
        allowNull: false
    },
    marca: {
        type: DataTypes.STRING
    },
    categoria: {
        type: DataTypes.STRING
    },
    precio_sugerido: {
        type: DataTypes.DECIMAL(10, 2)
    },
    stock_actual: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    imagen_url: {
        type: DataTypes.STRING
    },
    codigo_barras: {
        type: DataTypes.STRING,
        unique: true
    }
}, {
    tableName: 'productos', // Nombre exacto de la tabla que creamos en MySQL
    timestamps: true        // Esto maneja automáticamente createdAt y updatedAt
});

module.exports = Producto;