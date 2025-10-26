export interface Recommendation {
  suggestedLineup: SuggestedLineup;
  upgrades: Upgrade[];
  summary: string;
}

export interface SuggestedLineup {
  formation: string;
  players: LineupPlayer[];
}

export interface LineupPlayer {
  name: string;
  position: string;
  rating: string;
  team: string;
  league: string;
  nation: string;
}

export interface Upgrade {
  replace: string;
  with: {
    name: string;
    league: string;
    nation: string;
    club: string;
  };
  approximatePrice: number;
  reason: string;
}