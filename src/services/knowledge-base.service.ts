import { Injectable, signal } from '@angular/core';

// Define an interface for our knowledge base structure for type safety
export interface KnowledgeBase {
  general_advice: string;
  key_in_game_stats: {
    name: string;
    abbreviation: string;
    description: string;
  }[];
  meta_formations: {
    name: string;
    description: string;
    strengths: string[];
    weaknesses: string[];
    key_player_types: { [key: string]: string };
  }[];
  playstyles_plus_meta: {
    name: string;
    description: string;
    positions: string[];
  }[];
  player_archetypes: {
    role: string;
    description: string;
    key_stats: string[];
    meta_playstyles: string[];
  }[];
}

@Injectable({
  providedIn: 'root',
})
export class KnowledgeBaseService {
  private knowledgeBase = signal<KnowledgeBase | null>(null);

  private readonly knowledgeBaseUrl = '/assets/knowledge-base.json';

  async getKnowledgeBase(): Promise<KnowledgeBase> {
    if (this.knowledgeBase()) {
      return this.knowledgeBase() as KnowledgeBase;
    }

    try {
      const response = await fetch(this.knowledgeBaseUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = (await response.json()) as KnowledgeBase;
      
      this.knowledgeBase.set(data);
      return data;
    } catch (error) {
      console.error("Failed to load knowledge base:", error);
      // Return a default empty structure on failure
      const emptyKB: KnowledgeBase = {
          general_advice: '',
          key_in_game_stats: [],
          meta_formations: [],
          playstyles_plus_meta: [],
          player_archetypes: []
      };
      this.knowledgeBase.set(emptyKB);
      return emptyKB;
    }
  }
}
