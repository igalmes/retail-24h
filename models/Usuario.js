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
        allowNull: false 
    },
    rol: { 
        type: DataTypes.ENUM('admin', 'empleado'), 
        defaultValue: 'admin' 
    },
    // --- CAMPOS DE CAPITALIZACIÓN Y SAAS ---
    plan: {
        type: DataTypes.ENUM('free', 'premium', 'pro'),
        defaultValue: 'free'
    },
    limiteProductos: {
        type: DataTypes.INTEGER,
        defaultValue: 15 // Límite inicial para que prueben la IA
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
    hooks: {
        beforeCreate: async (user) => {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(user.password, salt);
        }
    }
});

// Método para comparar contraseñas al loguearse
Usuario.prototype.validPassword = async function(password) {
    return await bcrypt.compare(password, this.password);
};

module.exports = Usuario;