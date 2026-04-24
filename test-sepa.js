const sequelize = require('./config/db');
const { procesarDatosDiaAmerica } = require('./services/sepaService');
const Comercio = require('./models/Comercio'); 
const Usuario = require('./models/Usuario');
const Producto = require('./models/Producto');

async function test() {
    try {
        console.log("⏳ Iniciando conexión y limpieza de seguridad...");
        
        await sequelize.authenticate();
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
        
        // Sincronizamos para asegurar que las columnas nuevas (googleId, plan, etc) existan
        await sequelize.sync({ alter: true }); 
        
        console.log("✅ Estructura de tablas actualizada.");

        // 1. Aseguramos el Comercio 1
        console.log("🏢 Verificando Comercio ID 1...");
        const [comercio] = await Comercio.findOrCreate({
            where: { id: 1 },
            defaults: {
                nombre: 'Sucursal América Test',
                plan: 'pro',
                estado: 'activo'
            }
        });

        // 2. Aseguramos tu Usuario Admin (Para que no se borre al sincronizar)
        console.log("👤 Verificando Usuario Admin...");
        await Usuario.findOrCreate({
            where: { email: 'ignaciogalmes79@gmail.com' },
            defaults: {
                nombre: 'Ignacio',
                rol: 'admin',
                comercioId: 1,
                plan: 'pro',
                estado: 'activo'
            }
        });

        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

        console.log("🚀 Iniciando procesamiento SEPA (4303 productos)...");
        // Pasamos el ID 1 para que el service sepa a qué comercio asignar todo
        const res = await procesarDatosDiaAmerica(1);
        
        console.log("📊 Sincronización terminada con éxito.");
        
        // Verificación final en consola
        const count = await Producto.count({ where: { comercioId: 1 } });
        console.log(`total de productos en DB para comercio 1: ${count}`);

        process.exit(0);
        
    } catch (e) {
        console.error("❌ Error crítico en el test:", e.message);
        process.exit(1);
    }
}

test();