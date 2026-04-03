const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const analizarGondola = async (imagePath) => {
    // Usamos el modelo que confirmaste que funciona
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `Analiza este producto en Argentina.
    Busca el código de barras (EAN-13). Si no es visible en la imagen, intenta identificar el producto por Marca y Variedad exacta para inferir su categoría.
    Devuelve un JSON estrictamente con este formato:
    [{ 
      "nombre": "Nombre exacto del producto", 
      "ean": "13 dígitos del código de barras (solo si es visible, sino null)", 
      "marca": "Marca",
      "categoria": "Categoría (Bebidas, Tabaco, Snacks, etc)"
    }]
    Solo devuelve el JSON, sin texto extra ni formato markdown.`;

    const extension = path.extname(imagePath).toLowerCase();
    const mimeType = extension === ".png" ? "image/png" : "image/jpeg";

    const imagePart = {
        inlineData: {
            data: Buffer.from(fs.readFileSync(imagePath)).toString("base64"),
            mimeType: mimeType,
        },
    };

    try {
        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        let text = response.text();
        
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) throw new Error("Formato JSON no válido recibido de la IA");
        
        return JSON.parse(jsonMatch[0]);
    } catch (error) {
        console.error("Error Gemini:", error.message);
        throw error;
    }
};

module.exports = { analizarGondola };