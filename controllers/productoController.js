const Producto = require('../models/Producto');
const geminiService = require('../services/geminiService');
const axios = require('axios');
const { Op } = require('sequelize');

/**
 * DETECTAR Y PROCESAR (IA + VALIDACIÓN DE REPETIDOS)
 */
exports.detectarYGuardar = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No se recibió imagen" });
        const imageUrl = req.file.path; 
        
        const productosIA = await geminiService.analizarGondola(imageUrl);
        if (!productosIA || productosIA.length === 0) {
            return res.status(200).json({ mensaje: "No se detectaron productos", count: 0 });
        }

        // 1. Extraemos los EANs detectados para buscar colisiones en la DB
        const eansDetectados = productosIA
            .map(p => p.ean)
            .filter(ean => ean && ean !== "null");

        // 2. Buscamos qué productos ya existen en este comercio
        const productosExistentes = await Producto.findAll({
            where: {
                comercioId: req.user.comercioId,
                codigo_barras: { [Op.in]: eansDetectados }
            }
        });

        const eansExistentes = productosExistentes.map(p => p.codigo_barras);

        // 3. Procesamos y enriquecemos con SEPA
        const productosProcesados = await Promise.all(productosIA.map(async (p) => {
            let precioSEPA = p.precio_sugerido || 0;
            const esRepetido = eansExistentes.includes(p.ean);

            if (p.ean && p.ean.length >= 8 && !esRepetido) {
                try {
                    const resSepa = await axios.get(`https://api.argentinadatos.com/v1/consumo/precios?ean=${p.ean}`, { timeout: 2500 });
                    if (resSepa.data?.precioUltimo) precioSEPA = resSepa.data.precioUltimo;
                } catch (e) { /* API SEPA Offline o Timeout */ }
            }

            return {
                nombre: String(p.nombre).substring(0, 255),
                marca: p.marca,
                categoria: p.categoria || 'General',
                precio_sugerido: Number(precioSEPA),
                precio_actualizado: Number(precioSEPA),
                codigo_barras: (p.ean === "null" || !p.ean) ? null : p.ean,
                imagen_url: imageUrl,
                comercioId: req.user.comercioId,
                UsuarioId: req.user.id,
                esRepetido: esRepetido // Flag para el frontend
            };
        }));

        // 4. Separamos para la respuesta
        const nuevosParaGuardar = productosProcesados.filter(p => !p.esRepetido);
        const duplicadosDetectados = productosProcesados.filter(p => p.esRepetido);

        // 5. Guardamos solo los nuevos automáticamente
        let guardados = [];
        if (nuevosParaGuardar.length > 0) {
            guardados = await Producto.bulkCreate(nuevosParaGuardar);
        }

        res.status(201).json({ 
            mensaje: "Procesamiento completado",
            nuevosCount: guardados.length,
            repetidos: duplicadosDetectados, // El frontend recibe estos para preguntar si confirmar
            totalDetectados: productosIA.length
        });

    } catch (error) {
        console.error("Error en detectarYGuardar:", error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * OBTENER TODOS + ESTADÍSTICAS BÁSICAS (Faltantes)
 */
exports.obtenerTodos = async (req, res) => {
    try {
        const productos = await Producto.findAll({ 
            where: { comercioId: req.user.comercioId },
            order: [['updatedAt', 'DESC']]
        });

        // Calculamos alertas de faltantes en el momento
        const faltantes = productos.filter(p => p.stock_actual <= p.stock_minimo_alerta);

        res.json({
            count: productos.length,
            alertasFaltantes: faltantes.length,
            productos
        });
    } catch (error) {
        res.status(500).json({ error: "Error al recuperar inventario" });
    }
};

/**
 * ACTUALIZAR (Incluye precio_compra y stock_minimo_alerta)
 */
exports.actualizar = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            precio_actualizado, 
            precio_compra, 
            nombre, 
            stock_actual, 
            stock_minimo_alerta,
            proveedor 
        } = req.body;

        const [actualizado] = await Producto.update(
            { 
                precio_actualizado, 
                precio_compra, 
                nombre, 
                stock_actual, 
                stock_minimo_alerta,
                proveedor 
            }, 
            { where: { id, comercioId: req.user.comercioId } }
        );

        if (actualizado === 0) return res.status(403).json({ error: "No encontrado" });
        res.json({ mensaje: "Producto actualizado correctamente" });
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
};

exports.eliminar = async (req, res) => {
    try {
        const eliminado = await Producto.destroy({ 
            where: { id: req.params.id, comercioId: req.user.comercioId } 
        });
        if (!eliminado) return res.status(404).json({ error: "No encontrado" });
        res.json({ mensaje: "Eliminado" });
    } catch (error) { 
        res.status(500).json({ error: "Error al eliminar" }); 
    }
};

exports.buscarPorCodigo = async (req, res) => {
    try {
        const producto = await Producto.findOne({ 
            where: { codigo_barras: req.params.ean, comercioId: req.user.comercioId } 
        });
        if (!producto) return res.status(404).json({ error: "No existe en inventario" });
        res.json(producto);
    } catch (error) {
        res.status(500).json({ error: "Error en búsqueda" });
    }
};
exports.confirmarRepetido = async (req, res) => {
    try {
        const { nombre, codigo_barras, precio_actualizado } = req.body;
        
        // Buscamos el producto existente
        const producto = await Producto.findOne({
            where: { 
                codigo_barras, 
                comercioId: req.user.comercioId 
            }
        });

        if (!producto) return res.status(404).json({ error: "Producto no encontrado" });

        // Lógica: Sumamos 1 al stock (o lo que definas) y actualizamos precio
        producto.stock_actual += 1;
        producto.precio_actualizado = precio_actualizado;
        await producto.save();

        res.json({ mensaje: "Stock y precio actualizados", producto });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.ajustarStock = async (req, res) => {
    try {
        const { ean } = req.params;
        const { cantidad } = req.body; 

        const producto = await Producto.findOne({ 
            where: { codigo_barras: ean, comercioId: req.user.comercioId } 
        });

        if (!producto) return res.status(404).json({ error: "Producto no encontrado" });

        producto.stock_actual += parseInt(cantidad);
        await producto.save();

        res.json({ 
            mensaje: "Stock actualizado", 
            nuevo_stock: producto.stock_actual,
            alerta: producto.stock_actual <= producto.stock_minimo_alerta 
        });
    } catch (error) {
        res.status(500).json({ error: "Error al ajustar stock" });
    }
};