const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Producto = sequelize.define('Producto', {
    nombre: { type: DataTypes.STRING, allowNull: false },
    marca: { type: DataTypes.STRING },
    categoria: { type: DataTypes.STRING },
    precio_sugerido: { type: DataTypes.DECIMAL(10, 2) },
    precio_actualizado: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 }, 
    stock_actual: { type: DataTypes.INTEGER, defaultValue: 0 },
    stock_minimo: { type: DataTypes.INTEGER, defaultValue: 5 },
    imagen_url: { type: DataTypes.STRING },
    codigo_barras: { type: DataTypes.STRING },
    ultima_sincronizacion_api: { type: DataTypes.DATE },
    precio_compra: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    stock_minimo: { type: DataTypes.INTEGER, defaultValue: 5 },
    proveedor: { type: DataTypes.STRING, defaultValue: 'Sin Proveedor' },
    comercioId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'comercios',
            key: 'id'
        }
    },
    UsuarioId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'usuarios',
            key: 'id'
        }
    }
}, {
    tableName: 'productos',     // Forzamos el nombre exacto de la tabla
    freezeTableName: true,      // EVITA que Sequelize invente nombres como "Productos"
    timestamps: false,           // Tu tabla de Workbench no tiene las columnas de fecha, así que lo apagamos
    underscored: false
});

module.exports = Producto;