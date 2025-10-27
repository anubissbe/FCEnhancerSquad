export interface PlayerData {
  id: string; // This corresponds to DefinitionId
  n: string; // Name
  p: string; // Pace
  s: string; // Shooting
  a: string; // Passing
  d: string; // Dribbling
  e: string; // Defending
  h: string; // Physicality
  ps?: string[]; // PlayStylePlus
  at?: string; // Archetype
}