import { Component, OnInit, signal, computed, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EtfService } from '../../services/etf.service';
import { ETFAnalysis } from '../../services/models';
import { FormsModule } from '@angular/forms';
import { MiniChartComponent } from './mini-chart.component';

type SortField = keyof ETFAnalysis | 'name' | 'code';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-chart-grid',
  standalone: true,
  imports: [CommonModule, FormsModule, MiniChartComponent],
  template: `
    <div class="space-y-4 md:space-y-6 pb-20 md:pb-0">
      <!-- Header & Stats -->
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div class="w-full md:w-auto">
          <h2 class="text-xl md:text-2xl font-bold text-slate-800">K线网格视图</h2>
          <p class="text-xs md:text-sm text-slate-500">多图同列，快速发现交易机会</p>
        </div>
        
        <div class="flex flex-wrap items-center gap-2 w-full md:w-auto">
           <!-- View Mode Toggle -->
           <div class="flex items-center bg-gray-100 p-1 rounded-lg flex-grow md:flex-grow-0">
              <button (click)="setViewMode('FAVORITES')" [class.bg-white]="viewMode() === 'FAVORITES'" [class.shadow-sm]="viewMode() === 'FAVORITES'" class="flex-1 md:flex-none px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-2" [class.text-indigo-600]="viewMode() === 'FAVORITES'" [class.text-gray-500]="viewMode() !== 'FAVORITES'">
                 <i class="fa-solid fa-star"></i> <span class="hidden sm:inline">我的关注</span><span class="sm:hidden">关注</span>
              </button>
              <button (click)="setViewMode('RECOMMENDED')" [class.bg-white]="viewMode() === 'RECOMMENDED'" [class.shadow-sm]="viewMode() === 'RECOMMENDED'" class="flex-1 md:flex-none px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-2" [class.text-red-600]="viewMode() === 'RECOMMENDED'" [class.text-gray-500]="viewMode() !== 'RECOMMENDED'">
                 <i class="fa-solid fa-thumbs-up"></i> <span class="hidden sm:inline">系统推荐买入</span><span class="sm:hidden">推荐</span>
              </button>
              <button (click)="setViewMode('ALL')" [class.bg-white]="viewMode() === 'ALL'" [class.shadow-sm]="viewMode() === 'ALL'" class="flex-1 md:flex-none px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-2" [class.text-indigo-600]="viewMode() === 'ALL'" [class.text-gray-500]="viewMode() !== 'ALL'">
                 <i class="fa-solid fa-globe"></i> <span class="hidden sm:inline">全部 ETF</span><span class="sm:hidden">全部</span>
              </button>
           </div>

           <div class="flex items-center gap-2 flex-grow md:flex-grow-0">
             <button (click)="toggleFilters()" class="flex-1 md:flex-none px-3 md:px-4 py-2 bg-white border border-gray-200 text-slate-700 hover:bg-gray-50 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 text-xs md:text-sm font-medium" [class.bg-blue-50]="showFilters()" [class.border-blue-200]="showFilters()" [class.text-blue-700]="showFilters()">
               <i class="fa-solid fa-filter"></i>
               {{ showFilters() ? '隐藏' : '筛选' }}
             </button>
             
             <button (click)="refresh()" class="flex-1 md:flex-none px-3 md:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 text-xs md:text-sm font-medium" [disabled]="etfService.loading()">
               <i class="fa-solid fa-sync" [class.fa-spin]="etfService.loading()"></i>
               {{ etfService.loading() ? '...' : '刷新' }}
             </button>
           </div>
        </div>
      </div>

      <!-- Advanced Filter Panel (Same as Home) -->
      @if (showFilters()) {
        <div class="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-blue-100 animate-[fadeIn_0.2s_ease-out]">
          <div class="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
             <h3 class="font-bold text-slate-700 flex items-center gap-2 text-sm md:text-base"><i class="fa-solid fa-sliders text-blue-500"></i> 筛选条件</h3>
             <button (click)="resetFilters()" class="text-xs text-blue-600 hover:text-blue-800 hover:underline">重置</button>
          </div>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <!-- Checkboxes Group 1 -->
            <div class="space-y-3">
              <label class="flex items-center gap-2 text-xs md:text-sm text-slate-700 cursor-pointer select-none">
                <input type="checkbox" [(ngModel)]="filterBreakout" class="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300">
                <span class="flex items-center gap-1 font-bold text-red-600 bg-red-50 px-1 rounded">突破30日新高 <i class="fa-solid fa-rocket text-xs"></i></span>
              </label>
              <label class="flex items-center gap-2 text-xs md:text-sm text-slate-700 cursor-pointer select-none">
                <input type="checkbox" [(ngModel)]="filterNearTrendline" class="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300">
                <span class="flex items-center gap-1 font-bold text-indigo-600 bg-indigo-50 px-1 rounded">接近趋势线 <i class="fa-solid fa-chart-line text-xs"></i></span>
              </label>
              <label class="flex items-center gap-2 text-xs md:text-sm text-slate-700 cursor-pointer select-none">
                <input type="checkbox" [(ngModel)]="filterGolden" class="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300">
                <span class="flex items-center gap-1 font-medium">只看黄金值 <i class="fa-solid fa-star text-yellow-500 text-xs"></i></span>
              </label>
              <label class="flex items-center gap-2 text-xs md:text-sm text-slate-700 cursor-pointer select-none">
                <input type="checkbox" [(ngModel)]="filterHighVolume" class="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300">
                <span class="flex items-center gap-1">只看放量上涨 <i class="fa-solid fa-chart-simple text-gray-400 text-xs"></i></span>
              </label>
            </div>
            
            <!-- Checkboxes Group 2 -->
             <div class="space-y-3">
              <label class="flex items-center gap-2 text-xs md:text-sm text-slate-700 cursor-pointer select-none">
                <input type="checkbox" [(ngModel)]="filterBreakDowntrend" class="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300">
                <span class="text-green-700 font-medium bg-green-50 px-1 rounded">突破下降趋势</span>
              </label>
              <div class="flex gap-4">
                 <label class="flex items-center gap-2 text-xs md:text-sm text-slate-700 cursor-pointer select-none">
                  <input type="checkbox" [(ngModel)]="filterBreakMA5" class="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300">
                  <span class="text-purple-700 font-medium bg-purple-50 px-1 rounded">跌破MA5</span>
                </label>
                <label class="flex items-center gap-2 text-xs md:text-sm text-slate-700 cursor-pointer select-none">
                  <input type="checkbox" [(ngModel)]="filterBreakMA20" class="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300">
                  <span class="text-orange-700 font-medium bg-orange-50 px-1 rounded">跌破MA20</span>
                </label>
              </div>
            </div>

            <!-- Industry & Trend Select -->
            <div class="space-y-4">
               <div>
                 <label class="block text-xs font-bold text-gray-500 mb-1.5">行业分类</label>
                 <div class="relative">
                   <select [(ngModel)]="filterIndustry" class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs md:text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none">
                     <option value="ALL">全部行业</option>
                     @for (ind of etfService.availableIndustries(); track ind) {
                        <option [value]="ind">{{ ind }}</option>
                     }
                   </select>
                   <i class="fa-solid fa-chevron-down absolute right-3 top-3 text-gray-400 text-xs pointer-events-none"></i>
                 </div>
               </div>
               
               <div>
                 <label class="block text-xs font-bold text-gray-500 mb-1.5">趋势方向</label>
                 <div class="relative">
                   <select [(ngModel)]="filterTrend" class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs md:text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none">
                     <option value="ALL">全部趋势</option>
                     <option value="UP">📈 上涨趋势 (UP)</option>
                     <option value="DOWN">📉 下跌趋势 (DOWN)</option>
                     <option value="SIDEWAYS">➡️ 震荡整理 (SIDEWAYS)</option>
                   </select>
                   <i class="fa-solid fa-chevron-down absolute right-3 top-3 text-gray-400 text-xs pointer-events-none"></i>
                 </div>
               </div>
            </div>

            <!-- Filter Controls -->
            <div class="space-y-4">
              <!-- Scale & Suggestion -->
              <div class="grid grid-cols-2 gap-3">
                  <div>
                     <label class="block text-xs font-bold text-gray-500 mb-1.5">最小规模 (亿)</label>
                     <input type="number" min="0" [(ngModel)]="filterMinScale" placeholder="0" class="w-full p-2 border border-gray-200 rounded-lg text-xs md:text-sm focus:ring-2 focus:ring-blue-500 outline-none text-center">
                  </div>
                  <div>
                     <label class="block text-xs font-bold text-gray-500 mb-1.5">投资建议</label>
                     <div class="relative">
                        <select [(ngModel)]="filterSuggestion" class="w-full p-2 border border-gray-200 rounded-lg text-xs md:text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none">
                           <option value="ALL">全部</option>
                           <option value="BUY_POINT">🚩 建仓点</option>
                           <option value="OBSERVE">👁 观察点</option>
                           <option value="TAKE_PROFIT_REDUCE">🎯 止盈A</option>
                           <option value="TAKE_PROFIT_CLEAR">💰 止盈B</option>
                           <option value="STOP_LOSS_REDUCE">🛡 止损A</option>
                           <option value="STOP_LOSS_CLEAR">❌ 清仓点</option>
                           <option value="HOLD">✊ 持仓</option>
                           <option value="WAIT">⏳ 观望</option>
                        </select>
                        <i class="fa-solid fa-chevron-down absolute right-2 top-2.5 text-gray-400 text-xs pointer-events-none"></i>
                     </div>
                  </div>
              </div>

               <!-- Signals & Age -->
              <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1.5">最少买入信号</label>
                    <input type="number" min="0" max="10" [(ngModel)]="filterMinBuySignals" class="w-full p-2 border border-gray-200 rounded-lg text-xs md:text-sm focus:ring-2 focus:ring-blue-500 outline-none text-center">
                  </div>
                   <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1.5">成立年限 (年)</label>
                    <input type="number" min="0" max="20" [(ngModel)]="filterMinAge" class="w-full p-2 border border-gray-200 rounded-lg text-xs md:text-sm focus:ring-2 focus:ring-blue-500 outline-none text-center">
                  </div>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Search Bar & Strategy Selector -->
      <div class="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
        <div class="relative flex-grow">
          <i class="fa-solid fa-search absolute left-3 top-3 text-gray-400"></i>
          <input type="text" [(ngModel)]="searchTerm" placeholder="搜索 ETF 名称或代码..." class="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm">
        </div>
        <div class="w-full md:w-64">
           <div class="relative">
             <select [(ngModel)]="selectedStrategy" class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none font-medium text-slate-700">
               <option value="NONE">无画线</option>
               <option value="DONCHIAN">海龟交易法则 (唐奇安通道)</option>
               <option value="STRATEGY_MARKERS">策略买卖点 (R1-R10)</option>
               <option value="SUP_RES">智能支撑/压力 (线性回归)</option>
               <option value="TREND_CHANNEL">平行趋势线 (通道)</option>
               <option value="FIBONACCI">黄金分割 + 拓展线</option>
               <option value="RESONANCE">多周期共振标注 (箱体)</option>
               <option value="MA_SLOPE">均线斜率共振</option>
               <option value="VOLUME_PROFILE">成交量分布 + 波浪理论</option>
             </select>
             <i class="fa-solid fa-chevron-down absolute right-3 top-3 text-gray-400 text-xs pointer-events-none"></i>
           </div>
        </div>
      </div>

      <!-- Error Message -->
      @if (etfService.error()) {
        <div class="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center gap-3">
           <i class="fa-solid fa-triangle-exclamation text-xl"></i>
           <div>
             <p class="font-bold">数据加载失败</p>
             <p class="text-sm">{{ etfService.error() }}</p>
           </div>
        </div>
      }

      <!-- Grid Layout -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
         @for (etf of paginatedData(); track etf.code) {
             <app-mini-chart [etf]="etf" [strategy]="selectedStrategy()"></app-mini-chart>
         }
      </div>
      
      @if (filteredAndSortedData().length === 0 && !etfService.loading()) {
        <div class="p-8 md:p-12 text-center text-gray-400 bg-white rounded-xl shadow-sm border border-gray-100">
          @if (etfService.error()) {
            <i class="fa-solid fa-triangle-exclamation text-3xl md:text-4xl mb-3 text-red-400"></i>
            <p class="text-red-500">数据加载失败，请尝试刷新。</p>
          } @else if (etfService.etfData().length === 0) {
            <i class="fa-solid fa-database text-3xl md:text-4xl mb-3"></i>
            <p>暂无数据，请尝试刷新页面。</p>
          } @else {
            <i class="fa-solid fa-inbox text-3xl md:text-4xl mb-3"></i>
            <p>未找到匹配的 ETF。</p>
            @if (viewMode() === 'FAVORITES' || viewMode() === 'RECOMMENDED') {
               <p class="text-sm mt-2 text-indigo-500 cursor-pointer" (click)="setViewMode('ALL')">切换到全部列表查看</p>
            } @else if (showFilters()) {
              <p class="text-sm mt-2 text-blue-500 cursor-pointer" (click)="resetFilters()">清除筛选条件</p>
            }
          }
        </div>
      }

      <!-- Pagination Controls -->
      @if (totalItems() > 0) {
        <div class="border border-gray-100 p-4 bg-white rounded-xl shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
           <div class="text-xs text-gray-500">
             显示 {{ (currentPage - 1) * pageSize() + 1 }} - {{ Math.min(currentPage * pageSize(), totalItems()) }} / {{ totalItems() }}
           </div>
           
           <div class="flex items-center gap-1">
             <button (click)="prevPage()" [disabled]="currentPage === 1" class="px-2 md:px-3 py-1.5 text-xs font-medium rounded-md bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700">
               <i class="fa-solid fa-chevron-left mr-1"></i> 上一页
             </button>
             
             <div class="flex gap-1 mx-2">
               @for (page of visiblePages(); track page) {
                  <button (click)="goToPage(page)" 
                      class="min-w-[28px] md:min-w-[32px] h-8 flex items-center justify-center text-xs font-medium rounded-md transition-colors"
                      [class.bg-blue-600]="currentPage === page"
                      [class.text-white]="currentPage === page"
                      [class.bg-white]="currentPage !== page"
                      [class.text-gray-700]="currentPage !== page"
                      [class.border]="currentPage !== page"
                      [class.border-gray-300]="currentPage !== page"
                      [class.hover:bg-gray-50]="currentPage !== page">
                      {{ page }}
                  </button>
               }
             </div>

             <button (click)="nextPage()" [disabled]="currentPage === totalPages()" class="px-2 md:px-3 py-1.5 text-xs font-medium rounded-md bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700">
               下一页 <i class="fa-solid fa-chevron-right ml-1"></i>
             </button>
           </div>
        </div>
      }
    </div>
  `
})
export class ChartGridComponent implements OnInit {
  etfService = inject(EtfService);
  
  // Filter Signals - Initialize from Service state
  searchTerm = signal('');
  showFilters = signal(false);
  filterGolden = signal(false);
  filterHighVolume = signal(false);
  filterBreakDowntrend = signal(false);
  filterBreakout = signal(false);
  filterNearTrendline = signal(false);
  filterBreakMA5 = signal(false);
  filterBreakMA20 = signal(false);
  filterTrend = signal('ALL');
  filterIndustry = signal('ALL');
  filterSuggestion = signal('ALL');
  filterMinBuySignals = signal(0);
  filterMinSellSignals = signal(0);
  filterMinScale = signal(0);
  filterMinAge = signal(0);

  // View Mode: 'ALL' or 'FAVORITES' (Default)
  viewMode = signal<'ALL' | 'FAVORITES' | 'RECOMMENDED'>('ALL');

  // Pagination & Sort
  currentPageSignal = signal(1);
  pageSize = signal(10); // 10 per page for grid view
  
  sortField = signal<string>('score');
  sortDirection = signal<SortDirection>('desc');

  // Strategy
  selectedStrategy = signal<string>('NONE');

  constructor() {
    // 1. Initialize from Service
    const saved = this.etfService.filterState();
    this.searchTerm.set(saved.searchTerm);
    this.showFilters.set(saved.showFilters);
    this.filterGolden.set(saved.filterGolden);
    this.filterHighVolume.set(saved.filterHighVolume);
    this.filterBreakDowntrend.set(saved.filterBreakDowntrend);
    this.filterBreakout.set(saved.filterBreakout);
    this.filterNearTrendline.set(saved.filterNearTrendline || false);
    this.filterBreakMA5.set(saved.filterBreakMA5);
    this.filterBreakMA20.set(saved.filterBreakMA20);
    this.filterTrend.set(saved.filterTrend);
    this.filterIndustry.set(saved.filterIndustry);
    this.filterSuggestion.set(saved.filterSuggestion);
    this.filterMinBuySignals.set(saved.filterMinBuySignals);
    this.filterMinSellSignals.set(saved.filterMinSellSignals);
    this.filterMinScale.set(saved.filterMinScale);
    this.filterMinAge.set(saved.filterMinAge);
    this.currentPageSignal.set(saved.currentPage);
    this.sortField.set(saved.sortField);
    this.sortDirection.set(saved.sortDirection);
    
    if (saved.viewMode) {
        this.viewMode.set(saved.viewMode);
    } else {
        this.viewMode.set('ALL');
    }

    // 2. Sync changes back to Service
    effect(() => {
        this.etfService.updateFilterState({
            searchTerm: this.searchTerm(),
            showFilters: this.showFilters(),
            filterGolden: this.filterGolden(),
            filterHighVolume: this.filterHighVolume(),
            filterBreakDowntrend: this.filterBreakDowntrend(),
            filterBreakout: this.filterBreakout(),
            filterNearTrendline: this.filterNearTrendline(),
            filterBreakMA5: this.filterBreakMA5(),
            filterBreakMA20: this.filterBreakMA20(),
            filterTrend: this.filterTrend(),
            filterIndustry: this.filterIndustry(),
            filterSuggestion: this.filterSuggestion(),
            filterMinBuySignals: this.filterMinBuySignals(),
            filterMinSellSignals: this.filterMinSellSignals(),
            filterMinScale: this.filterMinScale(),
            filterMinAge: this.filterMinAge(),
            currentPage: this.currentPageSignal(),
            sortField: this.sortField(),
            sortDirection: this.sortDirection(),
            viewMode: this.viewMode()
        });
    });
  }

  ngOnInit() {
    if (this.etfService.etfData().length === 0) {
      this.etfService.loadAllEtfs();
    }
  }

  // Getters for template compatibility
  get currentPage() { return this.currentPageSignal(); }
  get Math() { return Math; }

  // Actions
  toggleFilters() { this.showFilters.update(v => !v); }
  refresh() { this.etfService.loadAllEtfs(); }
  
  // Set View Mode manually and reset pagination
  setViewMode(mode: 'ALL' | 'FAVORITES' | 'RECOMMENDED') {
      this.viewMode.set(mode);
      this.currentPageSignal.set(1);
  }
  
  resetFilters() {
    this.etfService.resetFilterState();
    // Re-sync local signals
    const defaults = this.etfService.filterState();
    this.searchTerm.set(defaults.searchTerm);
    this.filterGolden.set(defaults.filterGolden);
    this.filterHighVolume.set(defaults.filterHighVolume);
    this.filterBreakDowntrend.set(defaults.filterBreakDowntrend);
    this.filterBreakout.set(defaults.filterBreakout);
    this.filterNearTrendline.set(defaults.filterNearTrendline || false);
    this.filterBreakMA5.set(defaults.filterBreakMA5);
    this.filterBreakMA20.set(defaults.filterBreakMA20);
    this.filterTrend.set(defaults.filterTrend);
    this.filterIndustry.set(defaults.filterIndustry);
    this.filterSuggestion.set(defaults.filterSuggestion);
    this.filterMinBuySignals.set(defaults.filterMinBuySignals);
    this.filterMinSellSignals.set(defaults.filterMinSellSignals);
    this.filterMinScale.set(defaults.filterMinScale);
    this.filterMinAge.set(defaults.filterMinAge);
    this.currentPageSignal.set(defaults.currentPage);
    this.viewMode.set('ALL'); 
  }

  // Pagination
  prevPage() { if (this.currentPageSignal() > 1) this.currentPageSignal.update(p => p - 1); }
  nextPage() { if (this.currentPageSignal() < this.totalPages()) this.currentPageSignal.update(p => p + 1); }
  goToPage(p: number) { this.currentPageSignal.set(p); }

  // Computed Data
  filteredAndSortedData = computed(() => {
    let data = this.etfService.etfData();
    const term = this.searchTerm().toLowerCase();
    
    // 1. Filter
    data = data.filter(item => {
      // Favorites Filter
      if (this.viewMode() === 'FAVORITES' && !this.etfService.favorites().has(item.code)) return false;
      if (this.viewMode() === 'RECOMMENDED' && item.suggestion !== 'BUY_POINT') return false;

      if (term && !item.name.includes(term) && !item.code.includes(term)) return false;
      if (this.filterGolden() && !item.isGolden) return false;
      if (this.filterHighVolume() && !item.isHighVolume) return false;
      if (this.filterBreakDowntrend() && !item.breakDowntrend) return false;
      if (this.filterBreakout() && !item.isBreakout) return false;
      if (this.filterNearTrendline() && !item.isNearTrendline) return false;
      if (this.filterBreakMA5() && !item.breakMA5) return false;
      if (this.filterBreakMA20() && !item.breakMA20) return false;
      if (this.filterTrend() !== 'ALL' && item.trend !== this.filterTrend()) return false;
      if (this.filterIndustry() !== 'ALL' && item.industry !== this.filterIndustry()) return false;
      if (this.filterSuggestion() !== 'ALL' && item.suggestion !== this.filterSuggestion()) return false;
      if (item.buySignals < this.filterMinBuySignals()) return false;
      if (item.sellSignals < this.filterMinSellSignals()) return false;
      if (item.fundSize < this.filterMinScale()) return false;
      if (item.age < this.filterMinAge()) return false;
      return true;
    });

    // 2. Sort
    const field = this.sortField() as keyof ETFAnalysis;
    const direction = this.sortDirection();
    
    return data.sort((a, b) => {
      const valA = a[field];
      const valB = b[field];
      
      if (valA === valB) return 0;
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;
      
      const comparison = valA > valB ? 1 : -1;
      return direction === 'asc' ? comparison : -comparison;
    });
  });

  totalItems = computed(() => this.filteredAndSortedData().length);
  
  totalPages = computed(() => Math.ceil(this.totalItems() / this.pageSize()));

  paginatedData = computed(() => {
    const data = this.filteredAndSortedData();
    const page = this.currentPageSignal();
    const size = this.pageSize();
    const start = (page - 1) * size;
    return data.slice(start, start + size);
  });

  visiblePages = computed(() => {
    const total = this.totalPages();
    const current = this.currentPageSignal();
    const delta = 2;
    const range = [];
    for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) {
      range.push(i);
    }
    return range;
  });
}
