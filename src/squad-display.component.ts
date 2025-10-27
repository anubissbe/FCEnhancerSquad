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
  RCB: { top: 78, left: 72 },
  CB: { top: 78, left: 50 },
  LCB: { top: 78, left: 28 },
  LB: { top: 75, left: 12 },
  RWB: { top: 60, left: 90 },
  LWB: { top: 60, left: 10 },
  // Midfielders
  RDM: { top: 62, left: 70 },
  LDM: { top: 62, left: 30 },
  CDM: { top: 62, left: 50 },
  RCM: { top: 55, left: 75 },
  CM: { top: 55, left: 50 },
  LCM: { top: 55, left: 25 },
  RM: { top: 50, left: 85 },
  RAM: { top: 40, left: 70 },
  LAM: { top: 40, left: 30 },
  CAM: { top: 40, left: 50 },
  LM: { top: 50, left: 15 },
  // Forwards
  RF: { top: 25, left: 70 },
  ST: { top: 20, left: 50 },
  LF: { top: 25, left: 30 },
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
            <!-- Player Avatar -->
            <div class="w-10 h-10 mb-1">
              <img [src]="player.imageUrl" [alt]="player.name"
                   class="w-full h-full rounded-full object-cover bg-gray-800 border-2 border-yellow-400"
                   (error)="$any($event.target).src = placeholderImageUrl">
            </div>

            <div class="bg-gray-900/70 backdrop-blur-sm text-white rounded-md px-1 py-0.5 shadow-lg text-center w-16 border border-white/20">
                <div class="flex items-baseline justify-center space-x-1">
                    <span class="font-bold text-sm text-yellow-400">{{ player.rating }}</span>
                    <span class="text-[10px] font-semibold text-gray-300">{{ player.position }}</span>
                </div>
                <p class="text-[10px] font-medium truncate text-gray-100">{{ player.name }}</p>
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

  readonly placeholderImageUrl = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23e5e7eb'%3E%3Cpath fill-rule='evenodd' d='M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z' clip-rule='evenodd' /%3E%3C/svg%3E`;

  positionedPlayers = computed<PositionedPlayer[]>(() => {
    const lineup = this.lineup();
    if (!lineup?.players?.length) {
      return [];
    }
    const players = lineup.players;

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
            const offset = (index - (total - 1) / 2) * 17;
            const newLeft = parseFloat(p.left) + offset;
            assignedIndexes.set(key, index + 1);
            return { ...p, left: `${newLeft}%` };
        }
        return p;
    });
  });
}