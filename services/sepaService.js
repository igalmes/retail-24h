const fs = require('fs');
const csv = require('csv-parser');
const Producto = require('../models/Producto');

const procesarDatosDiaAmerica = async (comercioId) => {
    // Definimos los IDs según la imagen del CSV
    const ID_COMERCIO_DIA = "15";
    const ID_SUCURSAL_AMERICA = "1"; 
    
    let nuevos = 0;
    let actualizados = 0;
    const targetComercioId = parseInt(comercioId); // Aseguramos que sea entero

    try {
        const rutaArchivo = 'C:/Users/ignac/OneDrive/Documents/igalmes/cosas/SEPA/productos.csv';

        if (!fs.existsSync(rutaArchivo)) {
            throw new Error(`No se encontró el archivo en: ${rutaArchivo}`);
        }

        console.log("⏳ Leyendo dataset y poblando base de datos... (esto llevará unos minutos)");

        const stream = fs.createReadStream(rutaArchivo).pipe(csv({ separator: '|' }));

        for await (const row of stream) {
            if (row.id_comercio === ID_COMERCIO_DIA && row.id_sucursal === ID_SUCURSAL_AMERICA) {
                
                const precioLimpio = row.productos_precio_lista.replace(',', '.');
                const ean = row.productos_ean;

                try {
                    // Upsert blindado
                    await Producto.upsert({
                        codigo_barras: ean,
                        nombre: row.productos_descripcion,
                        marca: row.productos_marca || 'Genérica',
                        precio_sugerido: parseFloat(precioLimpio),
                        precio_actualizado: parseFloat(precioLimpio),
                        comercioId: targetComercioId,
                        ultima_sincronizacion_api: new Date()
                    });

                    nuevos++;

                    if (nuevos % 100 === 0) {
                        console.log(`📦 Procesados: ${nuevos} productos exitosamente...`);
                    }

                } catch (dbError) {
                    // Si falla, te dirá exactamente qué ID está rompiendo
                    console.error(`⚠️ Error en EAN ${ean} (ComercioId: ${targetComercioId}):`, dbError.message);
                }
            }
        }

        console.log(`\n✨ RESUMEN FINAL:`);
        console.log(`   - Procesados con éxito: ${nuevos}`);
        
        return { nuevos };

    } catch (error) {
        console.error("❌ Error crítico en sepaService:", error.message);
        throw error;
    }
};

module.exports = { procesarDatosDiaAmerica };