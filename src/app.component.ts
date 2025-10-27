import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Player } from './models/player.model';
import { GeminiService } from './services/gemini.service';
import { PlayerComparisonComponent } from './player-comparison.component';
import { PlayerDataService } from './services/player-data.service';

const THEME_KEY = 'fut-squad-improver-theme';

// Type for sortable columns to ensure type safety
type SortableColumn = 'Name' | 'Rating' | 'Preferred Position' | 'ExternalPrice' | 'Team';

interface SortCriterion {
  column: SortableColumn;
  direction: 'asc' | 'desc';
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, PlayerComparisonComponent],
})
export class AppComponent {
  private geminiService = inject(GeminiService);
  private playerDataService = inject(PlayerDataService);

  readonly placeholderImageUrl = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%239ca3af'%3E%3Cpath fill-rule='evenodd' d='M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z' clip-rule='evenodd' /%3E%3C/svg%3E`;

  // --- Core State Signals ---
  players = this.playerDataService.players;
  isUpdating = signal<boolean>(false);
  error = signal<string>('');
  isGeminiAvailable = signal<boolean>(true);

  // Theme signal
  isDarkMode = signal<boolean>(true);

  // Signals for filtering
  nameFilter = signal<string>('');
  positionFilter = signal<string>('');
  teamLeagueFilter = signal<string>('');
  rarityFilter = signal<string>('');
  nationFilter = signal<string>('');
  minRatingFilter = signal<number>(0);
  maxRatingFilter = signal<number>(99);
  minPriceFilter = signal<number>(0);
  maxPriceFilter = signal<number>(20000000);

  // Signals for sorting
  sortCriteria = signal<SortCriterion[]>([{ column: 'Rating', direction: 'desc' }]);

  // Signals for comparison
  playersToCompare = signal<Player[]>([]);

  // Signal for player detail modal
  selectedPlayer = signal<Player | null>(null);

  // --- Computed Signals ---

  availableRarities = computed(() => {
    const rarities = this.players().map(p => p.Rarity);
    return [...new Set(rarities)].sort();
  });

  availableNations = computed(() => {
    const nations = this.players().map(p => p.Nation);
    return [...new Set(nations)].sort();
  });

  filteredPlayers = computed(() => {
    let players = this.players().map(p => ({
        ...p,
        imageUrl: p.DefinitionId ? `https://www.futwiz.com/assets/img/fc26/faces/${p.DefinitionId}.png` : this.placeholderImageUrl,
        hasDetailedStats: !!p.Pace
    }));

    if (players.length === 0) {
        return [];
    }
    
    // Filtering logic
    const name = this.nameFilter().toLowerCase();
    if (name) {
      players = players.filter(p => p.Name.toLowerCase().includes(name));
    }
    const position = this.positionFilter().toLowerCase();
    if (position) {
      players = players.filter(p => 
        p['Preferred Position'].toLowerCase().includes(position) || 
        (p['Alternate Positions'] && p['Alternate Positions'].toLowerCase().includes(position))
      );
    }
    const teamOrLeague = this.teamLeagueFilter().toLowerCase();
    if (teamOrLeague) {
        players = players.filter(p => 
            p.Team.toLowerCase().includes(teamOrLeague) || 
            p.League.toLowerCase().includes(teamOrLeague)
        );
    }
    const rarity = this.rarityFilter();
    if (rarity) {
        players = players.filter(p => p.Rarity === rarity);
    }
    const nation = this.nationFilter();
    if (nation) {
        players = players.filter(p => p.Nation === nation);
    }
    const minRating = this.minRatingFilter();
    const maxRating = this.maxRatingFilter();
    if (minRating > 0 || maxRating < 99) {
        players = players.filter(p => {
            const rating = parseInt(p.Rating, 10);
            return rating >= minRating && rating <= maxRating;
        });
    }
    const minPrice = this.minPriceFilter();
    const maxPrice = this.maxPriceFilter();
    if (minPrice > 0 || maxPrice < 20000000) {
        players = players.filter(p => {
            const priceStr = p.ExternalPrice.trim();
            const price = priceStr !== '-- NA --' && !isNaN(Number(priceStr)) ? Number(priceStr) : 0;
            return price >= minPrice && price <= maxPrice;
        });
    }

    // Sorting logic
    const criteria = this.sortCriteria();
    if (!criteria.length) {
        return players;
    }

    return players.sort((a, b) => {
        for (const { column, direction } of criteria) {
            const valA = a[column];
            const valB = b[column];

            let comparison = 0;
            if (valA === undefined || valB === undefined) continue;

            switch (column) {
                case 'Rating':
                    comparison = Number(valA) - Number(valB);
                    break;
                case 'ExternalPrice':
                    const priceA = valA.trim() !== '-- NA --' && !isNaN(Number(valA)) ? Number(valA) : -1;
                    const priceB = valB.trim() !== '-- NA --' && !isNaN(Number(valB)) ? Number(valB) : -1;
                    comparison = priceA - priceB;
                    break;
                case 'Name':
                case 'Preferred Position':
                case 'Team':
                    comparison = String(valA).localeCompare(String(valB));
                    break;
            }

            if (comparison !== 0) {
                return direction === 'asc' ? comparison : -comparison;
            }
        }
        return 0;
    });
  });
  
  dbStats = computed(() => {
    const allPlayers = this.players();
    if (allPlayers.length === 0) {
      return { totalPlayers: 0, leagues: 0, nations: 0 };
    }
    const leagues = new Set(allPlayers.map(p => p.League));
    const nations = new Set(allPlayers.map(p => p.Nation));
    return {
      totalPlayers: allPlayers.length,
      leagues: leagues.size,
      nations: nations.size
    };
  });

  constructor() {
    this.isGeminiAvailable.set(this.geminiService.isConfigured());
    // Theme initialization
    try {
      const savedTheme = localStorage.getItem(THEME_KEY);
      if (savedTheme) {
        this.isDarkMode.set(savedTheme === 'dark');
      } else {
        this.isDarkMode.set(window.matchMedia('(prefers-color-scheme: dark)').matches);
      }
      document.documentElement.classList.toggle('dark', this.isDarkMode());
    } catch(e) { /* ignore in non-browser env */ }
  }

  toggleDarkMode(): void {
    this.isDarkMode.update(value => {
        const isDark = !value;
        localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
        document.documentElement.classList.toggle('dark', isDark);
        return isDark;
    });
  }

  async updatePlayerDatabase(): Promise<void> {
    if (!this.isGeminiAvailable()) {
      this.error.set('This feature is unavailable. The API key is not configured.');
      return;
    }

    this.isUpdating.set(true);
    this.error.set('');

    try {
      const newPlayers = await this.geminiService.generatePlayerDatabase();
      this.playerDataService.updateDatabase(newPlayers);
    } catch (e: any) {
      this.error.set(e.message || 'An unknown error occurred while generating the database.');
    } finally {
      this.isUpdating.set(false);
    }
  }
  
  formatNumber(value: number | string): string {
    const num = Number(value);
    if (isNaN(num)) {
      return value.toString();
    }
    return new Intl.NumberFormat('en-US').format(num);
  }

  // Filter update methods
  updateNameFilter(event: Event) { this.nameFilter.set((event.target as HTMLInputElement).value); }
  updatePositionFilter(event: Event) { this.positionFilter.set((event.target as HTMLInputElement).value); }
  updateTeamLeagueFilter(event: Event) { this.teamLeagueFilter.set((event.target as HTMLInputElement).value); }
  updateRarityFilter(event: Event) { this.rarityFilter.set((event.target as HTMLInputElement).value); }
  updateNationFilter(event: Event) { this.nationFilter.set((event.target as HTMLInputElement).value); }
  updateMinRatingFilter(event: Event) { this.minRatingFilter.set(Number((event.target as HTMLInputElement).value) || 0); }
  updateMaxRatingFilter(event: Event) { this.maxRatingFilter.set(Number((event.target as HTMLInputElement).value) || 99); }
  updateMinPriceFilter(event: Event) { this.minPriceFilter.set(Number((event.target as HTMLInputElement).value) || 0); }
  updateMaxPriceFilter(event: Event) { this.maxPriceFilter.set(Number((event.target as HTMLInputElement).value) || 20000000); }
  
  resetFilters() {
    this.nameFilter.set('');
    this.positionFilter.set('');
    this.teamLeagueFilter.set('');
    this.rarityFilter.set('');
    this.nationFilter.set('');
    this.minRatingFilter.set(0);
    this.maxRatingFilter.set(99);
    this.minPriceFilter.set(0);
    this.maxPriceFilter.set(20000000);
  }

  sortData(column: SortableColumn, event: MouseEvent): void {
    const isShiftPressed = event.shiftKey;
    const currentCriteria = this.sortCriteria();
    const existingCriterionIndex = currentCriteria.findIndex(c => c.column === column);

    if (isShiftPressed) {
      if (existingCriterionIndex > -1) {
        this.sortCriteria.update(criteria => {
          const newCriteria = [...criteria];
          const existing = newCriteria[existingCriterionIndex];
          newCriteria[existingCriterionIndex] = { ...existing, direction: existing.direction === 'asc' ? 'desc' : 'asc' };
          return newCriteria;
        });
      } else {
        const defaultDirection = (column === 'Rating' || column === 'ExternalPrice') ? 'desc' : 'asc';
        this.sortCriteria.update(criteria => [...criteria, { column, direction: defaultDirection }]);
      }
    } else {
      if (existingCriterionIndex > -1 && currentCriteria.length === 1) {
        const existing = currentCriteria[existingCriterionIndex];
        this.sortCriteria.set([{ column, direction: existing.direction === 'asc' ? 'desc' : 'asc' }]);
      } else {
        const defaultDirection = (column === 'Rating' || column === 'ExternalPrice') ? 'desc' : 'asc';
        this.sortCriteria.set([{ column, direction: defaultDirection }]);
      }
    }
  }
  
  getSortState(column: SortableColumn): { direction: 'asc' | 'desc' | null, priority: number | null } {
    const criteria = this.sortCriteria();
    const index = criteria.findIndex(c => c.column === column);
    if (index > -1) {
        return {
            direction: criteria[index].direction,
            priority: criteria.length > 1 ? index + 1 : null
        };
    }
    return { direction: null, priority: null };
  }

  getSortTooltip(column: SortableColumn): string {
    const friendlyColumnName = (col: SortableColumn): string => {
        switch (col) {
            case 'Preferred Position': return 'Position';
            case 'ExternalPrice': return 'Price';
            default: return col;
        }
    };

    const name = friendlyColumnName(column);
    const state = this.getSortState(column);

    if (state.direction) {
        const directionText = state.direction === 'desc' ? 'Descending' : 'Ascending';
        let tooltip = `Sorted by ${name} (${directionText}).`;
        if (state.priority) {
            tooltip += ` Priority ${state.priority}.`;
        }
        tooltip += ` Click to sort only by this column. Shift-click to adjust multi-sort.`;
        return tooltip;
    } else {
      return `Click to sort by ${name}. Shift-click to add to multi-sort.`;
    }
  }

  // Comparison methods
  isPlayerSelected(player: Player): boolean {
    return this.playersToCompare().some(p => p.DefinitionId === player.DefinitionId && p.Name === player.Name);
  }

  togglePlayerComparison(player: Player): void {
    const currentSelection = this.playersToCompare();
    const isSelected = this.isPlayerSelected(player);

    if (isSelected) {
      this.playersToCompare.set(currentSelection.filter(p => !(p.DefinitionId === player.DefinitionId && p.Name === player.Name)));
    } else {
      if (currentSelection.length < 2) {
        this.playersToCompare.set([...currentSelection, player]);
      }
    }
  }
  
  clearComparison(): void {
    this.playersToCompare.set([]);
  }

  // Player Detail Modal Methods
  viewPlayer(player: Player): void {
    this.selectedPlayer.set(player);
  }

  closePlayerModal(): void {
    this.selectedPlayer.set(null);
  }
}
