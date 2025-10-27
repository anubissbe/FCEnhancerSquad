import { Injectable } from '@angular/core';
import { GoogleGenAI, Type } from '@google/genai';
import { Player } from '../models/player.model';

@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  private ai: GoogleGenAI | null = null;

  constructor() {
    try {
      if (process && process.env && process.env.API_KEY) {
        this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      }
    } catch (e) {
      console.warn("process.env.API_KEY is not available. GeminiService will be disabled.");
    }
  }

  isConfigured(): boolean {
      return this.ai !== null;
  }

  async generatePlayerDatabase(): Promise<Player[]> {
    if (!this.ai) {
      throw new Error("Gemini API key not configured. Cannot generate database.");
    }

    const responseSchema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          DefinitionId: { type: Type.STRING, description: "A unique player ID, can be a real or generated numeric string." },
          Name: { type: Type.STRING },
          Rating: { type: Type.STRING, description: "Overall rating as a string, e.g., '91'." },
          Rarity: { type: Type.STRING, description: "e.g., 'Icon', 'Team of the Season', 'Gold Rare'." },
          'Preferred Position': { type: Type.STRING, description: "e.g., 'ST', 'CM', 'CB'." },
          'Alternate Positions': { type: Type.STRING, description: "A comma-separated string of alternate positions, e.g., 'CF, LW'." },
          Nation: { type: Type.STRING },
          League: { type: Type.STRING },
          Team: { type: Type.STRING, description: "Club or team name." },
          ExternalPrice: { type: Type.STRING, description: "Estimated market price as a numeric string, e.g., '1500000'." },
          Pace: { type: Type.STRING },
          Shooting: { type: Type.STRING },
          Passing: { type: Type.STRING },
          Dribbling: { type: Type.STRING },
          Defending: { type: Type.STRING },
          Physicality: { type: Type.STRING },
          PlayStyle: { type: Type.ARRAY, items: { type: Type.STRING }, description: "An array of normal PlayStyles." },
          PlayStylePlus: { type: Type.ARRAY, items: { type: Type.STRING }, description: "An array of PlayStyle+." },
          Archetype: { type: Type.STRING, description: "e.g., 'Target Man Striker', 'Anchor CDM'. Can be empty." },
          'Tactical Intelligence': { type: Type.STRING, description: "A rating for this stat, e.g., '92'. Can be empty for some players." },
        }
      }
    };

    const systemInstruction = `You are an expert data generator for the futuristic video game EA FC 26. You create realistic and diverse player data in perfect JSON format, adhering strictly to the provided schema. The year is October 2025 and FC26 has been released.`;

    const prompt = `Generate a comprehensive list of 100 unique and diverse players for EA FC 26.

    Instructions:
    - Include a mix of Icons, Heroes, regular Gold, Silver, and special promo cards (like 'Team of the Season' or 'Future Stars').
    - The players should come from a wide variety of leagues (e.g., Premier League, LaLiga, Bundesliga, Serie A, Ligue 1, MLS, Saudi League) and nations.
    - Create a balanced mix of positions (attackers, midfielders, defenders, goalkeepers).
    - All face stats (Pace, Shooting, etc.) should be strings representing numbers between 40 and 99.
    - Ensure the player data is varied and feels authentic to a real in-game database.
    - Follow the JSON schema perfectly. The final output must be a valid JSON array.`;

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: 0.8,
        },
      });

      const jsonText = response.text.trim();
      // The response is expected to be a JSON string of an array of players.
      return JSON.parse(jsonText) as Player[];
    } catch (e) {
      console.error("Error calling Gemini API:", e);
      throw new Error("Failed to get a valid response from the AI. The model may be unavailable or the request was malformed.");
    }
  }
}
