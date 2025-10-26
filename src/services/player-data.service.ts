import { Injectable, signal } from '@angular/core';
import { PlayerData } from '../models/player-data.model';

// We'll rename the properties for clarity after fetching.
interface RawPlayerData {
  id: string;
  n: string;
  p: string;
  s: string;
  a: string;
  d: string;
  e: string;
  h: string;
}

// A simplified, renamed version for our internal map.
interface MappedPlayerData {
    Pace: string;
    Shooting: string;
    Passing: string;
    Dribbling: string;
    Defending: string;
    Physicality: string;
}


@Injectable({
  providedIn: 'root',
})
export class PlayerDataService {
  private playerDataMap = signal<Map<string, MappedPlayerData> | null>(null);

  // A local asset path to a pre-compiled JSON database of players.
  private readonly playerDataUrl = '/assets/players.json';

  async getPlayerDataMap(): Promise<Map<string, MappedPlayerData>> {
    if (this.playerDataMap()) {
      return this.playerDataMap() as Map<string, MappedPlayerData>;
    }

    try {
      const response = await fetch(this.playerDataUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const players = (await response.json()) as RawPlayerData[];

      const newMap = new Map<string, MappedPlayerData>();
      for (const player of players) {
        newMap.set(player.id, {
            Pace: player.p,
            Shooting: player.s,
            Passing: player.a,
            Dribbling: player.d,
            Defending: player.e,
            Physicality: player.h
        });
      }
      
      this.playerDataMap.set(newMap);
      return newMap;
    } catch (error) {
        console.error("Failed to load player database:", error);
        // Set and return an empty map on failure to prevent breaking the app
        const emptyMap = new Map<string, MappedPlayerData>();
        this.playerDataMap.set(emptyMap);
        return emptyMap;
    }
  }
}