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
        // ENUM actualizado para soportar la jerarquía de tu sistema
        type: DataTypes.ENUM('admin', 'empleado', 'socio', 'cliente'), 
        defaultValue: 'cliente' 
    },
    telefono: {
        // Campo vital para que el bot de WhatsApp identifique al remitente
        type: DataTypes.STRING,
        unique: true,
        allowNull: true
    },
    // Relación con la tabla Comercios para el multi-tenancy del SaaS
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
    tableName: 'Usuarios', // Mantenemos coincidencia exacta con MySQL Workbench
    hooks: {
        beforeCreate: async (user) => {
            if (user.password) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(user.password, salt);
            }
        },
        // Agregamos beforeUpdate por si cambias la contraseña en el futuro
        beforeUpdate: async (user) => {
            if (user.changed('password')) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(user.password, salt);
            }
        }
    }
});

// Método para verificar la contraseña en el login
Usuario.prototype.validPassword = async function(password) {
    return await bcrypt.compare(password, this.password);
};

module.exports = Usuario;