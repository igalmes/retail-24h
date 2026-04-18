const Producto = require('../models/Producto');
const geminiService = require('../services/geminiService');
const axios = require('axios');
const util = require('util');

exports.detectarYGuardar = async (req, res) => {
    console.log(">>> 1. Entrando a detectarYGuardar");
    try {
        if (!req.file) {
            console.log(">>> 2. Error: No hay file");
            return res.status(400).json({ error: "No se recibió imagen" });
        }

        const imageUrl = req.file.path; 
        console.log(">>> 3. URL de Cloudinary:", imageUrl);

        console.log(">>> 4. Llamando a Gemini...");
        let productosIA;
        try {
            productosIA = await geminiService.analizarGondola(imageUrl);
            console.log(">>> 5. Respuesta de Gemini recibida. Cantidad:", productosIA?.length);
        } catch (geminiErr) {
            console.log(">>> ERROR EN GEMINI STEP:", geminiErr.message);
            throw geminiErr;
        }
        
        if (!productosIA || productosIA.length === 0) {
            return res.status(200).json({ mensaje: "No detectado", count: 0 });
        }

        console.log(">>> 6. Mapeando productos con UsuarioId...");
        const productosConPrecioReal = await Promise.all(productosIA.map(async (p) => {
            let precioSEPA = p.precio_sugerido || 0;
            if (p.ean && p.ean !== "null" && p.ean.length >= 8) {
                try {
                    const resSepa = await axios.get(`https://api.argentinadatos.com/v1/consumo/precios?ean=${p.ean}`);
                    if (resSepa.data && resSepa.data.precioUltimo) precioSEPA = resSepa.data.precioUltimo;
                } catch (e) { 
                    console.log(">>> 6b. EAN no encontrado en SEPA:", p.ean);
                }
            }
            return {
                nombre: p.nombre,
                marca: p.marca,
                categoria: p.categoria || 'General',
                precio_sugerido: Number(precioSEPA), 
                codigo_barras: (p.ean === "null" || !p.ean) ? null : p.ean,
                imagen_url: imageUrl,
                // --- CAMBIO CLAVE: Asignamos el dueño del producto ---
                UsuarioId: req.user.id 
            };
        }));

        console.log(">>> 7. Guardando en Base de Datos (BulkCreate con UsuarioId)...");
        // Agregamos UsuarioId al updateOnDuplicate por si el usuario resube el mismo EAN
        const productosGuardados = await Producto.bulkCreate(productosConPrecioReal, {
            updateOnDuplicate: ["precio_sugerido", "imagen_url", "updatedAt", "UsuarioId"]
        });

        console.log(">>> 8. Éxito total para usuario:", req.user.id);
        res.status(201).json({ mensaje: "Éxito", count: productosGuardados.length });

    } catch (error) {
        console.log(">>> CATCH DEL CONTROLADOR ACTIVADO");
        console.error("MENSAJE DE ERROR:", error.message || "Sin mensaje");
        res.status(500).json({ error: "Error interno", details: error.message });
    }
};
exports.obtenerTodos = async (req, res) => {
    try {
        const productos = await Producto.findAll({ 
            where: { UsuarioId: req.user.id } // <--- SOLO los del usuario logueado
        });
        res.json(productos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.actualizar = async (req, res) => {
    try {
        await Producto.update(req.body, { where: { id: req.params.id } });
        res.json({ mensaje: "Actualizado" });
    } catch (error) { res.status(500).json({ error: "Error" }); }
};

exports.eliminar = async (req, res) => {
    try {
        await Producto.destroy({ where: { id: req.params.id } });
        res.json({ mensaje: "Eliminado" });
    } catch (error) { res.status(500).json({ error: "Error" }); }
};

// Agregá esto a tu productoController.js
exports.buscarPorCodigo = async (req, res) => {
    try {
        const { ean } = req.params;
        const producto = await Producto.findOne({ where: { codigo_barras: ean } });
        
        if (!producto) {
            return res.status(404).json({ error: "Producto no encontrado en inventario" });
        }
        res.json(producto);
    } catch (error) {
        res.status(500).json({ error: "Error al buscar producto" });
    }
};
exports.ajustarStock = async (req, res) => {
    try {
        const { ean } = req.params;
        const { cantidad } = req.body; // Puede ser positivo (10) o negativo (-2)

        const producto = await Producto.findOne({ where: { codigo_barras: ean } });
        if (!producto) return res.status(404).json({ error: "Producto no encontrado" });

        // Sumamos algebraicamente al stock actual
        producto.stock_actual += parseInt(cantidad);
        await producto.save();

        res.json({ 
            mensaje: "Stock actualizado", 
            nuevo_stock: producto.stock_actual,
            producto: producto.nombre 
        });
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar stock" });
    }
};