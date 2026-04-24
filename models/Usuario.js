const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const bcrypt = require('bcryptjs');

const Usuario = sequelize.define('Usuario', {
    nombre: { 
        type: DataTypes.STRING, 
        allowNull: false 
    },
    email: { 
        type: DataTypes.STRING, 
        unique: true, 
        allowNull: false 
    },
    password: { 
        type: DataTypes.STRING, 
        allowNull: true // CAMBIO: Permitimos null para usuarios de Google
    },
    googleId: { 
        type: DataTypes.STRING,
        unique: true,
        allowNull: true
    },
    rol: { 
        type: DataTypes.ENUM('admin', 'empleado', 'socio', 'cliente'), 
        defaultValue: 'cliente' 
    },
    telefono: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: true
    },
    comercioId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'Comercios',
            key: 'id'
        }
    },
    plan: {
        type: DataTypes.ENUM('free', 'premium', 'pro'),
        defaultValue: 'free'
    },
    limiteProductos: {
        type: DataTypes.INTEGER,
        defaultValue: 15
    },
    productosCargados: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    estadoSuscripcion: {
        type: DataTypes.ENUM('activo', 'suspendido', 'pendiente_pago'),
        defaultValue: 'activo'
    }
}, {
    tableName: 'usuarios',
    hooks: {
        beforeCreate: async (user) => {
            if (user.password) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(user.password, salt);
            }
        },
        beforeUpdate: async (user) => {
            if (user.changed('password') && user.password) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(user.password, salt);
            }
        }
    }
});

Usuario.prototype.validPassword = async function(password) {
    if (!this.password) return false;
    return await bcrypt.compare(password, this.password);
};

module.exports = Usuario;