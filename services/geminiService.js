const axios = require("axios");
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;
// Usamos 1.5-flash para mayor estabilidad y evitar errores 429 de cuota
const MODELO = "gemini-1.5-flash"; 
const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${apiKey}`;

/**
 * Helper para limpiar el formato Markdown que a veces devuelve la IA
 */
const limpiarJSON = (texto) => {
    try {
        return texto.replace(/```json/g, "").replace(/```/g, "").trim();
    } catch (e) {
        return texto;
    }
};

// Función para el Bot de WhatsApp (Texto)
const procesarChatBot = async (mensajeUsuario, rol = 'cliente', inventario = [], nombre = 'Usuario') => {
    try {
        // Reducimos el inventario a 20 items para no saturar la API y evitar el error 429
        const stockResumido = inventario.length > 0 
            ? inventario.slice(0, 20).map(p => `- ${p.nombre}: $${p.precio_actualizado} (Stock: ${p.stock_actual})`).join('\n')
            : "No hay productos cargados actualmente.";

        const systemPrompt = `
        Eres el asistente de "Retail 24h AI". Estás hablando con ${nombre} (Rol: ${rol.toUpperCase()}).
        
        INSTRUCCIONES DE ACCIÓN:
        - Si el rol es ADMIN o SOCIO y el usuario quiere:
            1. AGREGAR/AÑADIR: Usa accion "crear". Extrae nombre, precio y cantidad.
            2. ELIMINAR/BORRAR: Usa accion "eliminar". Identifica el nombre exacto del producto del inventario.
            3. MODIFICAR/ACTUALIZAR: Usa accion "actualizar".
        - Si no hay una instrucción clara de cambio, usa accion "ninguna".
        
        INVENTARIO REAL ACTUAL (Muestra limitada):
        ${stockResumido}
        
        REGLAS DE RESPUESTA:
        Responde ESTRICTAMENTE en JSON con este formato:
        {
          "esPedido": boolean,
          "accion": "crear" | "eliminar" | "actualizar" | "ninguna",
          "payload": { "nombre": "nombre del producto", "cantidad": 0, "precio": 0 },
          "mensaje": "Tu respuesta amable al usuario confirmando lo que hiciste o respondiendo su duda"
        }
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
        if (error.response && error.response.status === 429) {
            return { esPedido: false, accion: "ninguna", payload: {}, mensaje: "Estoy procesando muchos mensajes, por favor espera unos segundos. 🤖" };
        }
        console.error(`❌ Error Gemini:`, error.message);
        return { esPedido: false, accion: "ninguna", payload: {}, mensaje: "Hola! ¿En qué puedo ayudarte?" };
    }
};

// Función para analizar imágenes (Góndola)
const analizarGondola = async (imageUrl) => {
    try {
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

        const result = await axios.post(url, payload);
        const rawText = result.data.candidates[0].content.parts[0].text;
        return JSON.parse(limpiarJSON(rawText));
    } catch (error) {
        console.error(`❌ Error Gemini Imagen:`, error.message);
        throw error;
    }
};

module.exports = { analizarGondola, procesarChatBot };