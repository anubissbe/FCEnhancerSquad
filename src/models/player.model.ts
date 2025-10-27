export interface Player {
  DefinitionId: string;
  Name: string;
  Rating: string;
  Rarity: string;
  'Preferred Position': string;
  'Alternate Positions': string;
  Nation: string;
  League: string;
  Team: string;
  ExternalPrice: string;
  Pace: string;
  Shooting: string;
  Passing: string;
  Dribbling: string;
  Defending: string;
  Physicality: string;
  PlayStyle?: string[];
  PlayStylePlus?: string[];
  Archetype?: string;
  'Tactical Intelligence'?: string;
  imageUrl?: string;
  hasDetailedStats?: boolean;
}
