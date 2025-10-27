import { Injectable, signal } from '@angular/core';
import { Player } from '../models/player.model';

const PLAYER_DB_KEY = 'fc26-player-db';

@Injectable({
  providedIn: 'root',
})
export class PlayerDataService {
  readonly players = signal<Player[]>([]);

  constructor() {
    this._loadFromStorage();
  }

  updateDatabase(newPlayers: Player[]): void {
    this.players.set(newPlayers);
    this._saveToStorage();
  }

  private _loadFromStorage(): void {
    try {
      const savedData = localStorage.getItem(PLAYER_DB_KEY);
      if (savedData) {
        const parsedPlayers: Player[] = JSON.parse(savedData);
        this.players.set(parsedPlayers);
        console.log(`[PlayerDataService] Loaded ${parsedPlayers.length} players from local storage.`);
      }
    } catch (e) {
      console.error('Failed to load players from local storage', e);
      // Clear corrupted data
      localStorage.removeItem(PLAYER_DB_KEY);
    }
  }

  private _saveToStorage(): void {
    try {
      localStorage.setItem(PLAYER_DB_KEY, JSON.stringify(this.players()));
    } catch (e) {
      console.error('Failed to save players to local storage', e);
    }
  }
}
