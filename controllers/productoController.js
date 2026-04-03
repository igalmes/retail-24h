const Producto = require('../models/Producto');
const geminiService = require('../services/geminiService');
const axios = require('axios');

exports.detectarYGuardar = async (req, res) => {
    try {
        // Validación de archivo (Multer + Cloudinary)
        if (!req.file) return res.status(400).json({ error: "No se recibió imagen" });

        // IMPORTANTE: req.file.path ahora es la URL de Cloudinary (https://res.cloudinary.com/...)
        const imageUrl = req.file.path; 

        // 1. Gemini analiza la imagen usando la URL de la nube
        const productosIA = await geminiService.analizarGondola(imageUrl);
        
        // 2. Mapeamos y consultamos el dataset SEPA (ArgentinaDatos)
        const productosConPrecioReal = await Promise.all(productosIA.map(async (p) => {
            let precioSEPA = 0;

            // Consultar EAN en API de precios claros si existe
            if (p.ean && p.ean !== "null") {
                try {
                    const resSepa = await axios.get(`https://api.argentinadatos.com/v1/consumo/precios?ean=${p.ean}`);
                    // Tomamos el precio último reportado o el sugerido por la IA como backup
                    precioSEPA = resSepa.data.precioUltimo || p.precio_sugerido || 0;
                } catch (e) { 
                    console.log(`EAN ${p.ean} no encontrado. Usando backup de IA.`);
                    precioSEPA = p.precio_sugerido || 0;
                }
            } else {
                precioSEPA = p.precio_sugerido || 0;
            }

            return {
                nombre: p.nombre,
                marca: p.marca,
                categoria: p.categoria,
                precio_sugerido: Number(precioSEPA), 
                codigo_barras: (p.ean === "null" || !p.ean) ? null : p.ean,
                imagen_url: imageUrl // Guardamos la URL de Cloudinary, no localhost
            };
        }));

        // 3. Guardar en DB (Update on duplicate por si el producto ya existe)
        const productosGuardados = await Producto.bulkCreate(productosConPrecioReal, {
            updateOnDuplicate: ["precio_sugerido", "imagen_url", "updatedAt"]
        });

        res.status(201).json({ 
            mensaje: "Escaneo y sincronización SEPA exitosa", 
            count: productosGuardados.length 
        });

    } catch (error) {
        console.error("Error crítico en controlador:", error);
        res.status(500).json({ error: "Fallo en el procesamiento de IA o base de datos" });
    }
};

exports.obtenerTodos = async (req, res) => {
    try {
        const productos = await Producto.findAll({ order: [['createdAt', 'DESC']] });
        const data = productos.map(p => {
            const prod = p.toJSON();
            return {
                ...prod,
                fotoUrl: prod.imagen_url, // URL de Cloudinary
                precio_actualizado: prod.precio_sugerido,
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
        await Producto.update(req.body, { where: { id } });
        res.json({ mensaje: "Actualizado con éxito" });
    } catch (error) { 
        res.status(500).json({ error: "Error al actualizar" }); 
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