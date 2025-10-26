import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Player } from './models/player.model';
import { Recommendation } from './models/recommendation.model';
import { GeminiService } from './services/gemini.service';
import { SquadDisplayComponent } from './squad-display.component';
import { PlayerComparisonComponent } from './player-comparison.component';
import { PlayerDataService } from './services/player-data.service';
import { PlayerData } from './models/player-data.model';

const THEME_KEY = 'fut-squad-improver-theme';

// Type for sortable columns to ensure type safety
type SortableColumn = 'Name' | 'Rating' | 'Preferred Position' | 'ExternalPrice' | 'Team';


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

  players = signal<Player[]>([]);
  csvContent = signal<string>(''); // Store raw CSV content
  coinBalance = signal<number>(50000);
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
  sortColumn = signal<SortableColumn>('Rating');
  sortDirection = signal<'asc' | 'desc'>('desc');

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
    const column = this.sortColumn();
    const direction = this.sortDirection();

    return filtered.sort((a, b) => {
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

        return direction === 'asc' ? comparison : -comparison;
    });
  });

  clubStats = computed(() => {
    const allPlayers = this.players();
    if (allPlayers.length === 0) {
      return { averageRating: 0, minPrice: 0, maxPrice: 0 };
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

  async parseCsv(csvData: string): Promise<void> {
    try {
      // 1. Sanitize input: Remove BOM if present and trim whitespace
      if (csvData.startsWith('\uFEFF')) {
        csvData = csvData.substring(1);
      }
      csvData = csvData.trim();

      // 2. Robust state-machine parser: handles quoted fields, newlines in fields, and escaped quotes
      const rows: string[][] = [];
      let currentRow: string[] = [];
      let currentField = '';
      let inQuotes = false;

      for (let i = 0; i < csvData.length; i++) {
        const char = csvData[i];
        const nextChar = csvData[i + 1];

        if (inQuotes) {
          if (char === '"' && nextChar === '"') { // Escaped quote ("")
            currentField += '"';
            i++; // Skip the next quote
          } else if (char === '"') { // End of quoted field
            inQuotes = false;
          } else {
            currentField += char; // Character inside quoted field
          }
        } else { // Not in a quoted field
          if (char === '"') {
            inQuotes = true;
          } else if (char === ',') {
            currentRow.push(currentField);
            currentField = '';
          } else if (char === '\r' && nextChar === '\n') { // CRLF line ending
            currentRow.push(currentField);
            rows.push(currentRow);
            currentRow = [];
            currentField = '';
            i++; // Skip the \n
          } else if (char === '\n') { // LF line ending
            currentRow.push(currentField);
            rows.push(currentRow);
            currentRow = [];
            currentField = '';
          } else {
            currentField += char;
          }
        }
      }
      // Add the last field and row after the loop
      currentRow.push(currentField);
      rows.push(currentRow);

      // 3. Validate structure: Check for headers and sufficient data rows
      if (rows.length < 2 || (rows.length === 1 && rows[0].every(field => field === ''))) {
        this.error.set('CSV file is empty or has no data rows.');
        this.players.set([]);
        return;
      }
      
      const headers = rows[0].map(h => h.trim());
      const dataRows = rows.slice(1);
      
      const requiredHeaders = ['Name', 'Rating', 'Preferred Position', 'ExternalPrice', 'DefinitionId'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

      if (missingHeaders.length > 0) {
          this.error.set(`Invalid CSV format. Missing required columns: ${missingHeaders.join(', ')}`);
          this.players.set([]);
          return;
      }

      // 4. Process data rows with per-row validation
      const playerArray: Player[] = [];
      const headerMap = headers.reduce((acc, header, index) => {
        if (header) { // Ensure header is not empty
          acc[header] = index;
        }
        return acc;
      }, {} as {[key: string]: number});

      for (let i = 0; i < dataRows.length; i++) {
        const values = dataRows[i];
        const rowNumber = i + 2; // CSV is 1-indexed, plus header row

        // Skip empty lines that might exist at the end of the file
        if (values.length === 1 && values[0].trim() === '') {
            continue;
        }

        if (values.length !== headers.length) {
            console.warn(`Skipping malformed CSV row ${rowNumber}: Expected ${headers.length} fields, but found ${values.length}. Content: "${values.join(',')}"`);
            continue;
        }
        
        const player = {} as any;
        for (const header of headers) {
            if (header && headerMap[header] !== undefined) {
                player[header] = values[headerMap[header]].trim();
            }
        }

        if (!player.Name || !player.Rating) {
            console.warn(`Skipping player on row ${rowNumber} due to missing Name or Rating.`);
            continue;
        }

        const rating = parseInt(player.Rating, 10);
        if (isNaN(rating) || rating < 0 || rating > 99) {
            console.warn(`Skipping player "${player.Name}" on row ${rowNumber} due to invalid rating: "${player.Rating}".`);
            continue;
        }

        // Generate the Futbin image URL or use a placeholder
        if (player.DefinitionId) {
            player.imageUrl = `https://cdn.futbin.com/content/fc26/img/players/${player.DefinitionId}.png`;
        } else {
            player.imageUrl = this.placeholderImageUrl;
        }
        
        playerArray.push(player as Player);
      }
      
      // 5. Enrich player data
      if (playerArray.length > 0) {
        try {
            const fullPlayerDataMap = await this.playerDataService.getPlayerDataMap();
            const enrichedPlayers = playerArray.map(player => {
                const dbPlayer = fullPlayerDataMap.get(player.DefinitionId);
                if (dbPlayer) {
                    return {
                        ...player,
                        Pace: dbPlayer.Pace,
                        Shooting: dbPlayer.Shooting,
                        Passing: dbPlayer.Passing,
                        Dribbling: dbPlayer.Dribbling,
                        Defending: dbPlayer.Defending,
                        Physicality: dbPlayer.Physicality
                    };
                }
                return player;
            });
            this.players.set(enrichedPlayers);
        } catch (enrichError) {
            console.error('Failed to fetch or process player database:', enrichError);
            // Set players without enrichment if the database fails
            this.players.set(playerArray); 
            // Optionally set an error to inform the user
            this.error.set('Could not load detailed player stats. Displaying basic info from CSV.');
        }
      } else {
        this.players.set([]); // No players parsed
      }

      if (this.players().length === 0 && dataRows.some(r => r.length > 1 || r[0].trim() !== '')) {
          this.error.set('No valid player data could be parsed. Please check the CSV file format and content.');
      } else if (!this.error()) {
          this.error.set(''); // Clear previous errors on success
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
        this.coinBalance()
      );
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

  sortData(column: SortableColumn): void {
    if (this.sortColumn() === column) {
      this.sortDirection.update(dir => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortColumn.set(column);
      // Default sort direction for new columns
      if (column === 'Rating' || column === 'ExternalPrice') {
          this.sortDirection.set('desc');
      } else {
          this.sortDirection.set('asc');
      }
    }
  }

  getSortTooltip(column: SortableColumn): string {
    const currentSortColumn = this.sortColumn();
    const currentSortDirection = this.sortDirection();
    
    const friendlyColumnName = (col: SortableColumn): string => {
        switch (col) {
            case 'Preferred Position': return 'Position';
            case 'ExternalPrice': return 'Price';
            default: return col;
        }
    };

    const name = friendlyColumnName(column);

    if (currentSortColumn === column) {
      if (currentSortDirection === 'desc') {
        return `Sorted by ${name} (Descending). Click to sort ascending.`;
      } else {
        return `Sorted by ${name} (Ascending). Click to sort descending.`;
      }
    } else {
      return `Click to sort by ${name}.`;
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