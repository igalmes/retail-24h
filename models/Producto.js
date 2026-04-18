const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Producto = sequelize.define('Producto', {
    nombre: { type: DataTypes.STRING, allowNull: false },
    marca: { type: DataTypes.STRING },
    categoria: { type: DataTypes.STRING },
    precio_sugerido: { type: DataTypes.DECIMAL(10, 2) },
    precio_referencia: { type: DataTypes.DECIMAL(10, 2) },
    stock_actual: { type: DataTypes.INTEGER, defaultValue: 0 },
    stock_minimo: { type: DataTypes.INTEGER, defaultValue: 5 },
    imagen_url: { type: DataTypes.STRING },
    codigo_barras: { type: DataTypes.STRING }, // Sacamos el unique: true porque dos comercios pueden tener el mismo producto
    ultima_sincronizacion_api: { type: DataTypes.DATE },
    // CLAVE PARA MULTI-TENANT:
    UsuarioId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'Usuarios', key: 'id' }
    }
}, {
    tableName: 'productos', 
    timestamps: true        
});

module.exports = Producto;