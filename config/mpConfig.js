const { MercadoPagoConfig } = require('mercadopago');
require('dotenv').config();

const client = new MercadoPagoConfig({ 
    accessToken: process.env.MP_ACCESS_TOKEN 
});

module.exports = client;