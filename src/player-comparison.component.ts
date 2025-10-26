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
                            @if (player1.avatarUrl) {
                              <img [src]="player1.avatarUrl" alt="Avatar" class="h-16 w-16 rounded-full bg-gray-200 dark:bg-gray-700">
                            } @else {
                              <div class="h-16 w-16 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                            }
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
                             @if (player2.avatarUrl) {
                                <img [src]="player2.avatarUrl" alt="Avatar" class="h-16 w-16 rounded-full bg-gray-200 dark:bg-gray-700">
                            } @else {
                                <div class="h-16 w-16 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                            }
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

            @if (comparisonStats().length > 0) {
                <div class="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
                    <dl class="space-y-2">
                        @for(stat of comparisonStats(); track stat.label) {
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
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerComparisonComponent {
  players = input.required<Player[]>();
  clear = output<void>();

  private readonly WIN_CLASS = 'text-green-500 dark:text-green-400';
  private readonly LOSE_CLASS = 'text-red-500 dark:text-red-400';
  private readonly TIE_CLASS = 'text-gray-900 dark:text-gray-100';

  comparisonStats = computed<ComparisonStat[]>(() => {
    const players = this.players();
    if (players.length !== 2) {
      return [];
    }
    const [p1, p2] = players;

    const stats: ComparisonStat[] = [];
    
    // Rating comparison
    const rating1 = parseInt(p1.Rating, 10);
    const rating2 = parseInt(p2.Rating, 10);
    stats.push(this.createStat('Rating', rating1, rating2, 'higher'));

    // Price comparison
    const price1 = this.parsePrice(p1.ExternalPrice);
    const price2 = this.parsePrice(p2.ExternalPrice);
    stats.push(this.createStat('Price', price1, price2, 'lower'));

    // Other stats
    stats.push(this.createStat('Position', p1['Preferred Position'], p2['Preferred Position'], 'none'));
    stats.push(this.createStat('League', p1.League, p2.League, 'none'));
    stats.push(this.createStat('Nation', p1.Nation, p2.Nation, 'none'));

    return stats;
  });

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

    if (better !== 'none' && typeof val1 === 'number' && typeof val2 === 'number') {
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
