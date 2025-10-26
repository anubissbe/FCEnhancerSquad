import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Player } from './models/player.model';
import { Recommendation } from './models/recommendation.model';
import { GeminiService } from './services/gemini.service';

const THEME_KEY = 'fut-squad-improver-theme';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule],
})
export class AppComponent {
  private geminiService = inject(GeminiService);

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
  minRatingFilter = signal<number>(0);
  maxRatingFilter = signal<number>(99);
  minPriceFilter = signal<number>(0);
  maxPriceFilter = signal<number>(20000000);

  filteredPlayers = computed(() => {
    const players = this.players();
    const name = this.nameFilter().toLowerCase();
    const position = this.positionFilter().toLowerCase();
    const minRating = this.minRatingFilter();
    const maxRating = this.maxRatingFilter();
    const minPrice = this.minPriceFilter();
    const maxPrice = this.maxPriceFilter();

    if (players.length === 0) {
        return [];
    }

    return players.filter(p => {
        const rating = parseInt(p.Rating, 10);
        const priceStr = p.ExternalPrice.trim();
        const price = priceStr !== '-- NA --' && !isNaN(Number(priceStr)) ? Number(priceStr) : 0;
        
        const nameMatch = p.Name.toLowerCase().includes(name);
        const positionMatch = position === '' || p['Preferred Position'].toLowerCase().includes(position) || p['Alternate Positions'].toLowerCase().includes(position);
        const ratingMatch = rating >= minRating && rating <= maxRating;
        const priceMatch = price >= minPrice && price <= maxPrice;

        return nameMatch && positionMatch && ratingMatch && priceMatch;
    });
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

  parseCsv(csvData: string): void {
    try {
      if (csvData.startsWith('\uFEFF')) {
        csvData = csvData.substring(1);
      }
      
      const lines = csvData.trim().split(/\r\n|\n/);
      if (lines.length < 2) {
        this.error.set('CSV file is empty or has no data rows.');
        return;
      }

      const parseLine = (line: string): string[] => {
        const fields: string[] = [];
        let currentField = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          const nextChar = line[i + 1];

          if (char === '"') {
            if (inQuotes && nextChar === '"') {
              currentField += '"';
              i++; 
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            fields.push(currentField.trim());
            currentField = '';
          } else {
            currentField += char;
          }
        }
        fields.push(currentField.trim());
        return fields;
      };

      const headers = parseLine(lines[0]);
      
      const requiredHeaders = ['Name', 'Rating', 'Preferred Position', 'ExternalPrice'];
      const hasHeaders = requiredHeaders.every(h => headers.includes(h));

      if (!hasHeaders) {
          this.error.set(`Invalid CSV format. Missing one of the required columns: ${requiredHeaders.join(', ')}`);
          return;
      }

      const playerArray: Player[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '') continue;
        
        const values = parseLine(line);
        
        if (values.length === headers.length) {
          const player = {} as any;
          for (let j = 0; j < headers.length; j++) {
            player[headers[j]] = values[j];
          }

          const rating = parseInt(player.Rating, 10);
          if (isNaN(rating) || rating < 0 || rating > 99) {
            console.warn(`Skipping player "${player.Name}" due to invalid rating: "${player.Rating}". Row ${i + 1}.`);
            continue;
          }
          
          playerArray.push(player as Player);
        } else {
          console.warn(`Skipping malformed CSV row ${i + 1}: Expected ${headers.length} fields, but found ${values.length}.`);
        }
      }
      
      this.players.set(playerArray);

      if (playerArray.length === 0 && lines.length > 1) {
          this.error.set('No valid player data could be parsed. Please check the CSV file format.');
      }

    } catch (e) {
      this.error.set('An unexpected error occurred while parsing the CSV file.');
      console.error(e);
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
  updateMinRatingFilter(event: Event) { this.minRatingFilter.set(Number((event.target as HTMLInputElement).value) || 0); }
  updateMaxRatingFilter(event: Event) { this.maxRatingFilter.set(Number((event.target as HTMLInputElement).value) || 99); }
  updateMinPriceFilter(event: Event) { this.minPriceFilter.set(Number((event.target as HTMLInputElement).value) || 0); }
  updateMaxPriceFilter(event: Event) { this.maxPriceFilter.set(Number((event.target as HTMLInputElement).value) || 20000000); }
  
  resetFilters() {
    this.nameFilter.set('');
    this.positionFilter.set('');
    this.minRatingFilter.set(0);
    this.maxRatingFilter.set(99);
    this.minPriceFilter.set(0);
    this.maxPriceFilter.set(20000000);
    
    // Reset input fields visually
    const resetInput = (id: string, value: string) => {
        const el = document.getElementById(id) as HTMLInputElement;
        if (el) el.value = value;
    };

    resetInput('name-filter', '');
    resetInput('position-filter', '');
    resetInput('min-rating-filter', '0');
    resetInput('max-rating-filter', '99');
    resetInput('min-price-filter', '0');
    resetInput('max-price-filter', '20000000');
  }
}