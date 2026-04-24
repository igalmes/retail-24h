const axios = require("axios");
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;
// Usamos v1 y 1.5-flash para mayor estabilidad y evitar errores 404
const MODELO = "gemini-2.5-flash"; 
const url = `https://generativelanguage.googleapis.com/v1/models/${MODELO}:generateContent?key=${apiKey}`;

const limpiarJSON = (texto) => {
    try {
        return texto.replace(/```json/g, "").replace(/```/g, "").trim();
    } catch (e) { 
        return texto; 
    }
};

const procesarChatBot = async (mensajeUsuario, rol = 'cliente', inventario = [], nombre = 'Usuario', comercioId = 'Desconocido') => {
    try {
        console.log(`[DEBUG-IA]: Generando respuesta para ${nombre} (Comercio: ${comercioId})`);

        // Resumen del inventario con categoría para que la IA tenga contexto
        const stockResumido = inventario.length > 0 
            ? inventario.map(p => `- ${p.nombre} (${p.marca || 'S/M'}): $${p.precio_actualizado} [Cat: ${p.categoria || 'General'}] (Stock: ${p.stock_actual})`).join('\n')
            : "No hay productos cargados en este comercio actualmente.";

        const systemPrompt = `Eres el asistente inteligente de "Retail 24h AI". 
        Tu objetivo es gestionar stock y alertar sobre variaciones de precios (Inflación/SEPA).

        DATOS DEL CONTEXTO:
        - Usuario: ${nombre}
        - Rol: ${rol.toUpperCase()}
        - Comercio ID: ${comercioId}

        INVENTARIO DISPONIBLE:
        ${stockResumido}

        INSTRUCCIONES DE ACCIÓN:
        1. Para crear/actualizar productos, extrae: nombre, marca, precio, cantidad y categoria.
        2. Si el usuario menciona cigarrillos, asigna automáticamente la categoría "Cigarrillos".
        3. Solo ADMIN o SOCIO pueden modificar la base de datos.
        4. Responde siempre de forma concisa y profesional.

        FORMATO DE RESPUESTA (ESTRICTO JSON):
        {
          "esPedido": boolean,
          "accion": "crear" | "eliminar" | "actualizar" | "ninguna",
          "payload": {
            "nombre": "nombre del producto",
            "marca": "marca del producto",
            "precio": number,
            "cantidad": number,
            "categoria": "categoría o rubro"
          },
          "mensaje": "Tu respuesta para el usuario"
        }`;

        const payload = {
            contents: [{ 
                parts: [{ 
                    text: `${systemPrompt}\n\nUsuario dice: "${mensajeUsuario}"\nRespuesta JSON:` 
                }] 
            }],
            generationConfig: {
                temperature: 0.1, // Reducido para máxima precisión en JSON
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
                mensaje: "🤖 Sistema saturado. Por favor, aguarda unos segundos." 
            };
        }
        
        console.error(`[ERROR-IA]:`, error.message);
        return { 
            esPedido: false, 
            accion: "ninguna", 
            payload: {}, 
            mensaje: `Hola ${nombre}, hubo un error en la conexión. ¿Podrías repetir tu solicitud?` 
        };
    }
};

const analizarGondola = async (imageUrl) => {
    try {
        const responseImage = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const base64Data = Buffer.from(responseImage.data).toString('base64');

        const systemPrompt = `Analiza la imagen de esta góndola. Extrae productos en JSON:
        [{"nombre": "Nombre", "marca": "Marca", "ean": "EAN", "categoria": "Categoría"}]`;

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