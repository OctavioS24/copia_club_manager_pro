
import { GoogleGenAI } from "@google/genai";
import { Player } from "../types.ts";

// Fix: Refactored to handle dynamic player stats and strictly follow @google/genai guidelines
export const generatePlayerReport = async (player: Player): Promise<string> => {
  // Always use { apiKey: process.env.API_KEY } for initialization as per instructions
  // The API key is assumed to be pre-configured in process.env.API_KEY.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  
  // Format dynamic stats into a readable string for the prompt to support any sport configuration
  const statsString = Object.entries(player.stats)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n');

  const prompt = `Actúa como un director deportivo de élite. Analiza los siguientes datos del jugador y genera un informe técnico profesional en español:
  
  Jugador: ${player.name}
  Posición: ${player.position}
  Categoría: ${player.category}
  Disciplina: ${player.discipline}
  
  Estadísticas:
  ${statsString || 'Sin estadísticas registradas'}
  
  Estructura el informe con: Estilo de juego, 3 Fortalezas, Áreas de mejora y Consejo táctico.`;

  try {
    // Fix: Using correct generateContent pattern with model and contents
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    // Fix: Directly access the .text property (getter), not a method call
    return response.text || "No se pudo extraer el análisis.";
  } catch (error: any) {
    console.error("Error Gemini:", error);
    return `Error de IA: ${error.message || "Error desconocido al contactar con Gemini"}`;
  }
};
