const fs = require('fs');
const csv = require('csv-parser');
const Producto = require('../models/Producto');

const procesarDatosDiaAmerica = async (comercioId) => {
    return new Promise(async (resolve, reject) => {
        const ID_COMERCIO_DIA = "15";
        const ID_SUCURSAL_AMERICA = "367";
        const actualizaciones = [];

        try {
            // 1. Buscamos tus productos en la DB
            const misProductos = await Producto.findAll({ where: { comercioId } });
            
            // Creación correcta del Set (sin funciones anónimas rotas)
            const misEans = new Set(misProductos.map(p => p.codigo_barras).filter(ean => ean != null));

            console.log(`🔍 Escaneando dataset de América para ${misEans.size} productos registrados...`);

            // RUTA DE TU ONEDRIVE (Sin comillas extra)
            const rutaArchivo = 'C:/Users/ignac/OneDrive/Documents/igalmes/cosas/SEPA/productos.csv';

            if (!fs.existsSync(rutaArchivo)) {
                return reject(new Error(`No se encontró el archivo en: ${rutaArchivo}`));
            }

            fs.createReadStream(rutaArchivo)
                .pipe(csv({ separator: '|' })) 
                .on('data', (row) => {
                    // Filtro por Comercio 15, Sucursal 367 y tu EAN
                    if (row.id_comercio === ID_COMERCIO_DIA && 
                        row.id_sucursal === ID_SUCURSAL_AMERICA && 
                        misEans.has(row.productos_ean)) {
                        
                        const precioLimpio = row.productos_precio_lista.replace(',', '.');
                        
                        actualizaciones.push({
                            ean: row.productos_ean,
                            precio: parseFloat(precioLimpio)
                        });
                    }
                })
                .on('end', async () => {
                    console.log(`✨ Encontrados ${actualizaciones.length} precios para actualizar.`);
                    
                    for (const item of actualizaciones) {
                        await Producto.update(
                            { 
                                precio_sugerido: item.precio,
                                ultima_sincronizacion_api: new Date()
                            }, 
                            { where: { codigo_barras: item.ean, comercioId } }
                        );
                    }
                    console.log(`✅ Sincronización exitosa para comercio ${comercioId}.`);
                    resolve(actualizaciones);
                })
                .on('error', (err) => reject(err));

        } catch (error) {
            reject(error);
        }
    });
};

module.exports = { procesarDatosDiaAmerica };