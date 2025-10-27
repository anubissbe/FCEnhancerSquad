import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Player } from './models/player.model';

interface ComparisonStat {
  label: string;
  value1: string | number;
  value2: string | number;
  class1: string;
  class2: string;
}

@Component({
  selector: 'app-player-comparison',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed bottom-0 left-0 right-0 z-20 p-4 transition-transform duration-300 ease-in-out"
         [class.translate-y-full]="players().length === 0"
         [class.translate-y-0]="players().length > 0">
        <div class="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 border border-gray-200 dark:border-gray-700">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-semibold text-green-600 dark:text-green-400">Player Comparison</h3>
                <button (click)="clear.emit()" class="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <!-- Player 1 Slot -->
                <div>
                    @if (players()[0]; as player1) {
                        <div class="flex items-center space-x-4">
                            <img [src]="player1.imageUrl" alt="Player Image" class="h-16 w-16 rounded-full bg-gray-200 dark:bg-gray-700 object-cover"
                                (error)="$any($event.target).src = placeholderImageUrl">
                            <div>
                                <p class="font-bold text-lg">{{ player1.Name }}</p>
                                <p class="text-sm text-gray-500 dark:text-gray-400">{{ player1.Team }}</p>
                            </div>
                        </div>
                    } @else {
                        <div class="h-full flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-gray-400 dark:text-gray-500">
                            Select a player
                        </div>
                    }
                </div>

                <!-- Player 2 Slot -->
                <div>
                    @if (players()[1]; as player2) {
                        <div class="flex items-center space-x-4">
                            <img [src]="player2.imageUrl" alt="Player Image" class="h-16 w-16 rounded-full bg-gray-200 dark:bg-gray-700 object-cover"
                                (error)="$any($event.target).src = placeholderImageUrl">
                            <div>
                                <p class="font-bold text-lg">{{ player2.Name }}</p>
                                <p class="text-sm text-gray-500 dark:text-gray-400">{{ player2.Team }}</p>
                            </div>
                        </div>
                    } @else {
                        <div class="h-full flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-gray-400 dark:text-gray-500">
                           Select another player
                        </div>
                    }
                </div>
            </div>

            @if (comparisonData().basicStats.length > 0 || comparisonData().detailedStats.length > 0) {
                <div class="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
                    <!-- Basic Stats -->
                    <dl class="space-y-2">
                        @for(stat of comparisonData().basicStats; track stat.label) {
                            <div class="grid grid-cols-3 items-center text-sm">
                                <div class="text-left font-semibold" [class]="stat.class1">{{ stat.value1 }}</div>
                                <div class="text-center font-medium text-gray-500 dark:text-gray-400">{{ stat.label }}</div>
                                <div class="text-right font-semibold" [class]="stat.class2">{{ stat.value2 }}</div>
                            </div>
                        }
                    </dl>
                    
                    <!-- Detailed Stats -->
                    @if (comparisonData().detailedStats.length > 0) {
                        <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                             <h4 class="text-center text-sm font-semibold mb-2 text-gray-600 dark:text-gray-300">In-Game Stats</h4>
                            <dl class="space-y-2">
                                @for(stat of comparisonData().detailedStats; track stat.label) {
                                    <div class="grid grid-cols-3 items-center text-sm">
                                        <div class="text-left font-semibold" [class]="stat.class1">{{ stat.value1 }}</div>
                                        <div class="text-center font-medium text-gray-500 dark:text-gray-400">{{ stat.label }}</div>
                                        <div class="text-right font-semibold" [class]="stat.class2">{{ stat.value2 }}</div>
                                    </div>
                                }
                            </dl>
                        </div>
                    }
                </div>
            }
        </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerComparisonComponent {
  players = input.required<Player[]>();
  clear = output<void>();

  readonly placeholderImageUrl = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%239ca3af'%3E%3Cpath fill-rule='evenodd' d='M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z' clip-rule='evenodd' /%3E%3C/svg%3E`;

  private readonly WIN_CLASS = 'text-green-500 dark:text-green-400';
  private readonly LOSE_CLASS = 'text-red-500 dark:text-red-400';
  private readonly TIE_CLASS = 'text-gray-900 dark:text-gray-100';

  comparisonData = computed(() => {
    const players = this.players();
    if (players.length !== 2) {
      return { basicStats: [], detailedStats: [] };
    }
    const [p1, p2] = players;

    const basicStats: ComparisonStat[] = [];
    const detailedStats: ComparisonStat[] = [];
    
    // Basic stats
    const rating1 = parseInt(p1.Rating, 10);
    const rating2 = parseInt(p2.Rating, 10);
    basicStats.push(this.createStat('Rating', rating1, rating2, 'higher'));

    const price1 = this.parsePrice(p1.ExternalPrice);
    const price2 = this.parsePrice(p2.ExternalPrice);
    basicStats.push(this.createStat('Price', price1, price2, 'lower'));

    basicStats.push(this.createStat('Position', p1['Preferred Position'], p2['Preferred Position'], 'none'));
    basicStats.push(this.createStat('League', p1.League, p2.League, 'none'));
    basicStats.push(this.createStat('Nation', p1.Nation, p2.Nation, 'none'));

    // Detailed stats, only if available on both players
    if (p1.Pace && p2.Pace) {
      detailedStats.push(this.createStat('Pace', this.parseStat(p1.Pace), this.parseStat(p2.Pace), 'higher'));
      detailedStats.push(this.createStat('Shooting', this.parseStat(p1.Shooting), this.parseStat(p2.Shooting), 'higher'));
      detailedStats.push(this.createStat('Passing', this.parseStat(p1.Passing), this.parseStat(p2.Passing), 'higher'));
      detailedStats.push(this.createStat('Dribbling', this.parseStat(p1.Dribbling), this.parseStat(p2.Dribbling), 'higher'));
      detailedStats.push(this.createStat('Defending', this.parseStat(p1.Defending), this.parseStat(p2.Defending), 'higher'));
      detailedStats.push(this.createStat('Physicality', this.parseStat(p1.Physicality), this.parseStat(p2.Physicality), 'higher'));
    }

    if (p1['Tactical Intelligence'] && p2['Tactical Intelligence']) {
        detailedStats.push(this.createStat('Tactical Int.', this.parseStat(p1['Tactical Intelligence']), this.parseStat(p2['Tactical Intelligence']), 'higher'));
    }

    return { basicStats, detailedStats };
  });

  private parseStat(statStr: string | undefined): number {
    if (!statStr) {
        return 0;
    }
    const stat = parseInt(statStr, 10);
    return isNaN(stat) ? 0 : stat;
  }

  private parsePrice(priceStr: string): number {
    const cleanPrice = priceStr.trim();
    if (cleanPrice === '-- NA --' || isNaN(Number(cleanPrice))) {
      return -1; // Use -1 to indicate N/A
    }
    return Number(cleanPrice);
  }

  private formatValue(value: string | number): string {
     if (typeof value === 'number') {
        if (value === -1) return 'N/A';
        return new Intl.NumberFormat('en-US').format(value);
     }
     return value;
  }

  private createStat(label: string, val1: string | number, val2: string | number, better: 'higher' | 'lower' | 'none'): ComparisonStat {
    let class1 = this.TIE_CLASS;
    let class2 = this.TIE_CLASS;

    if (better !== 'none' && typeof val1 === 'number' && typeof val2 === 'number' && !isNaN(val1) && !isNaN(val2)) {
        const valid1 = val1 !== -1;
        const valid2 = val2 !== -1;
        
        if (valid1 && valid2) {
             if (better === 'higher') {
                if (val1 > val2) { class1 = this.WIN_CLASS; class2 = this.LOSE_CLASS; } 
                else if (val2 > val1) { class2 = this.WIN_CLASS; class1 = this.LOSE_CLASS; }
            } else { // 'lower'
                if (val1 < val2) { class1 = this.WIN_CLASS; class2 = this.LOSE_CLASS; } 
                else if (val2 < val1) { class2 = this.WIN_CLASS; class1 = this.LOSE_CLASS; }
            }
        }
    } else if (val1 !== val2 && better === 'none') {
        class1 = 'text-gray-900 dark:text-gray-100';
        class2 = 'text-gray-900 dark:text-gray-100';
    }

    return {
        label,
        value1: this.formatValue(val1),
        value2: this.formatValue(val2),
        class1,
        class2
    };
  }
}
