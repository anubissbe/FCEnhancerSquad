import { Injectable, signal } from '@angular/core';
import { PlayerData } from '../models/player-data.model';

// A simplified, renamed version for our internal map.
interface MappedPlayerData {
    DefinitionId: string;
    Pace: string;
    Shooting: string;
    Passing: string;
    Dribbling: string;
    Defending: string;
    Physicality: string;
    PlayStylePlus?: string[];
    Archetype?: string;
    TacticalIntelligence?: string;
}


@Injectable({
  providedIn: 'root',
})
export class PlayerDataService {
  private playerDataMap = signal<Map<string, MappedPlayerData> | null>(null);

  // A local asset path to a pre-compiled JSON database of players.
  private readonly playerDataUrl = '/assets/players.json';
  private readonly localStorageKey = 'fut_player_database';

  constructor() {
    // Proactively load the player data when the service is first created.
    this.getPlayerDataMap();
  }

  /**
   * Processes raw player data into the Map structure used by the app.
   * @param players The raw player data array.
   * @returns A Map with DefinitionId as key and player stats as value.
   */
  private processAndCreateMap(players: PlayerData[]): Map<string, MappedPlayerData> {
    const newMap = new Map<string, MappedPlayerData>();
    for (const player of players) {
      newMap.set(player.id, {
          DefinitionId: player.id,
          Pace: player.p,
          Shooting: player.s,
          Passing: player.a,
          Dribbling: player.d,
          Defending: player.e,
          Physicality: player.h,
          PlayStylePlus: player.ps,
          Archetype: player.at,
          TacticalIntelligence: player.ti
      });
    }
    this.playerDataMap.set(newMap);
    return newMap;
  }

  async getPlayerDataMap(): Promise<Map<string, MappedPlayerData>> {
    // Return from memory if already loaded
    if (this.playerDataMap()) {
      return this.playerDataMap() as Map<string, MappedPlayerData>;
    }

    // 1. Check localStorage cache first
    try {
      const cachedData = localStorage.getItem(this.localStorageKey);
      if (cachedData) {
        console.log("Loading player data from localStorage cache.");
        const players = JSON.parse(cachedData) as PlayerData[];
        return this.processAndCreateMap(players);
      }
    } catch (e) {
      console.error("Failed to read player data from localStorage. Will fetch from network.", e);
      // Clear potentially corrupted data
      localStorage.removeItem(this.localStorageKey);
    }
    
    // 2. If no cache, fetch from network
    try {
      console.log("Fetching player data from network.");
      const response = await fetch(this.playerDataUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // We read the response as text to store it directly, then parse it.
      const rawJson = await response.text();
      const players = JSON.parse(rawJson) as PlayerData[];

      // 3. Cache the fetched data in localStorage
      try {
        localStorage.setItem(this.localStorageKey, rawJson);
        console.log("Player data cached in localStorage.");
      } catch (e) {
        console.error("Failed to cache player data in localStorage:", e);
      }
      
      return this.processAndCreateMap(players);
    } catch (error) {
        console.error("Failed to load player database:", error);
        // Set and return an empty map on failure to prevent breaking the app
        const emptyMap = new Map<string, MappedPlayerData>();
        this.playerDataMap.set(emptyMap);
        return emptyMap;
    }
  }
}
