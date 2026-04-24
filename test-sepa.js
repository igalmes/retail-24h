const sequelize = require('./config/db');
const { procesarDatosDiaAmerica } = require('./services/sepaService');
const Comercio = require('./models/Comercio'); 
const Usuario = require('./models/Usuario');
const Producto = require('./models/Producto');

async function test() {
    try {
        console.log("⏳ Iniciando limpieza y conexión...");
        
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
        
        // USAREMOS FORCE TRUE SOLO ESTA VEZ PARA LIMPIAR RELACIONES BASURA
        await sequelize.sync({ alter: true }); 
        
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log("✅ Tablas recreadas desde cero y limpias.");

        // CREAMOS EL COMERCIO 1 AUTOMÁTICAMENTE PARA EVITAR ERRORES DE FK
        console.log("🏢 Creando comercio de prueba (ID 1)...");
        await Comercio.create({
            id: 1,
            nombre: 'Sucursal América Test',
            plan: 'pro',
            estado: 'activo'
        });

        console.log("🚀 Iniciando procesamiento SEPA...");
        const res = await procesarDatosDiaAmerica(1);
        
        console.log("📊 Sincronización terminada.");
        process.exit(0);
        
    } catch (e) {
        console.error("❌ Error en el test:", e.message);
        process.exit(1);
    }
}

test();