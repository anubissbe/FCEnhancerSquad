import { Injectable, signal } from '@angular/core';
import { GoogleGenAI, Type } from '@google/genai';
import { Player } from '../models/player.model';
import { Recommendation } from '../models/recommendation.model';

@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  private ai: GoogleGenAI | null = null;

  constructor() {
    // IMPORTANT: This check is needed because process.env is not available in all contexts.
    // In a real Applet environment, process.env.API_KEY would be set.
    try {
        if (process && process.env && process.env.API_KEY) {
            this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        }
    } catch (e) {
        console.warn("process.env.API_KEY is not available. GeminiService will be disabled.");
    }
  }

  async generateAvatars(): Promise<string[]> {
    if (!this.ai) {
        console.warn("Gemini service not available, skipping avatar generation.");
        return [];
    }

    try {
        const response = await this.ai.models.generateImages({
            model: 'imagen-3.0-generate-002',
            prompt: 'Generate 4 diverse, generic, minimalist style football player avatar icons for a fantasy football game, suitable as placeholders. Use a clean color palette. The output should be circular icons on a transparent background.',
            config: {
                numberOfImages: 4,
                outputMimeType: 'image/png',
                aspectRatio: '1:1',
            },
        });

        return response.generatedImages.map(img => `data:image/png;base64,${img.image.imageBytes}`);
    } catch (e) {
        console.error("Error generating placeholder avatars:", e);
        // Return empty array on failure
        return [];
    }
  }

  async getSquadImprovements(
    players: Player[],
    coins: number
  ): Promise<Recommendation> {
    if (!this.ai) {
        throw new Error("Gemini API key not configured. Cannot get recommendations.");
    }
    
    // Filter for relevant player data to keep the prompt concise
    const relevantPlayers = players.map(p => ({
        Name: p.Name,
        Rating: p.Rating,
        'Preferred Position': p['Preferred Position'],
        'Alternate Positions': p['Alternate Positions'],
        Team: p.Team,
        League: p.League,
        Nation: p.Nation,
        Untradeable: p.Untradeable,
        ExternalPrice: p.ExternalPrice
    }));

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        summary: {
            type: Type.STRING,
            description: "A brief, one-paragraph summary of the recommended changes and why they are good."
        },
        suggestedLineup: {
          type: Type.OBJECT,
          description: "The best possible 11-player lineup from the user's existing club.",
          properties: {
            formation: { type: Type.STRING, description: "A standard formation like '4-3-3' or '4-4-2'." },
            players: {
              type: Type.ARRAY,
              description: "An array of exactly 11 players for the starting lineup.",
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  position: { type: Type.STRING, description: "e.g., ST, CM, CB, GK" },
                  rating: { type: Type.STRING },
                  team: { type: Type.STRING },
                  league: { type: Type.STRING },
                  nation: { type: Type.STRING }
                }
              }
            }
          }
        },
        upgrades: {
          type: Type.ARRAY,
          description: "An array of suggested player upgrades, ordered by priority.",
          items: {
            type: Type.OBJECT,
            properties: {
              replace: { type: Type.STRING, description: "The name of the player to be replaced from the suggested lineup." },
              with: { 
                type: Type.OBJECT,
                description: "The new player to buy with all chemistry details.",
                properties: {
                    name: { type: Type.STRING },
                    league: { type: Type.STRING },
                    nation: { type: Type.STRING },
                    club: { type: Type.STRING }
                }
              },
              approximatePrice: { type: Type.INTEGER, description: "The estimated market price of the new player in coins." },
              reason: { type: Type.STRING, description: "A short justification for this upgrade." }
            }
          }
        }
      }
    };

    const systemInstruction = `You are a world-class expert EA FC Ultimate Team analyst and squad builder. Your knowledge is based on real-world player performance, in-game stats, chemistry, and market prices from sources like FUTBIN. Your goal is to give concrete, actionable advice to improve a user's squad based on their current players and coin budget. You must provide full chemistry information (nation, league, club) for every single player you recommend. You must adhere strictly to the provided JSON schema for your response.`;
    
    const prompt = `
      Here is the user's current club as a JSON list of players:
      ${JSON.stringify(relevantPlayers.slice(0, 200))} 
      
      The user's coin budget is: ${coins} coins.

      Analyze the provided club and budget. Your task is to:
      1.  Suggest the best possible 11-player starting lineup from the existing club in a popular, effective formation (like 4-3-3, 4-4-2, or 4-2-3-1). Prioritize high-rated players in their preferred positions. Include full chemistry details (league, nation, team).
      2.  Identify the weakest players in that starting lineup.
      3.  Suggest specific, affordable player upgrades for those weak positions that are within the user's budget. Include the new player's name, league, nation, and club.
      4.  Provide a brief summary of your strategy.

      Base your upgrade suggestions on real players available in the game that would be an improvement. Ensure the total cost of all suggested upgrades does not exceed the user's budget.
    `;
    
    try {
        const response = await this.ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.5,
            },
        });

        const jsonText = response.text.trim();
        return JSON.parse(jsonText) as Recommendation;
    } catch(e) {
        console.error("Error calling Gemini API:", e);
        throw new Error("Failed to get a valid response from the AI. The model may be unavailable or the request was malformed.");
    }
  }
}