const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Comercio = sequelize.define('Comercio', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false
  },
  plan: {
    type: DataTypes.ENUM('free', 'premium', 'pro'),
    defaultValue: 'free'
  },
  estado: {
    type: DataTypes.ENUM('activo', 'suspendido'),
    defaultValue: 'activo'
  }
}, {
  tableName: 'Comercios',
  timestamps: true
});

module.exports = Comercio;