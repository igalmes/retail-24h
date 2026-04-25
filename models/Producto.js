const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Producto = sequelize.define('Producto', {
    nombre: { type: DataTypes.STRING, allowNull: false },
    marca: { type: DataTypes.STRING },
    categoria: { type: DataTypes.STRING },
    precio_sugerido: { type: DataTypes.DECIMAL(10, 2) },
    precio_actualizado: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 }, 
    stock_actual: { type: DataTypes.INTEGER, defaultValue: 0 },
    // Mapeamos AMBAS para que Sequelize no falle al leer la tabla
    stock_minimo: { type: DataTypes.INTEGER, defaultValue: 5 },
    stock_minimo_alerta: { type: DataTypes.INTEGER, defaultValue: 5 }, // Esta aparece en tu Workbench
    imagen_url: { type: DataTypes.STRING },
    codigo_barras: { type: DataTypes.STRING },
    ultima_sincronizacion_api: { type: DataTypes.DATE },
    precio_compra: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    proveedor: { type: DataTypes.STRING, defaultValue: 'Sin Proveedor' },
    comercioId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'comercios', key: 'id' }
    },
    UsuarioId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'usuarios', key: 'id' }
    }
}, {
    tableName: 'productos',
    freezeTableName: true,
    timestamps: false, // Cambia a TRUE si en Workbench ves las columnas 'createdAt' o 'updatedAt'
    underscored: false
});

module.exports = Producto;