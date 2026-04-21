const Producto = require('../models/Producto');
const geminiService = require('../services/geminiService');
const axios = require('axios');

/**
 * DETECTAR Y GUARDAR (IA + SEPA + DB)
 * Ahora basado en comercioId para que socios compartan el inventario detectado.
 */
exports.detectarYGuardar = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No se recibió imagen" });
        const imageUrl = req.file.path; 
        
        const productosIA = await geminiService.analizarGondola(imageUrl);
        if (!productosIA || productosIA.length === 0) {
            return res.status(200).json({ mensaje: "No se detectaron productos", count: 0 });
        }

        const productosProcesados = await Promise.all(productosIA.map(async (p) => {
            let precioSEPA = p.precio_sugerido || 0;
            if (p.ean && p.ean.length >= 8) {
                try {
                    const resSepa = await axios.get(`https://api.argentinadatos.com/v1/consumo/precios?ean=${p.ean}`, { timeout: 3000 });
                    if (resSepa.data?.precioUltimo) precioSEPA = resSepa.data.precioUltimo;
                } catch (e) { /* API externa offline */ }
            }

            return {
                nombre: String(p.nombre).substring(0, 255),
                marca: p.marca,
                categoria: p.categoria || 'General',
                precio_sugerido: Number(precioSEPA),
                precio_actualizado: Number(precioSEPA),
                codigo_barras: (p.ean === "null" || !p.ean) ? null : p.ean,
                imagen_url: imageUrl,
                comercioId: req.user.comercioId, // ASIGNACIÓN AL COMERCIO
                UsuarioId: req.user.id          // Registro de quién disparó la IA
            };
        }));

        // updateOnDuplicate asegura que si el EAN ya existe en la tabla, actualice los datos en lugar de fallar
        const productosGuardados = await Producto.bulkCreate(productosProcesados, {
            updateOnDuplicate: ["precio_actualizado", "precio_sugerido", "imagen_url", "updatedAt"]
        });

        res.status(201).json({ mensaje: "Inventario actualizado para el comercio", count: productosGuardados.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * OBTENER TODOS
 * Filtra por comercioId: Luciano y vos verán lo mismo.
 */
exports.obtenerTodos = async (req, res) => {
    try {
        const productos = await Producto.findAll({ 
            where: { comercioId: req.user.comercioId },
            order: [['updatedAt', 'DESC']]
        });
        res.json(productos);
    } catch (error) {
        res.status(500).json({ error: "Error al recuperar inventario del comercio" });
    }
};

/**
 * ACTUALIZAR
 * Permite que cualquier miembro del comercio (Admin/Socio) edite el producto.
 */
exports.actualizar = async (req, res) => {
    try {
        const { id } = req.params;
        const { precio_actualizado, nombre, stock_actual } = req.body;

        const precioNum = parseFloat(precio_actualizado);

        const [actualizado] = await Producto.update(
            { precio_actualizado: precioNum, nombre, stock_actual }, 
            { where: { id, comercioId: req.user.comercioId } }
        );

        if (actualizado === 0) return res.status(403).json({ error: "Producto no encontrado o no pertenece a tu comercio" });
        res.json({ mensaje: "Actualizado correctamente", precio: precioNum });
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
};

/**
 * ELIMINAR
 */
exports.eliminar = async (req, res) => {
    try {
        const eliminado = await Producto.destroy({ 
            where: { id: req.params.id, comercioId: req.user.comercioId } 
        });

        if (!eliminado) return res.status(404).json({ error: "Producto no encontrado en este comercio" });
        
        res.json({ mensaje: "Eliminado correctamente" });
    } catch (error) { 
        res.status(500).json({ error: "Error al eliminar" }); 
    }
};

/**
 * BUSCAR POR CÓDIGO (EAN)
 */
exports.buscarPorCodigo = async (req, res) => {
    try {
        const { ean } = req.params;
        const producto = await Producto.findOne({ 
            where: { codigo_barras: ean, comercioId: req.user.comercioId } 
        });
        
        if (!producto) {
            return res.status(404).json({ error: "El producto no existe en el inventario de este comercio" });
        }
        res.json(producto);
    } catch (error) {
        res.status(500).json({ error: "Error en búsqueda" });
    }
};

/**
 * AJUSTAR STOCK
 * Sincroniza stock basado en el comercioId del usuario/bot que lo solicita.
 */
exports.ajustarStock = async (req, res) => {
    try {
        const { ean } = req.params;
        const { cantidad } = req.body; 

        const producto = await Producto.findOne({ 
            where: { codigo_barras: ean, comercioId: req.user.comercioId } 
        });

        if (!producto) return res.status(404).json({ error: "Producto no encontrado en el comercio" });

        const delta = parseInt(cantidad);
        if (isNaN(delta)) return res.status(400).json({ error: "Cantidad inválida" });

        producto.stock_actual += delta;
        await producto.save();

        res.json({ 
            mensaje: "Stock sincronizado", 
            nuevo_stock: producto.stock_actual,
            producto: producto.nombre 
        });
    } catch (error) {
        res.status(500).json({ error: "Error al ajustar stock" });
    }
};