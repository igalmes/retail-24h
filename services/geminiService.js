const axios = require("axios");
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;
// Corregido a versión estable 2.5 para evitar errores 404
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

        // Mapeo detallado para que la IA sepa qué es SEPA (ID 2) y qué es local
        const stockResumido = inventario.length > 0 
            ? inventario.map(p => {
                const origen = Number(p.comercioId) === 2 ? "[REF SEPA]" : "[LOCAL]";
                return `- ${origen} ${p.nombre} (${p.marca || 'S/M'}): $${p.precio_actualizado} (Sugerido: $${p.precio_sugerido || 'N/A'}) [Cat: ${p.categoria || 'General'}] (Stock: ${p.stock_actual})`;
            }).join('\n')
            : "No se encontraron productos coincidentes en el inventario local ni en la base SEPA.";

        const systemPrompt = `Eres el asistente inteligente de "Retail 24h AI". 
        Tu objetivo es gestionar stock y alertar sobre variaciones de precios comparando el inventario LOCAL contra la lista SEPA.

        DATOS DEL CONTEXTO:
        - Usuario Actual: ${nombre}
        - Rol del Usuario: ${rol.toUpperCase()}
        - ID del Comercio Usuario: ${comercioId}

        INVENTARIO Y REFERENCIAS ENCONTRADAS:
        ${stockResumido}

        INSTRUCCIONES DE ACCIÓN:
        1. [REF SEPA]: Son precios nacionales de referencia. No se pueden modificar, solo sirven para comparar.
        2. [LOCAL]: Es el stock real del comercio ${comercioId}. Solo ADMIN/SOCIO pueden 'crear', 'eliminar' o 'actualizar'.
        3. Si el usuario pregunta "¿cuánto sale?" o comparaciones, prioriza mostrar la diferencia entre el LOCAL y el SEPA.
        4. Si menciona cigarrillos, asigna categoría "Cigarrillos".
        5. Responde siempre de forma concisa, amable y profesional.

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
                temperature: 0.1, 
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

        // Corregido el prompt para asegurar consistencia
        const systemPrompt = `Analiza la imagen de esta góndola de supermercado. Extrae productos en formato JSON estricto:
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