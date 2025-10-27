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
    const knowledgeBase = await this.knowledgeBaseService.getKnowledgeBase();
    
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
                description: "The new player to buy with all chemistry details and their key PlayStyles+.",
                properties: {
                    name: { type: Type.STRING },
                    league: { type: Type.STRING },
                    nation: { type: Type.STRING },
                    club: { type: Type.STRING },
                    playstyles: {
                        type: Type.ARRAY,
                        description: "An array of the player's most relevant PlayStyles+ for their meta role, taken from the knowledge base (e.g., ['Anchor Man+', 'Second Wind+']).",
                        items: { type: Type.STRING }
                    }
                }
              },
              approximatePrice: { type: Type.INTEGER, description: "The estimated market price of the new player in coins." },
              reason: { 
                type: Type.STRING, 
                description: "A detailed justification for the upgrade. You must always name the meta formation and a specific player archetype from the knowledge base. **CRITICAL: POSITION-SPECIFIC RULES ARE MANDATORY.** If upgrading a **CDM**: You MUST follow this structure: 1. State that the player fits the 'Anchor CDM' archetype. 2. Explain why this archetype is crucial for the team's recommended formation (e.g., 'The 4-1-3-2 requires a dominant Anchor CDM...'). 3. Detail how the player's key stats (like Tactical Intelligence) and specific PlayStyles+ (like 'Anchor Man+') make them a perfect fit for this role, improving the team's tactical solidity. This reasoning must explicitly reference the provided knowledge base. For example: 'His Anchor Man+ PlayStyle is S-Tier for a lone CDM, massively increasing his tackling range...'. If upgrading a **Striker (ST)**: You MUST follow a similar structure, naming a relevant archetype (e.g., 'Clinical Finisher'), explaining why it's needed in the formation, and detailing how their stats (like OBM) and PlayStyles+ fit that role. All reasoning MUST be grounded in the provided knowledge base." 
              }
            }
          }
        }
      }
    };

    const systemInstruction = `You are a world-class expert EA FC 26 Ultimate Team analyst and squad builder. Your knowledge is based on real-world player performance, in-game stats, chemistry, and market prices from sources like FUTBIN. Your goal is to give concrete, actionable advice to improve a user's squad based on their current players and coin budget. You must provide full chemistry information (nation, league, club) for every single player you recommend. You must adhere strictly to the provided JSON schema for your response.`;
    
    const formationInstruction = formation
      ? `The user has specified a preferred formation: ${formation}. You MUST build the lineup and all recommendations based on this formation. You are only allowed to suggest a different formation if the user's choice is exceptionally unsuited for the available players according to the meta knowledge base. If you make this rare exception, you must provide a detailed justification in the summary for why you overrode the user's preference.`
      : `The user has NOT specified a formation. Therefore, your first step is to analyze the user's players and the provided knowledge base to determine the single most optimal, meta-relevant formation for their squad (e.g., 4-1-3-2, 5-2-3). Your entire analysis must be based on this chosen formation. You MUST state and explicitly justify your formation choice in the summary.`;

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
      3.  Follow this procedure for upgrades: First, identify the single most impactful, high-priority, affordable player upgrade for a weak position. Second, after accounting for that cost, check if the remaining budget is sufficient for another high-impact upgrade. If so, identify a second one, specifically prioritizing an upgrade for the Striker (ST) position if it can be improved. The total combined cost of ALL upgrades MUST remain within the user's budget. For each suggested player, you MUST populate their name, league, nation, club, and their most relevant PlayStyles+ (from the knowledge base) in the schema.
      4.  For each upgrade's "reason", you MUST follow the strict rules defined in the JSON schema. This includes naming the meta formation, player archetype, and providing a detailed tactical justification that explicitly explains how the listed PlayStyles+ make the player a perfect fit for their role, based *entirely* on the provided knowledge base. The special instructions for CDM and ST upgrades in the schema are particularly important.
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