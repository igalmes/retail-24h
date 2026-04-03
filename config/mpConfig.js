const { MercadoPagoConfig } = require('mercadopago');
require('dotenv').config();

// 1. Capturamos el token
const token = process.env.MP_ACCESS_TOKEN;

// 2. Log de diagnóstico (Solo verás esto en Render)
if (!token) {
    console.error("❌ [ERROR CRÍTICO]: MP_ACCESS_TOKEN no detectado en Environment Variables.");
} else {
    console.log("✅ [SISTEMA]: MercadoPagoConfig detectado (Token inicializado).");
}

const client = new MercadoPagoConfig({ 
    accessToken: token || '' // Evita que el constructor rompa el proceso si es undefined
});

module.exports = client;