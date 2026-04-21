const express = require('express');
const router = express.Router();
const Configuracion = require('../models/Configuracion'); // Ajusta la ruta

// Obtener configuración
router.get('/', async (req, res) => {
    try {
        const config = await Configuracion.findOne() || await Configuracion.create({});
        res.json(config);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Actualizar configuración
router.put('/', async (req, res) => {
    try {
        const { nombreEmpresa, logoUrl } = req.body;
        let config = await Configuracion.findOne();
        if (!config) config = await Configuracion.create({});
        
        await config.update({ nombreEmpresa, logoUrl });
        res.json(config);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;