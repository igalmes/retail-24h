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
        type: DataTypes.ENUM('admin', 'empleado', 'socio', 'cliente'), 
        defaultValue: 'cliente' // Cambiado a cliente por seguridad
    },
    telefono: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: true
    },
    // NUEVO: Relación con la tabla Comercios
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
    tableName: 'Usuarios', // Aseguramos que coincida con tu DB
    hooks: {
        beforeCreate: async (user) => {
            if (user.password) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(user.password, salt);
            }
        }
    }
});

Usuario.prototype.validPassword = async function(password) {
    return await bcrypt.compare(password, this.password);
};

module.exports = Usuario;