import { Injectable, inject } from '@angular/core';
import { GoogleGenAI, Type } from '@google/genai';
import { Player } from '../models/player.model';
import { Recommendation } from '../models/recommendation.model';
import { KnowledgeBaseService } from './knowledge-base.service';

@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  private ai: GoogleGenAI | null = null;
  private knowledgeBaseService = inject(KnowledgeBaseService);

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

  async getSquadImprovements(
    players: Player[],
    coins: number,
    formation?: string
  ): Promise<Recommendation> {
    if (!this.ai) {
        throw new Error("Gemini API key not configured. Cannot get recommendations.");
    }

    // Fetch the knowledge base
    const knowledgeBase = this.knowledgeBaseService.getKnowledgeBase();
    
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
        ExternalPrice: p.ExternalPrice,
        Pace: p.Pace,
        Shooting: p.Shooting,
        Passing: p.Passing,
        Dribbling: p.Dribbling,
        Defending: p.Defending,
        Physicality: p.Physicality,
        PlayStylePlus: p.PlayStylePlus,
        Archetype: p.Archetype,
        'Tactical Intelligence': p['Tactical Intelligence']
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
            formation: { type: Type.STRING, description: "A standard formation like '4-1-3-2' or '4-4-2'." },
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
              reason: { 
                type: Type.STRING, 
                description: "A detailed justification for the upgrade, always referencing the provided knowledge base. You must name the specific player archetype for the role. Crucially, you must also list all relevant PlayStyles+ the new player possesses and explain in detail how they contribute to their effectiveness on the pitch. **CRITICAL DIRECTIVE for CDMs:** If the upgrade is for a CDM, you MUST provide a deep tactical analysis. This includes detailing the 'Anchor CDM' archetype's significance in the 4-1-3-2 formation and explaining how specific attributes like Tactical Intelligence and PlayStyles+ like 'Anchor Man+' contribute to tactical robustness, using direct information from the provided knowledge base."
              }
            }
          }
        }
      }
    };

    const systemInstruction = `You are a world-class EA FC 26 Ultimate Team tactician. Your analysis is sharp, confident, and exclusively grounded in the provided knowledge base. This knowledge base is your single source of truth for all tactical and meta-game information; it is non-negotiable.

Your core directives are:
1.  **Knowledge Base Supremacy:** All recommendations, especially for formations and player roles, MUST be justified by explicitly referencing the meta formations and player archetypes detailed within the knowledge base.
2.  **Expert Analysis:** Provide concrete, actionable advice. Your tone is that of an elite analyst who understands the game's deepest mechanics.
3.  **Data Integrity:** Use real-world player data for stats and market prices, but only when it doesn't conflict with the tactical principles of the knowledge base. Always provide full chemistry details (nation, league, club) for recommended players.
4.  **Strict Schema Adherence:** Your final output must conform perfectly to the provided JSON schema.`;
    
    const formationInstruction = formation
      ? `The user has specified a preferred formation: ${formation}. You MUST build the lineup in this formation. If, and only if, this formation is a very poor fit for the available players according to the meta knowledge base, you may suggest a more suitable formation, but you must provide a detailed explanation in the summary justifying why the user's choice was overridden.`
      : `Analyze the user's players and determine the single most optimal, meta-relevant formation for their squad (e.g., 4-1-3-2, 5-2-3 from the knowledge base). You MUST choose the formation that best leverages the player's strengths and aligns with the meta. Build the best possible 11-player starting lineup in that formation and explicitly justify your formation choice in the summary.`;

    const prompt = `
      First, review this comprehensive knowledge base for the EA FC 26 meta. It contains crucial details on new in-game stats (like Tactical Intelligence and Off-Ball Movement), dominant formations, top-tier PlayStyles+, and specific player archetypes. This information is your primary source of truth and must heavily influence all your analysis and recommendations.
      <knowledge_base>
      ${JSON.stringify(knowledgeBase, null, 2)}
      </knowledge_base>

      Now, here is the user's current club as a JSON list of players:
      ${JSON.stringify(relevantPlayers.slice(0, 200))} 
      
      The user's coin budget is: ${coins} coins.

      Analyze the provided club and budget. Your task is to:
      1.  ${formationInstruction} Prioritize high-rated players in their preferred positions. Include full chemistry details (league, nation, team). Your formation and player choices should be heavily influenced by the provided knowledge base.
      2.  Identify the weakest players in that starting lineup based on the meta player archetypes in the knowledge base.
      3.  Identify one or two high-priority, affordable player upgrades for those weak positions. The total combined cost of all upgrades must be within the user's budget. The suggested players should fit the meta and ideally have some of the recommended PlayStyles from the knowledge base. Include the new player's name, league, nation, and club.
      4.  For each upgrade's "reason", you MUST follow the strict rules defined in the JSON schema's description for the 'reason' field. This includes naming the meta formation, player archetype, and providing a detailed tactical justification based *entirely* on the provided knowledge base. The special instructions for CDM upgrades in the schema are particularly important.
      5.  Provide a brief summary of your strategy, explaining how your choices align with the meta described in the knowledge base.

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