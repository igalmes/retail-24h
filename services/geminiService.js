const axios = require("axios");
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;
const MODELO = "gemini-2.5-flash";
const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${apiKey}`;

/**
 * Helper para limpiar el formato Markdown que a veces devuelve la IA
 */
const limpiarJSON = (texto) => {
    return texto.replace(/```json/g, "").replace(/```/g, "").trim();
};

// Función para el Bot de WhatsApp (Texto)
const procesarChatBot = async (mensajeUsuario, rol = 'cliente', inventario = [], nombre = 'Usuario') => {
    try {
        // Formateamos el inventario para que Gemini no se maree con JSON gigante
        const stockResumido = inventario.length > 0 
            ? inventario.map(p => `- ${p.nombre}: $${p.precio_actualizado} (Stock: ${p.stock_actual})`).join('\n')
            : "No hay productos cargados actualmente.";

        const systemPrompt = `
        Eres el asistente de "Retail 24h AI". Estás hablando con ${nombre} (Rol: ${rol.toUpperCase()}).
        
        INSTRUCCIONES DE ROL:
        - Si es ADMIN o SOCIO: Tienes acceso total. Puedes dar reportes detallados y análisis de stock.
        - Si es CLIENTE: Sé un vendedor amable. No des números exactos de stock, solo di si hay o no.
        
        INVENTARIO REAL DE LA DB:
        ${stockResumido}
        
        REGLAS DE RESPUESTA:
        Responde ESTRICTAMENTE en JSON con este formato:
        {"esPedido": boolean, "items": [], "mensaje": "Tu respuesta aquí"}
        `;

        const payload = {
            contents: [{
                parts: [{
                    text: `${systemPrompt}\n\nMensaje del usuario: "${mensajeUsuario}"`
                }]
            }]
        };

        const result = await axios.post(url, payload);
        const rawText = result.data.candidates[0].content.parts[0].text;
        return JSON.parse(limpiarJSON(rawText));
    } catch (error) {
        console.error(`❌ Error Gemini:`, error.message);
        return { esPedido: false, items: [], mensaje: "Hola! ¿En qué puedo ayudarte?" };
    }
};
// Función para analizar imágenes (Góndola)
const analizarGondola = async (imageUrl) => {
    try {
        console.log(">>> 4. Descargando imagen para Gemini...");
        const responseImage = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const base64Data = Buffer.from(responseImage.data).toString('base64');

        const payload = {
            contents: [{
                parts: [
                    { text: "Analiza esta imagen de góndola. Busca productos y sus EAN-13. Devuelve estrictamente un JSON array: [{ \"nombre\": \"...\", \"ean\": \"...\", \"marca\": \"...\", \"precio_sugerido\": 0 }]. Si no hay EAN, genera uno aleatorio de 8 dígitos." },
                    { inline_data: { mime_type: "image/jpeg", data: base64Data } }
                ]
            }]
        };

        console.log(`>>> 5. Llamando a Gemini API (${MODELO})...`);
        const result = await axios.post(url, payload);
        
        if (!result.data.candidates || result.data.candidates.length === 0) {
            throw new Error("Gemini no devolvió candidatos.");
        }

        const rawText = result.data.candidates[0].content.parts[0].text;
        return JSON.parse(limpiarJSON(rawText));
    } catch (error) {
        console.error(`❌ Error Gemini Imagen (${MODELO}):`, error.message);
        throw error;
    }
};

module.exports = { analizarGondola, procesarChatBot };