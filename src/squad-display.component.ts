import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SuggestedLineup, LineupPlayer } from './models/recommendation.model';

// Define a type for player positions with coordinates
interface PositionedPlayer extends LineupPlayer {
  top: string;
  left: string;
}

// A map for standard positions to pitch coordinates (percentages)
const POSITION_COORDINATES: { [key: string]: { top: number; left: number } } = {
  GK: { top: 90, left: 50 },
  // Defenders
  RB: { top: 75, left: 88 },
  RCB: { top: 78, left: 65 },
  CB: { top: 78, left: 50 },
  LCB: { top: 78, left: 35 },
  LB: { top: 75, left: 12 },
  RWB: { top: 60, left: 90 },
  LWB: { top: 60, left: 10 },
  // Midfielders
  RDM: { top: 62, left: 65 },
  LDM: { top: 62, left: 35 },
  CDM: { top: 62, left: 50 },
  RCM: { top: 55, left: 70 },
  CM: { top: 55, left: 50 },
  LCM: { top: 55, left: 30 },
  RM: { top: 50, left: 85 },
  RAM: { top: 40, left: 65 },
  LAM: { top: 40, left: 35 },
  CAM: { top: 40, left: 50 },
  LM: { top: 50, left: 15 },
  // Forwards
  RF: { top: 25, left: 65 },
  ST: { top: 20, left: 50 },
  LF: { top: 25, left: 35 },
  RW: { top: 25, left: 85 },
  CF: { top: 22, left: 50 },
  LW: { top: 25, left: 15 },
};

@Component({
  selector: 'app-squad-display',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (lineup(); as l) {
      <div class="relative aspect-[7/10] w-full max-w-sm mx-auto bg-green-700 rounded-lg shadow-inner overflow-hidden border-2 border-white/20"
          style="background-image:
            radial-gradient(circle at 50% 95%, rgba(0,0,0,0.3) 0%, transparent 50%),
            linear-gradient(to bottom, #1e5a1e, #2a7a2a);">
        <!-- Pitch Markings -->
        <!-- Center Circle -->
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[25%] aspect-square rounded-full border border-white/40"></div>
        <!-- Center Line -->
        <div class="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
        <!-- Center Spot -->
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/40"></div>
        <!-- Penalty Arc (Top) -->
        <div class="absolute top-[16.5%] left-1/2 -translate-x-1/2 w-[22%] aspect-[2/1] rounded-b-full border-b border-l border-r border-white/40 border-t-0"></div>
        <!-- Penalty Area (Top) -->
        <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-[16.5%] border border-white/40 border-t-0"></div>
        <!-- 6-yard Box (Top) -->
        <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[30%] h-[8%] border border-white/40 border-t-0"></div>
        <!-- Penalty Arc (Bottom) -->
        <div class="absolute bottom-[16.5%] left-1/2 -translate-x-1/2 w-[22%] aspect-[2/1] rounded-t-full border-t border-l border-r border-white/40 border-b-0"></div>
        <!-- Penalty Area (Bottom) -->
        <div class="absolute bottom-0 left-1/2 -translate-x-1/2 w-[60%] h-[16.5%] border border-white/40 border-b-0"></div>
        <!-- 6-yard Box (Bottom) -->
        <div class="absolute bottom-0 left-1/2 -translate-x-1/2 w-[30%] h-[8%] border border-white/40 border-b-0"></div>

        <!-- Players -->
        @for (player of positionedPlayers(); track player.name) {
          <div class="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group transition-transform duration-200 hover:scale-110 hover:z-10" [style.top]="player.top" [style.left]="player.left">
            <div class="bg-gray-900/70 backdrop-blur-sm text-white rounded-lg px-2 py-1 shadow-lg text-center w-28 border border-white/20">
                <div class="flex items-center justify-center space-x-2">
                    <span class="font-bold text-lg text-yellow-400">{{ player.rating }}</span>
                    <span class="text-sm font-semibold text-gray-300">{{ player.position }}</span>
                </div>
                <p class="text-xs font-medium truncate text-gray-100">{{ player.name }}</p>
                <p class="text-[10px] text-gray-400 truncate">{{ player.team }}</p>
            </div>
          </div>
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SquadDisplayComponent {
  lineup = input.required<SuggestedLineup>();

  positionedPlayers = computed<PositionedPlayer[]>(() => {
    const players = this.lineup().players;

    const initialPositions = players.map(player => {
        const position = player.position.toUpperCase().trim();
        const coords = POSITION_COORDINATES[position];
        if (!coords) {
            console.warn(`No coordinates found for position: ${position}. Defaulting to center.`);
            return { ...player, top: '50%', left: '50%' };
        }
        return { ...player, top: `${coords.top}%`, left: `${coords.left}%` };
    });

    const positionCounts = new Map<string, number>();
    initialPositions.forEach(p => {
        const key = `${p.top}-${p.left}`;
        positionCounts.set(key, (positionCounts.get(key) || 0) + 1);
    });

    const assignedIndexes = new Map<string, number>();
    return initialPositions.map(p => {
        const key = `${p.top}-${p.left}`;
        const total = positionCounts.get(key) || 1;
        if (total > 1) {
            const index = assignedIndexes.get(key) || 0;
            // Spread players out from the center of the original position
            const offset = (index - (total - 1) / 2) * 10;
            const newLeft = parseFloat(p.left) + offset;
            assignedIndexes.set(key, index + 1);
            return { ...p, left: `${newLeft}%` };
        }
        return p;
    });
  });
}
