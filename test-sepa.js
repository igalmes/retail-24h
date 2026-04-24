const sequelize = require('./config/db');
const { procesarDatosDiaAmerica } = require('./services/sepaService');
const Producto = require('./models/Producto');
const Usuario = require('./models/Usuario');

async function test() {
    try {
        console.log("⏳ Conectando a Aiven MySQL...");
        
        // Saltamos checks de FK para evitar líos con la tabla 'comercios'
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
        await sequelize.sync({ alter: true });
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
        
        console.log("✅ Tablas sincronizadas.");

        // IMPORTANTE: Asegurate de tener productos con comercioId = 1 en Workbench
        const res = await procesarDatosDiaAmerica(1);
        
        console.log("📊 Proceso finalizado.");
        process.exit(0);
    } catch (e) {
        console.error("❌ Error en el test:", e.message);
        process.exit(1);
    }
}

test();