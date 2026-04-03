const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios"); // Necesario para leer la URL de Cloudinary
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const analizarGondola = async (imageUrl) => {
    // Usamos el modelo gemini-2.0-flash (o el que tengas configurado)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `Analiza este producto en Argentina.
    Busca el código de barras (EAN-13). Si no es visible en la imagen, intenta identificar el producto por Marca y Variedad exacta para inferir su categoría.
    Devuelve un JSON estrictamente con este formato:
    [{ 
      "nombre": "Nombre exacto del producto", 
      "ean": "13 dígitos del código de barras (solo si es visible, sino null)", 
      "marca": "Marca",
      "categoria": "Categoría (Bebidas, Tabaco, Snacks, etc)",
      "precio_sugerido": 0
    }]
    Solo devuelve el JSON, sin texto extra ni formato markdown.`;

    try {
        // 1. Descargamos la imagen desde la URL de Cloudinary a un Buffer
        const responseImage = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const base64Data = Buffer.from(responseImage.data).toString('base64');

        // 2. Preparamos el objeto para Gemini
        const imagePart = {
            inlineData: {
                data: base64Data,
                mimeType: "image/jpeg", // Cloudinary suele normalizar a jpeg/png
            },
        };

        // 3. Generamos el contenido
        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        let text = response.text();
        
        // Limpiamos posibles formatos markdown (```json ... ```)
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) throw new Error("Formato JSON no válido recibido de la IA");
        
        return JSON.parse(jsonMatch[0]);

    } catch (error) {
        console.error("Error en Gemini Service:", error.message);
        throw error;
    }
};

module.exports = { analizarGondola };