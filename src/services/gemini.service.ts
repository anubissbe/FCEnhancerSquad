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

    // --- STEP 1: Use Google Search to find real, unstructured player data ---
    console.log("Step 1: Searching for player data...");
    const searchPrompt = `Find comprehensive player data for a diverse list of 100 top-rated and popular players from the latest version of the EA FC football video game (assume it's the most recent one available). Use reliable sources like Futbin, Futwiz, or official EA Sports websites. For each player, gather information including their Name, Rating, Rarity (e.g., Gold Rare, Icon, TOTS), Preferred and Alternate Positions, Nation, League, Team, current Market Price, base stats (Pace, Shooting, Passing, Dribbling, Defending, Physicality), and a list of their PlayStyles and PlayStyle+. Also include their unique player ID from the source if available (like a Futbin ID).`;
    
    let unstructuredData: string;
    try {
        const searchResponse = await this.ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: searchPrompt,
            config: {
                tools: [{googleSearch: {}}],
            },
        });
        unstructuredData = searchResponse.text;
        if (!unstructuredData) {
             throw new Error('The AI search returned no data. The web sources might be temporarily unavailable.');
        }
        console.log("Step 1 successful. Received unstructured data.");
    } catch (e: any) {
        console.error("Error during Gemini Search API call:", e);
        throw new Error("Failed to search for player data using the AI. Please check your connection and try again.");
    }

    // --- STEP 2: Format the unstructured data into clean JSON ---
    console.log("Step 2: Formatting data into JSON...");
    const responseSchema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          DefinitionId: { type: Type.STRING, description: "A unique player ID from the source website (e.g., Futwiz/Futbin ID), or a generated numeric string if not available." },
          Name: { type: Type.STRING },
          Rating: { type: Type.STRING, description: "Overall rating as a string, e.g., '91'." },
          Rarity: { type: Type.STRING, description: "e.g., 'Icon', 'Team of the Season', 'Gold Rare'." },
          'Preferred Position': { type: Type.STRING, description: "e.g., 'ST', 'CM', 'CB'." },
          'Alternate Positions': { type: Type.STRING, description: "A comma-separated string of alternate positions, e.g., 'CF, LW'." },
          Nation: { type: Type.STRING },
          League: { type: Type.STRING },
          Team: { type: Type.STRING, description: "Club or team name." },
          ExternalPrice: { type: Type.STRING, description: "Estimated market price as a numeric string, e.g., '1500000'. Use '-- NA --' if not available." },
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

    const formatSystemInstruction = `You are an expert data processing engine. Your sole task is to take raw, unstructured text containing data about football video game players and convert it into a perfectly structured JSON array.
    - You must strictly adhere to the provided JSON schema.
    - Ignore any extraneous text, conversational filler, advertisements, or markdown formatting from the raw data.
    - Only extract and format the player information.
    - If a specific piece of information (like a price) is missing for a player, use a sensible default like '-- NA --' for strings or an empty array for PlayStyles.
    - Ensure all stats like Pace, Rating, etc., are returned as strings.`;

    const formatPrompt = `Based on the following raw data, generate a valid JSON array of player objects.
    
    RAW DATA:
    ---
    ${unstructuredData}
    ---
    
    Now, provide only the JSON output.`;

    try {
      const formatResponse = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: formatPrompt,
        config: {
          systemInstruction: formatSystemInstruction,
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: 0.1, // Low temperature for deterministic formatting
        },
      });

      const jsonText = formatResponse.text;
      if (!jsonText || jsonText.trim().length < 2) {
        console.error('Gemini API returned an empty or invalid JSON response after formatting.', formatResponse);
        throw new Error('The AI failed to format the player data correctly. The data from the web might have been in an unexpected format.');
      }
      console.log("Step 2 successful. Received formatted JSON.");
      return JSON.parse(jsonText.trim()) as Player[];
    } catch (e: any) {
      console.error("Error during Gemini Format API call:", e);
      const message = e.message.startsWith('The AI failed') 
        ? e.message 
        : "Failed to get a valid response from the AI. The model may be unavailable or the request was malformed.";
      throw new Error(message);
    }
  }
}