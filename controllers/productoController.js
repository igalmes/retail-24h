const Producto = require('../models/Producto');
const geminiService = require('../services/geminiService');
const axios = require('axios');

/**
 * DETECTAR Y GUARDAR (IA + SEPA + DB)
 * Blindado con UsuarioId para multi-tenancy (SaaS)
 */
exports.detectarYGuardar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No se recibió imagen" });
        }

        const imageUrl = req.file.path; 
        
        // Llamada segura a servicio IA
        const productosIA = await geminiService.analizarGondola(imageUrl);
        
        if (!productosIA || productosIA.length === 0) {
            return res.status(200).json({ mensaje: "No se detectaron productos", count: 0 });
        }

        // Enriquecimiento con API Externa (SEPA) y asignación de dueño
        const productosProcesados = await Promise.all(productosIA.map(async (p) => {
            let precioSEPA = p.precio_sugerido || 0;
            
            if (p.ean && p.ean.length >= 8) {
                try {
                    const resSepa = await axios.get(`https://api.argentinadatos.com/v1/consumo/precios?ean=${p.ean}`, { timeout: 3000 });
                    if (resSepa.data?.precioUltimo) precioSEPA = resSepa.data.precioUltimo;
                } catch (e) { 
                    // Silenciamos error de API externa para no romper el flujo
                }
            }

            return {
                nombre: String(p.nombre).substring(0, 255), // Sanitización básica de longitud
                marca: p.marca,
                categoria: p.categoria || 'General',
                precio_sugerido: Number(precioSEPA),
                precio_actualizado: Number(precioSEPA), // Inicializamos el precio real igual al sugerido
                codigo_barras: (p.ean === "null" || !p.ean) ? null : p.ean,
                imagen_url: imageUrl,
                UsuarioId: req.user.id // ASIGNACIÓN DEL DUEÑO
            };
        }));

        // Guardado masivo atómico
        const productosGuardados = await Producto.bulkCreate(productosProcesados, {
            updateOnDuplicate: ["precio_sugerido", "imagen_url", "updatedAt"]
        });

        res.status(201).json({ mensaje: "Inventario actualizado", count: productosGuardados.length });

    } catch (error) {
        console.error("Error en detectarYGuardar:", error.message);
        res.status(500).json({ error: "Error interno del servidor", details: error.message });
    }
};

/**
 * OBTENER PRODUCTOS
 * Filtro de seguridad estricto por UsuarioId
 */
exports.obtenerTodos = async (req, res) => {
    try {
        const productos = await Producto.findAll({ 
            where: { UsuarioId: req.user.id },
            order: [['updatedAt', 'DESC']]
        });
        res.json(productos);
    } catch (error) {
        res.status(500).json({ error: "Error al recuperar inventario" });
    }
};

/**
 * ACTUALIZAR (PRECIOS/DATOS)
 * Seguridad: Solo si el producto pertenece al usuario logueado
 */
exports.actualizar = async (req, res) => {
    try {
        const { id } = req.params;
        // Solo permitimos actualizar campos específicos por seguridad
        const { precio_actualizado, nombre, stock_actual } = req.body;

        const [actualizado] = await Producto.update(
            { precio_actualizado, nombre, stock_actual }, 
            { where: { id, UsuarioId: req.user.id } }
        );

        if (actualizado === 0) {
            return res.status(403).json({ error: "No autorizado o producto no encontrado" });
        }

        res.json({ mensaje: "Actualizado correctamente" });
    } catch (error) { 
        res.status(500).json({ error: "Error en la actualización" }); 
    }
};

/**
 * ELIMINAR
 * Seguridad: Validación de propiedad
 */
exports.eliminar = async (req, res) => {
    try {
        const eliminado = await Producto.destroy({ 
            where: { id: req.params.id, UsuarioId: req.user.id } 
        });

        if (!eliminado) return res.status(404).json({ error: "Producto no encontrado" });
        
        res.json({ mensaje: "Eliminado correctamente" });
    } catch (error) { 
        res.status(500).json({ error: "Error al eliminar" }); 
    }
};

/**
 * BUSCAR POR CÓDIGO (Para Scanner o Bot)
 */
exports.buscarPorCodigo = async (req, res) => {
    try {
        const { ean } = req.params;
        const producto = await Producto.findOne({ 
            where: { codigo_barras: ean, UsuarioId: req.user.id } 
        });
        
        if (!producto) {
            return res.status(404).json({ error: "El producto no está en tu inventario" });
        }
        res.json(producto);
    } catch (error) {
        res.status(500).json({ error: "Error en búsqueda" });
    }
};

/**
 * AJUSTAR STOCK (Bot de WhatsApp / Mercado Pago)
 */
exports.ajustarStock = async (req, res) => {
    try {
        const { ean } = req.params;
        const { cantidad } = req.body; 

        const producto = await Producto.findOne({ 
            where: { codigo_barras: ean, UsuarioId: req.user.id } 
        });

        if (!producto) return res.status(404).json({ error: "Producto no encontrado" });

        // Validación de tipo para evitar inyecciones de valores nulos o strings
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