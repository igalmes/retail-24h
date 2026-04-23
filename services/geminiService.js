const axios = require("axios");
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;
const MODELO = "gemini-2.5-flash"; 
const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${apiKey}`;

const limpiarJSON = (texto) => {
    try {
        return texto.replace(/```json/g, "").replace(/```/g, "").trim();
    } catch (e) { return texto; }
};

const procesarChatBot = async (mensajeUsuario, rol = 'cliente', inventario = [], nombre = 'Usuario') => {
    try {
        console.log(`[DEBUG-IA]: Generando respuesta para ${nombre}. Mensaje: "${mensajeUsuario}"`);

        const stockResumido = inventario.length > 0 
            ? inventario.slice(0, 20).map(p => `- ${p.nombre}: $${p.precio_actualizado} (Stock: ${p.stock_actual})`).join('\n')
            : "No hay productos cargados.";

        const systemPrompt = `Eres el asistente de "Retail 24h AI". Rol Usuario: ${rol.toUpperCase()}.
        Acciones ADMIN/SOCIO: "crear", "eliminar", "actualizar".
        Inventario: ${stockResumido}
        Responde ESTRICTAMENTE en JSON: {"esPedido":boolean,"accion":"...","payload":{},"mensaje":"..."}`;

        const payload = {
            contents: [{ parts: [{ text: `${systemPrompt}\n\nUsuario: "${mensajeUsuario}"` }] }]
        };

        const result = await axios.post(url, payload);
        
        // Log de éxito
        const rawText = result.data.candidates[0].content.parts[0].text;
        console.log(`[DEBUG-IA]: Respuesta cruda de Gemini recibida.`);

        return JSON.parse(limpiarJSON(rawText));
    } catch (error) {
        if (error.response && error.response.status === 429) {
            console.error(`[ALERTA-429]: Gemini alcanzó el límite de cuota.`);
            return { 
                esPedido: false, 
                accion: "ninguna", 
                payload: {}, 
                mensaje: "Estoy procesando muchos mensajes debido al plan gratuito. Por favor, aguardá 10 segundos y volvé a intentar. 🤖" 
            };
        }
        console.error(`[ERROR-IA]: Status: ${error.response?.status} | Msg: ${error.message}`);
        return { esPedido: false, accion: "ninguna", payload: {}, mensaje: "Hola! ¿En qué puedo ayudarte?" };
    }
};

const analizarGondola = async (imageUrl) => {
    try {
        console.log(`[DEBUG-IA]: Analizando imagen de góndola...`);
        const responseImage = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const base64Data = Buffer.from(responseImage.data).toString('base64');

        const payload = {
            contents: [{
                parts: [
                    { text: "Analiza esta imagen y devuelve JSON array con productos y EAN." },
                    { inline_data: { mime_type: "image/jpeg", data: base64Data } }
                ]
            }]
        };

        const result = await axios.post(url, payload);
        const rawText = result.data.candidates[0].content.parts[0].text;
        return JSON.parse(limpiarJSON(rawText));
    } catch (error) {
        console.error(`[ERROR-IA-IMG]:`, error.message);
        throw error;
    }
};

module.exports = { analizarGondola, procesarChatBot };