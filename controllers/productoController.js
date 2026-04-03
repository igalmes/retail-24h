const Producto = require('../models/Producto');
const geminiService = require('../services/geminiService');
const axios = require('axios');

exports.detectarYGuardar = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No se recibió imagen" });

        // 1. Gemini identifica el producto y busca el EAN
        const productosIA = await geminiService.analizarGondola(req.file.path);
        
        const urlCompleta = `http://localhost:4000/uploads/${req.file.filename}`;

        // 2. Mapeamos y consultamos el dataset SEPA para cada producto detectado
        const productosConPrecioReal = await Promise.all(productosIA.map(async (p) => {
            let precioSEPA = 0;

            // Si la IA detectó un código de barras, consultamos el dataset diario de SEPA
            if (p.ean && p.ean !== "null") {
                try {
                    // Consultamos el dataset de Precios Claros (SEPA) vía ArgentinaDatos
                    const resSepa = await axios.get(`https://api.argentinadatos.com/v1/consumo/precios?ean=${p.ean}`);
                    
                    // Intentamos obtener el precio último reportado
                    precioSEPA = resSepa.data.precioUltimo || 0;
                } catch (e) { 
                    console.log(`EAN ${p.ean} no encontrado en SEPA o error de conexión.`); 
                }
            }

            return {
                nombre: p.nombre,
                marca: p.marca,
                categoria: p.categoria,
                precio_sugerido: precioSEPA > 0 ? precioSEPA : 0, 
                codigo_barras: p.ean === "null" ? null : p.ean,
                imagen_url: urlCompleta
            };
        }));

        // 3. Guardamos o actualizamos (updateOnDuplicate para refrescar precios si ya existen)
        const productosGuardados = await Producto.bulkCreate(productosConPrecioReal, {
            updateOnDuplicate: ["precio_sugerido", "imagen_url", "updatedAt"]
        });

        res.status(201).json({ mensaje: "Escaneo SEPA completado", data: productosGuardados });
    } catch (error) {
        console.error("Error en detección/SEPA:", error);
        res.status(500).json({ error: "Error en escaneo con dataset SEPA" });
    }
};

exports.obtenerTodos = async (req, res) => {
    try {
        const productos = await Producto.findAll({ order: [['createdAt', 'DESC']] });

        // Retorno limpio: mostramos el precio de la DB (el de SEPA o el que editaste)
        const data = productos.map(p => {
            const prod = p.toJSON();
            return {
                ...prod,
                fotoUrl: prod.imagen_url,
                precio_actualizado: prod.precio_sugerido, // Sin cálculos extra para mantener estabilidad
                tendencia: 'equal'
            };
        });

        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: "Error al obtener productos" });
    }
};

exports.actualizar = async (req, res) => {
    try {
        const { id } = req.params;
        // Permite que vos corrijas el precio manualmente si el SEPA no es exacto en tu zona
        await Producto.update(req.body, { where: { id } });
        res.json({ mensaje: "Actualizado con éxito" });
    } catch (error) { 
        res.status(500).json({ error: "Error al actualizar el producto" }); 
    }
};

exports.eliminar = async (req, res) => {
    try {
        await Producto.destroy({ where: { id: req.params.id } });
        res.json({ mensaje: "Eliminado" });
    } catch (error) { 
        res.status(500).json({ error: "Error al eliminar" }); 
    }
};