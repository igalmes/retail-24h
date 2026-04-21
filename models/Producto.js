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
    // NUEVO: El eje de la consulta ahora es el comercio
    comercioId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Comercios',
            key: 'id'
        }
    },
    // Opcional: quién lo creó originalmente
    UsuarioId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'Usuarios',
            key: 'id'
        }
    }
}, {
    tableName: 'productos', // Importante: minúsculas como en tu DB
    timestamps: true        
});

module.exports = Producto;