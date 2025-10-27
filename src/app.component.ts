import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Player } from './models/player.model';
import { Recommendation } from './models/recommendation.model';
import { GeminiService } from './services/gemini.service';
import { SquadDisplayComponent } from './squad-display.component';
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
  imports: [CommonModule, SquadDisplayComponent, PlayerComparisonComponent],
})
export class AppComponent {
  private geminiService = inject(GeminiService);
  private playerDataService = inject(PlayerDataService);

  readonly placeholderImageUrl = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%239ca3af'%3E%3Cpath fill-rule='evenodd' d='M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z' clip-rule='evenodd' /%3E%3C/svg%3E`;
  readonly formations = [
    '3-1-4-2', '3-4-1-2', '3-4-2-1', '3-4-3', '3-5-2',
    '4-1-2-1-2', '4-1-2-1-2 (2)', '4-1-3-2', '4-2-2-2', '4-2-3-1', '4-2-3-1 (2)',
    '4-3-2-1', '4-3-3', '4-3-3 (2)', '4-3-3 (3)', '4-3-3 (4)', '4-3-3 (5)',
    '4-4-1-1', '4-4-2', '4-4-2 (2)', '4-5-1', '4-5-1 (2)',
    '5-2-1-2', '5-2-2-1', '5-2-3', '5-3-2', '5-4-1'
  ];

  players = signal<Player[]>([]);
  csvContent = signal<string>(''); // Store raw CSV content
  coinBalance = signal<number>(50000);
  preferredFormation = signal<string>('');
  fileName = signal<string>('');
  isLoading = signal<boolean>(false);
  recommendation = signal<Recommendation | null>(null);
  error = signal<string>('');
  
  isGeminiAvailable = signal<boolean>(true);
  hasSavedData = signal<boolean>(false);

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
  tradeableFilter = signal<'all' | 'tradeable' | 'untradeable'>('all');

  // Signals for sorting
  sortCriteria = signal<SortCriterion[]>([{ column: 'Rating', direction: 'desc' }]);

  // Signals for comparison
  playersToCompare = signal<Player[]>([]);

  // Signal for player detail modal
  selectedPlayer = signal<Player | null>(null);

  // Computed signals for dropdown options
  availableRarities = computed(() => {
    const rarities = this.players().map(p => p.Rarity);
    return [...new Set(rarities)].sort();
  });

  availableNations = computed(() => {
    const nations = this.players().map(p => p.Nation);
    return [...new Set(nations)].sort();
  });

  filteredPlayers = computed(() => {
    const players = this.players();
    if (players.length === 0) {
        return [];
    }

    let filtered = players;

    // --- Chained filters for efficiency and readability ---

    // Name filter
    const name = this.nameFilter().toLowerCase();
    if (name) {
      filtered = filtered.filter(p => p.Name.toLowerCase().includes(name));
    }

    // Position filter
    const position = this.positionFilter().toLowerCase();
    if (position) {
      filtered = filtered.filter(p => 
        p['Preferred Position'].toLowerCase().includes(position) || 
        p['Alternate Positions'].toLowerCase().includes(position)
      );
    }
    
    // Team/League filter
    const teamOrLeague = this.teamLeagueFilter().toLowerCase();
    if (teamOrLeague) {
        filtered = filtered.filter(p => 
            p.Team.toLowerCase().includes(teamOrLeague) || 
            p.League.toLowerCase().includes(teamOrLeague)
        );
    }

    // Rarity filter
    const rarity = this.rarityFilter();
    if (rarity) {
        filtered = filtered.filter(p => p.Rarity === rarity);
    }

    // Nation filter
    const nation = this.nationFilter();
    if (nation) {
        filtered = filtered.filter(p => p.Nation === nation);
    }

    // Rating filter
    const minRating = this.minRatingFilter();
    const maxRating = this.maxRatingFilter();
    if (minRating > 0 || maxRating < 99) {
        filtered = filtered.filter(p => {
            const rating = parseInt(p.Rating, 10);
            return rating >= minRating && rating <= maxRating;
        });
    }
    
    // Price filter
    const minPrice = this.minPriceFilter();
    const maxPrice = this.maxPriceFilter();
    if (minPrice > 0 || maxPrice < 20000000) {
        filtered = filtered.filter(p => {
            const priceStr = p.ExternalPrice.trim();
            const price = priceStr !== '-- NA --' && !isNaN(Number(priceStr)) ? Number(priceStr) : 0;
            return price >= minPrice && price <= maxPrice;
        });
    }

    // Tradeable status filter
    const tradeable = this.tradeableFilter();
    if (tradeable !== 'all') {
        const isUntradeable = tradeable === 'untradeable';
        filtered = filtered.filter(p => (p.Untradeable === 'true') === isUntradeable);
    }
    
    // --- Sorting ---
    const criteria = this.sortCriteria();
    if (!criteria.length) {
        return filtered;
    }

    return filtered.sort((a, b) => {
        for (const { column, direction } of criteria) {
            const valA = a[column];
            const valB = b[column];

            let comparison = 0;

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
        return 0; // All criteria are equal
    });
  });

  clubStats = computed(() => {
    const allPlayers = this.players();
    if (allPlayers.length === 0) {
      return { averageRating: 0, minPrice: 0, maxPrice: 0, playerDataMapSize: this.playerDataService.getPlayerDataMap().size };
    }

    let totalRating = 0;
    let minPrice = Infinity;
    let maxPrice = 0;
    let playerCountForRating = 0;

    for (const player of allPlayers) {
      const rating = parseInt(player.Rating, 10);
      if (!isNaN(rating)) {
        totalRating += rating;
        playerCountForRating++;
      }

      const priceStr = player.ExternalPrice.trim();
      if (priceStr !== '-- NA --') {
        const price = Number(priceStr);
        if (!isNaN(price)) {
          if (price < minPrice) minPrice = price;
          if (price > maxPrice) maxPrice = price;
        }
      }
    }

    const averageRating = playerCountForRating > 0 ? totalRating / playerCountForRating : 0;
    
    return {
      averageRating: averageRating,
      minPrice: minPrice === Infinity ? 0 : minPrice,
      maxPrice: maxPrice,
      playerDataMapSize: this.playerDataService.getPlayerDataMap().size
    };
  });

  chemistryData = computed(() => {
    const players = this.players();
    if (players.length === 0) {
      return { nations: [], leagues: [], clubs: [] };
    }

    const countMap = (key: 'Nation' | 'League' | 'Team') => {
      const counts = new Map<string, number>();
      for (const player of players) {
        const value = player[key];
        if (value && value.trim() !== '') {
            counts.set(value, (counts.get(value) || 0) + 1);
        }
      }
      return counts;
    };

    const processCounts = (counts: Map<string, number>) => {
      if (counts.size === 0) return [];
      
      const sorted = [...counts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      const maxCount = sorted[0].count;
      
      return sorted
        .slice(0, 7) // Limit to top 7
        .map(item => ({
          ...item,
          percentage: (item.count / maxCount) * 100
        }));
    };
    
    const nationCounts = countMap('Nation');
    const leagueCounts = countMap('League');
    const clubCounts = countMap('Team');

    return {
      nations: processCounts(nationCounts),
      leagues: processCounts(leagueCounts),
      clubs: processCounts(clubCounts)
    };
  });

  constructor() {
    try {
      this.isGeminiAvailable.set(!!(process && process.env && process.env.API_KEY));
      // Check for saved data on init
      this.hasSavedData.set(!!localStorage.getItem('fut_club_data'));

      // Theme initialization
      const savedTheme = localStorage.getItem(THEME_KEY);
      if (savedTheme) {
        this.isDarkMode.set(savedTheme === 'dark');
      } else {
        // Default to user's system preference
        this.isDarkMode.set(window.matchMedia('(prefers-color-scheme: dark)').matches);
      }
    } catch (e) {
      this.isGeminiAvailable.set(false);
    }
    
    // Effect to apply theme class and save preference
    effect(() => {
      const isDark = this.isDarkMode();
      localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    });
  }

  toggleDarkMode(): void {
    this.isDarkMode.update(value => !value);
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.fileName.set(file.name);
      this.recommendation.set(null);
      this.error.set('');

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        this.csvContent.set(text); // Save raw content
        this.parseCsv(text);
      };
      reader.readAsText(file);
    }
  }

  updateCoinBalance(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.coinBalance.set(Number(value) || 0);
  }

  updatePreferredFormation(event: Event): void {
    this.preferredFormation.set((event.target as HTMLSelectElement).value);
  }

  async parseCsv(csvData: string): Promise<void> {
    try {
      if (csvData.startsWith('\uFEFF')) {
        csvData = csvData.substring(1);
      }
      csvData = csvData.trim();
      
      const lines = csvData.split(/\r\n|\n/);

      if (lines.length < 2 || (lines.length === 1 && lines[0].trim() === '')) {
        this.error.set('CSV file is empty or has no data rows.');
        this.players.set([]);
        return;
      }

      const splitter = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
      const rawHeaders = lines[0].split(splitter).map(h => h.trim().replace(/^"|"$/g, '').replace(/\uFEFF/g, ''));

      const normalizationMap: { [key: string]: keyof Player } = {
          'player name': 'Name',
          'name': 'Name',
          'rating': 'Rating',
          'rarity': 'Rarity',
          'preferred position': 'Preferred Position',
          'position': 'Preferred Position',
          'pos': 'Preferred Position',
          'nation': 'Nation',
          'league': 'League',
          'team': 'Team',
          'club': 'Team',
          'price limits': 'Price Limits',
          'last sale price': 'Last Sale Price',
          'discard value': 'Discard Value',
          'untradeable': 'Untradeable',
          'loans': 'Loans',
          'definitionid': 'DefinitionId',
          'definition id': 'DefinitionId',
          'player id': 'DefinitionId',
          'id': 'DefinitionId',
          'isduplicate': 'IsDuplicate',
          'duplicate': 'IsDuplicate',
          'isinactive11': 'IsInActive11',
          'in active 11': 'IsInActive11',
          'alternate positions': 'Alternate Positions',
          'alt positions': 'Alternate Positions',
          'externalprice': 'ExternalPrice',
          'price': 'ExternalPrice',
      };

      const canonicalHeaders: (keyof Player)[] = [
          'Name', 'Rating', 'Rarity', 'Preferred Position', 'Nation', 'League', 'Team', 'Price Limits', 
          'Last Sale Price', 'Discard Value', 'Untradeable', 'Loans', 'DefinitionId', 'IsDuplicate', 
          'IsInActive11', 'Alternate Positions', 'ExternalPrice'
      ];

      const headerIndexMap: Partial<{ [key in keyof Player]: number }> = {};
      const foundCanonicalHeaders: Set<keyof Player> = new Set();

      rawHeaders.forEach((header, index) => {
          const lowerCaseHeader = header.toLowerCase();
          const normalizedHeader = normalizationMap[lowerCaseHeader];

          if (normalizedHeader && !foundCanonicalHeaders.has(normalizedHeader)) {
              headerIndexMap[normalizedHeader] = index;
              foundCanonicalHeaders.add(normalizedHeader);
          } else if (canonicalHeaders.includes(header as keyof Player) && !foundCanonicalHeaders.has(header as keyof Player)) {
              const canonical = header as keyof Player;
              headerIndexMap[canonical] = index;
              foundCanonicalHeaders.add(canonical);
          }
      });
      
      const requiredHeaders: (keyof Player)[] = ['Name', 'DefinitionId'];
      const missingHeaders = requiredHeaders.filter(h => headerIndexMap[h] === undefined);

      if (missingHeaders.length > 0) {
          this.error.set(`Invalid CSV format. Missing required columns: ${missingHeaders.join(', ')}. Please check your file.`);
          this.players.set([]);
          return;
      }
      
      const enrichedPlayers: Player[] = [];
      const dataRows = lines.slice(1);
      const fullPlayerDataMap = this.playerDataService.getPlayerDataMap();

      for (const line of dataRows) {
          if (line.trim() === '') continue;
          
          const values = line.split(splitter).map(v => v.trim().replace(/^"|"$/g, ''));
          
          if (values.length < rawHeaders.length) continue;

          const csvPlayer: Partial<Player> = {};
          for (const key of canonicalHeaders) {
              const index = headerIndexMap[key];
              if (index !== undefined && values[index] !== undefined) {
                  (csvPlayer as any)[key] = values[index];
              }
          }

          if (!csvPlayer.Name || !csvPlayer.DefinitionId) {
              continue;
          }

          let cleanDefinitionId = (csvPlayer.DefinitionId || '').trim();
          const numericId = parseInt(cleanDefinitionId, 10);
          if (!isNaN(numericId)) {
              cleanDefinitionId = numericId.toString();
          }
          
          const dbPlayer = fullPlayerDataMap.get(cleanDefinitionId);
          
          const finalPlayer: Player = {
            Name: csvPlayer.Name || '',
            Rating: csvPlayer.Rating || '0',
            Rarity: csvPlayer.Rarity || '',
            'Preferred Position': csvPlayer['Preferred Position'] || '',
            Nation: csvPlayer.Nation || '',
            League: csvPlayer.League || '',
            Team: csvPlayer.Team || '',
            'Price Limits': csvPlayer['Price Limits'] || '',
            'Last Sale Price': csvPlayer['Last Sale Price'] || '',
            'Discard Value': csvPlayer['Discard Value'] || '',
            Untradeable: csvPlayer.Untradeable || 'false',
            Loans: csvPlayer.Loans || 'false',
            DefinitionId: cleanDefinitionId,
            IsDuplicate: csvPlayer.IsDuplicate || 'false',
            IsInActive11: csvPlayer.IsInActive11 || 'false',
            'Alternate Positions': csvPlayer['Alternate Positions'] || '',
            ExternalPrice: csvPlayer.ExternalPrice || '-- NA --',
            imageUrl: cleanDefinitionId ? `https://www.futwiz.com/assets/img/fc26/faces/${cleanDefinitionId}.png` : this.placeholderImageUrl,
            hasDetailedStats: !!dbPlayer,
            ...(dbPlayer && {
                Pace: dbPlayer.Pace,
                Shooting: dbPlayer.Shooting,
                Passing: dbPlayer.Passing,
                Dribbling: dbPlayer.Dribbling,
                Defending: dbPlayer.Defending,
                Physicality: dbPlayer.Physicality,
                PlayStylePlus: dbPlayer.PlayStylePlus,
                Archetype: dbPlayer.Archetype,
                'Tactical Intelligence': dbPlayer.TacticalIntelligence
            })
          };

          enrichedPlayers.push(finalPlayer);
      }

      this.players.set(enrichedPlayers);

      if (this.players().length === 0 && dataRows.some(r => r.trim() !== '')) {
          this.error.set('No valid player data could be parsed. Please check the CSV file format and content.');
      } else {
          this.error.set('');
      }

    } catch (e) {
      this.error.set('An unexpected error occurred while parsing the CSV file.');
      console.error(e);
      this.players.set([]);
    }
  }

  async onImproveSquad(): Promise<void> {
    if (this.players().length === 0) {
      this.error.set('Please upload your club CSV file first.');
      return;
    }
    
    if (!this.isGeminiAvailable()) {
      this.error.set('This feature is currently unavailable. The API key is not configured.');
      return;
    }

    this.isLoading.set(true);
    this.error.set('');
    this.recommendation.set(null);

    try {
      const result = await this.geminiService.getSquadImprovements(
        this.players(),
        this.coinBalance(),
        this.preferredFormation()
      );

      // Enrich players in the suggested lineup with their image URLs from the main player list
      const playerMapByName = new Map<string, Player>(this.players().map(p => [p.Name.toLowerCase(), p]));
      
      if (result && result.suggestedLineup && result.suggestedLineup.players) {
          result.suggestedLineup.players = result.suggestedLineup.players.map(lineupPlayer => {
              const clubPlayer = playerMapByName.get(lineupPlayer.name.toLowerCase());
              return {
                  ...lineupPlayer,
                  imageUrl: clubPlayer?.imageUrl || this.placeholderImageUrl
              };
          });
      }

      this.recommendation.set(result);
    } catch (e: any) {
      this.error.set(e.message || 'An unknown error occurred while getting recommendations.');
    } finally {
      this.isLoading.set(false);
    }
  }

  saveData(): void {
    if (this.csvContent()) {
        const dataToSave = {
            csv: this.csvContent(),
            coins: this.coinBalance(),
            fileName: this.fileName()
        };
        localStorage.setItem('fut_club_data', JSON.stringify(dataToSave));
        this.hasSavedData.set(true);
    }
  }

  loadData(): void {
    const savedData = localStorage.getItem('fut_club_data');
    if (savedData) {
        const parsedData = JSON.parse(savedData);
        this.csvContent.set(parsedData.csv);
        this.coinBalance.set(parsedData.coins || 0);
        this.fileName.set(parsedData.fileName || 'saved_club.csv');
        this.parseCsv(parsedData.csv);
        this.recommendation.set(null);
        this.error.set('');
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
  updateTradeableFilter(filter: 'all' | 'tradeable' | 'untradeable') { this.tradeableFilter.set(filter); }
  
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
    this.tradeableFilter.set('all');
    
    // Reset input fields visually
    const resetInput = (id: string, value: string) => {
        const el = document.getElementById(id) as HTMLInputElement;
        if (el) el.value = value;
    };

    resetInput('name-filter', '');
    resetInput('position-filter', '');
    resetInput('team-league-filter', '');
    resetInput('min-rating-filter', '0');
    resetInput('max-rating-filter', '99');
    resetInput('min-price-filter', '0');
    resetInput('max-price-filter', '20000000');
  }

  sortData(column: SortableColumn, event: MouseEvent): void {
    const isShiftPressed = event.shiftKey;
    const currentCriteria = this.sortCriteria();
    const existingCriterionIndex = currentCriteria.findIndex(c => c.column === column);

    if (isShiftPressed) {
      if (existingCriterionIndex > -1) {
        // If it exists, toggle its direction
        this.sortCriteria.update(criteria => {
          const newCriteria = [...criteria];
          const existing = newCriteria[existingCriterionIndex];
          newCriteria[existingCriterionIndex] = { ...existing, direction: existing.direction === 'asc' ? 'desc' : 'asc' };
          return newCriteria;
        });
      } else {
        // If it doesn't exist, add it
        const defaultDirection = (column === 'Rating' || column === 'ExternalPrice') ? 'desc' : 'asc';
        this.sortCriteria.update(criteria => [...criteria, { column, direction: defaultDirection }]);
      }
    } else {
      // Not a shift click
      if (existingCriterionIndex > -1 && currentCriteria.length === 1) {
        // It's the only criterion, so just toggle it
        const existing = currentCriteria[existingCriterionIndex];
        this.sortCriteria.set([{ column, direction: existing.direction === 'asc' ? 'desc' : 'asc' }]);
      } else {
        // It's a new primary sort
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
            // Only show priority number if there are multiple sort criteria
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
      // Remove player
      this.playersToCompare.set(currentSelection.filter(p => !(p.DefinitionId === player.DefinitionId && p.Name === player.Name)));
    } else {
      // Add player if there's space
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
