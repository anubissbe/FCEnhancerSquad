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

const PLAYER_DB: PlayerData[] = [
  { "id": "231747", "n": "Mbappé", "p": "98", "s": "93", "a": "84", "d": "94", "e": "45", "h": "80", "ps": ["Technical+", "Rapid+"] },
  { "id": "239085", "n": "Haaland", "p": "95", "s": "97", "a": "75", "d": "86", "e": "50", "h": "95", "ps": ["Power Header+", "Acclaim+"], "at": "Target Man Striker" },
  { "id": "252371", "n": "Bellingham", "p": "90", "s": "90", "a": "91", "d": "94", "e": "85", "h": "92", "ps": ["Box Crasher+", "Press Breaker+"], "at": "Box Crashing Midfielder" },
  { "id": "238794", "n": "Vinícius Jr.", "p": "97", "s": "88", "a": "82", "d": "95", "e": "33", "h": "70", "ps": ["Technical+", "Rapid+"] },
  { "id": "277643", "n": "Lamine Yamal", "p": "96", "s": "90", "a": "91", "d": "97", "e": "50", "h": "75", "ps": ["Technical+"] },
  { "id": "239818", "n": "Musiala", "p": "89", "s": "87", "a": "88", "d": "96", "e": "68", "h": "70" },
  { "id": "243812", "n": "Rodrygo", "p": "94", "s": "88", "a": "85", "d": "92", "e": "40", "h": "70" },
  { "id": "272505", "n": "Endrick", "p": "95", "s": "91", "a": "84", "d": "92", "e": "48", "h": "78" },
  { "id": "243715", "n": "Saliba", "p": "88", "s": "50", "a": "75", "d": "79", "e": "92", "h": "88", "ps": ["Intercept+"], "ti": "91" },
  { "id": "264453", "n": "van de Ven", "p": "96", "s": "55", "a": "70", "d": "76", "e": "88", "h": "86" },
  { "id": "1179", "n": "Pelé", "p": "94", "s": "95", "a": "92", "d": "95", "e": "60", "h": "76" },
  { "id": "759", "n": "Ronaldo", "p": "96", "s": "96", "a": "82", "d": "95", "e": "46", "h": "81" },
  { "id": "20054", "n": "Gullit", "p": "91", "s": "92", "a": "92", "d": "91", "e": "84", "h": "92" },
  { "id": "4138", "n": "Müller", "p": "88", "s": "95", "a": "85", "d": "91", "e": "50", "h": "85", "ps": ["Power Header+"], "at": "Target Man Striker" },
  { "id": "192985", "n": "De Bruyne", "p": "70", "s": "91", "a": "96", "d": "86", "e": "66", "h": "77" },
  { "id": "203376", "n": "van Dijk", "p": "80", "s": "62", "a": "74", "d": "75", "e": "91", "h": "88", "ti": "93" },
  { "id": "158023", "n": "Messi", "p": "75", "s": "90", "a": "92", "d": "92", "e": "34", "h": "62" },
  { "id": "20801", "n": "Cristiano Ronaldo", "p": "74", "s": "90", "a": "72", "d": "78", "e": "35", "h": "78" },
  { "id": "29", "n": "Zidane", "p": "88", "s": "91", "a": "95", "d": "94", "e": "76", "h": "87" },
  { "id": "230621", "n": "Valverde", "p": "92", "s": "84", "a": "86", "d": "87", "e": "82", "h": "85" },
  { "id": "198650", "n": "Robben", "p": "94", "s": "92", "a": "88", "d": "94", "e": "45", "h": "78" },
  { "id": "189596", "n": "Ribéry", "p": "92", "s": "86", "a": "90", "d": "96", "e": "50", "h": "75" },
  { "id": "233926", "n": "Saka", "p": "90", "s": "87", "a": "86", "d": "90", "e": "70", "h": "74" },
  { "id": "37065", "n": "Cruyff", "p": "92", "s": "91", "a": "90", "d": "93", "e": "42", "h": "72" },
  { "id": "212831", "n": "Alisson", "p": "88", "s": "86", "a": "89", "d": "91", "e": "53", "h": "90" },
  { "id": "232656", "n": "Hernández", "p": "95", "s": "75", "a": "82", "d": "87", "e": "80", "h": "85" },
  { "id": "241637", "n": "Tchouaméni", "p": "83", "s": "79", "a": "85", "d": "86", "e": "89", "h": "90", "ps": ["Anchor Man+", "Intercept+"], "at": "Anchor CDM", "ti": "94" },
  { "id": "253163", "n": "Araujo", "p": "86", "s": "58", "a": "72", "d": "76", "e": "89", "h": "89", "ti": "90" },
  { "id": "253149", "n": "Frimpong", "p": "97", "s": "75", "a": "83", "d": "91", "e": "78", "h": "76" },
  { "id": "248243", "n": "Camavinga", "p": "88", "s": "78", "a": "87", "d": "90", "e": "84", "h": "85" },
  { "id": "246420", "n": "Doku", "p": "98", "s": "80", "a": "82", "d": "95", "e": "42", "h": "72" },
  { "id": "224215", "n": "Bompastor", "p": "93", "s": "85", "a": "91", "d": "90", "e": "85", "h": "82" },
  { "id": "11579", "n": "Lúcio", "p": "83", "s": "65", "a": "72", "d": "74", "e": "92", "h": "91" },
  { "id": "201505", "n": "Kompany", "p": "82", "s": "62", "a": "74", "d": "75", "e": "91", "h": "89" },
  { "id": "1721", "n": "Ramires", "p": "91", "s": "82", "a": "84", "d": "87", "e": "87", "h": "86" },
  { "id": "202857", "n": "Walker", "p": "90", "s": "66", "a": "80", "d": "81", "e": "82", "h": "82" },
  { "id": "1053", "n": "Ronaldinho", "p": "90", "s": "89", "a": "90", "d": "94", "e": "38", "h": "79" },
  { "id": "231427", "n": "Tomori", "p": "89", "s": "48", "a": "70", "d": "74", "e": "88", "h": "84" },
  { "id": "210257", "n": "Goretzka", "p": "86", "s": "85", "a": "84", "d": "85", "e": "82", "h": "89" },
  { "id": "226161", "n": "Marcos Llorente", "p": "93", "s": "83", "a": "84", "d": "86", "e": "82", "h": "86" },
  { "id": "258694", "n": "Gvardiol", "p": "87", "s": "64", "a": "78", "d": "80", "e": "88", "h": "87" },
  { "id": "269404", "n": "Salma Paralluelo", "p": "97", "s": "88", "a": "84", "d": "92", "e": "50", "h": "75" },
  { "id": "206517", "n": "Davies", "p": "96", "s": "70", "a": "80", "d": "87", "e": "78", "h": "80" },
  { "id": "190048", "n": "Yaya Touré", "p": "88", "s": "85", "a": "87", "d": "88", "e": "89", "h": "92", "ps": ["Intercept+"], "at": "Box Crashing Midfielder" },
  { "id": "7826", "n": "Henry", "p": "95", "s": "92", "a": "84", "d": "91", "e": "55", "h": "78", "ps": ["Rapid+"] },
  { "id": "338", "n": "Maldini", "p": "88", "s": "55", "a": "75", "d": "72", "e": "96", "h": "85", "ti": "97" },
  { "id": "38030", "n": "Kaká", "p": "93", "s": "88", "a": "89", "d": "94", "e": "45", "h": "75" },
  { "id": "155862", "n": "Pirlo", "p": "75", "s": "78", "a": "95", "d": "90", "e": "70", "h": "72" },
  { "id": "177618", "n": "Drogba", "p": "88", "s": "94", "a": "75", "d": "85", "e": "50", "h": "93", "at": "Target Man Striker" },
  { "id": "241532", "n": "Éder Militão", "p": "88", "s": "50", "a": "70", "d": "75", "e": "89", "h": "87" },
  { "id": "222104", "n": "Ferland Mendy", "p": "94", "s": "70", "a": "80", "d": "85", "e": "83", "h": "83" },
  { "id": "213345", "n": "Dembélé", "p": "95", "s": "85", "a": "84", "d": "93", "e": "45", "h": "68" },
  { "id": "200104", "n": "Son", "p": "89", "s": "91", "a": "85", "d": "87", "e": "50", "h": "72" }
];


@Injectable({
  providedIn: 'root',
})
export class PlayerDataService {
  private playerDataMap = signal<Map<string, MappedPlayerData> | null>(null);

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

  getPlayerDataMap(): Map<string, MappedPlayerData> {
    // Return from memory if already loaded
    if (this.playerDataMap()) {
      return this.playerDataMap() as Map<string, MappedPlayerData>;
    }
    
    // Process the embedded data
    return this.processAndCreateMap(PLAYER_DB);
  }
}