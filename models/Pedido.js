const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Pedido = sequelize.define('Pedido', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    total: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    estado_pago: { type: DataTypes.STRING, defaultValue: 'pendiente' },
    mp_preference_id: { type: DataTypes.STRING, allowNull: true },
    external_reference: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    // CLAVE PARA MULTI-TENANT:
    UsuarioId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'usuarios', key: 'id' }
    }
});

module.exports = Pedido;