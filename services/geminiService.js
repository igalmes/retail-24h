const axios = require("axios");
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;
// Nota: v1beta es necesaria para modelos flash-2.0 o superiores en este endpoint
const MODELO = "gemini-1.5-flash"; 
const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${apiKey}`;

const limpiarJSON = (texto) => {
    try {
        // Elimina bloques de código Markdown si Gemini los incluye
        return texto.replace(/```json/g, "").replace(/```/g, "").trim();
    } catch (e) { 
        return texto; 
    }
};

const procesarChatBot = async (mensajeUsuario, rol = 'cliente', inventario = [], nombre = 'Usuario', comercioId = 'Desconocido') => {
    try {
        console.log(`[DEBUG-IA]: Generando respuesta para ${nombre} (Comercio: ${comercioId})`);

        // Preparamos el resumen del inventario para el prompt
        const stockResumido = inventario.length > 0 
            ? inventario.map(p => `- ${p.nombre}: $${p.precio_actualizado} (Stock: ${p.stock_actual})`).join('\n')
            : "No hay productos cargados en este comercio actualmente.";

        const systemPrompt = `Eres el asistente inteligente de "Retail 24h AI". 
        Tu objetivo es ayudar en la gestión de stock y ventas.

        DATOS DEL CONTEXTO:
        - Usuario: ${nombre}
        - Rol: ${rol.toUpperCase()}
        - Comercio ID: ${comercioId}

        INVENTARIO DISPONIBLE:
        ${stockResumido}

        INSTRUCCIONES DE ACCIÓN:
        1. Si el usuario pide crear, eliminar o actualizar, el "rol" debe ser ADMIN o SOCIO.
        2. Si pide ver stock o información, responde amigablemente usando los datos del inventario.
        3. Si el usuario solo dice "estas", confirma que estás listo para ayudar.

        FORMATO DE RESPUESTA (ESTRICTO JSON):
        {
          "esPedido": boolean,
          "accion": "crear" | "eliminar" | "actualizar" | "ninguna",
          "payload": {
            "nombre": "nombre del producto",
            "precio": number,
            "cantidad": number
          },
          "mensaje": "Tu respuesta amigable para el usuario final"
        }`;

        const payload = {
            contents: [{ 
                parts: [{ 
                    text: `${systemPrompt}\n\nUsuario dice: "${mensajeUsuario}"\nRespuesta JSON:` 
                }] 
            }],
            generationConfig: {
                temperature: 0.2, // Baja temperatura para respuestas más consistentes
                topP: 0.8,
                topK: 40
            }
        };

        const result = await axios.post(url, payload);
        
        if (!result.data.candidates || result.data.candidates.length === 0) {
            throw new Error("No se recibió respuesta de Gemini");
        }

        const rawText = result.data.candidates[0].content.parts[0].text;
        const jsonLimpio = limpiarJSON(rawText);
        
        return JSON.parse(jsonLimpio);

    } catch (error) {
        if (error.response && error.response.status === 429) {
            console.error(`[ALERTA-429]: Límite de cuota excedido.`);
            return { 
                esPedido: false, 
                accion: "ninguna", 
                payload: {}, 
                mensaje: "🤖 El sistema está un poco saturado por el plan gratuito. Por favor, esperá unos segundos y volvé a preguntarme." 
            };
        }
        
        console.error(`[ERROR-IA]:`, error.message);
        return { 
            esPedido: false, 
            accion: "ninguna", 
            payload: {}, 
            mensaje: `Hola ${nombre}, tuve un problema técnico procesando tu mensaje. ¿Podrías repetirlo?` 
        };
    }
};

const analizarGondola = async (imageUrl) => {
    try {
        console.log(`[DEBUG-IA]: Analizando imagen de góndola...`);
        
        // Descargar la imagen para enviarla como base64
        const responseImage = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const base64Data = Buffer.from(responseImage.data).toString('base64');

        const systemPrompt = `Analiza la imagen de esta góndola de supermercado. 
        Extrae todos los productos visibles.
        Devuelve un ARRAY de objetos JSON con este formato:
        [{"nombre": "Nombre Producto", "marca": "Marca", "ean": "codigo_ean_o_null", "categoria": "categoria"}]`;

        const payload = {
            contents: [{
                parts: [
                    { text: systemPrompt },
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