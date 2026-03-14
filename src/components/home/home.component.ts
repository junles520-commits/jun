
import { Component, OnInit, signal, computed, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { EtfService } from '../../services/etf.service';
import { ETFAnalysis } from '../../services/models';
import { FormsModule } from '@angular/forms';

type SortField = keyof ETFAnalysis | 'name' | 'code';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="space-y-4 md:space-y-6 pb-20 md:pb-0">
      <!-- Header & Stats -->
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div class="w-full md:w-auto">
          <h2 class="text-xl md:text-2xl font-bold text-slate-800">市场概览</h2>
          <p class="text-xs md:text-sm text-slate-500">实时追踪分析 {{ etfService.etfData().length }} 只主流 ETF</p>
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

      <!-- Advanced Filter Panel -->
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

      <!-- Search Bar -->
      @if (!showFilters()) {
        <div class="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-gray-100">
          <div class="relative w-full">
            <i class="fa-solid fa-search absolute left-3 top-3 text-gray-400"></i>
            <input type="text" [(ngModel)]="searchTerm" placeholder="搜索 ETF 名称或代码..." class="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm">
          </div>
        </div>
      }

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

      <!-- Data Table -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse min-w-[800px] md:min-w-0">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                <th class="p-3 md:p-4 w-10 md:w-12 text-center"></th> <!-- Fav Star Column -->
                <th class="p-3 md:p-4 cursor-pointer hover:text-blue-600 group sticky left-0 bg-gray-50 z-10 shadow-[1px_0_4px_-1px_rgba(0,0,0,0.1)] md:shadow-none" (click)="sort('name')">
                  ETF 名称 <i class="fa-solid fa-sort ml-1 text-gray-300 group-hover:text-blue-400"></i>
                </th>
                <th class="p-3 md:p-4 text-center cursor-pointer hover:text-blue-600 group">
                  行业
                </th>
                <th class="p-3 md:p-4 text-right cursor-pointer hover:text-blue-600 group" (click)="sort('currentPrice')">
                  最新 / 建议买入 <i class="fa-solid fa-sort ml-1 text-gray-300 group-hover:text-blue-400"></i>
                </th>
                <th class="p-3 md:p-4 text-right cursor-pointer hover:text-blue-600 group" (click)="sort('changePercent7d')">
                  7日涨跌 <i class="fa-solid fa-sort ml-1 text-gray-300 group-hover:text-blue-400"></i>
                </th>
                 <th class="p-3 md:p-4 text-center cursor-pointer hover:text-blue-600 group" (click)="sort('fundSize')">
                  最新规模(亿) <i class="fa-solid fa-sort ml-1 text-gray-300 group-hover:text-blue-400"></i>
                </th>
                 <th class="p-3 md:p-4 text-center cursor-pointer hover:text-blue-600 group" (click)="sort('goldenPrice')">
                  黄金值(支撑) <i class="fa-solid fa-sort ml-1 text-gray-300 group-hover:text-blue-400"></i>
                </th>
                 <th class="p-3 md:p-4 text-center cursor-pointer hover:text-blue-600 group" (click)="sort('buySignals')">
                  信号 <i class="fa-solid fa-sort ml-1 text-gray-300 group-hover:text-blue-400"></i>
                </th>
                 <th class="p-3 md:p-4 text-center cursor-pointer hover:text-blue-600 group" (click)="sort('score')">
                  评分 <i class="fa-solid fa-sort ml-1 text-gray-300 group-hover:text-blue-400"></i>
                </th>
                <th class="p-3 md:p-4 text-center cursor-pointer hover:text-blue-600 group" (click)="sort('health')">
                  健康度 <i class="fa-solid fa-sort ml-1 text-gray-300 group-hover:text-blue-400"></i>
                </th>
                <th class="p-3 md:p-4 text-center cursor-pointer hover:text-blue-600 group" (click)="sort('suggestion')">
                  投资建议 <i class="fa-solid fa-sort ml-1 text-gray-300 group-hover:text-blue-400"></i>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 text-sm">
              @for (etf of paginatedData(); track etf.code) {
                <tr class="hover:bg-blue-50/50 transition-colors group">
                  <td class="p-3 md:p-4 text-center">
                    <button (click)="toggleFav(etf.code); $event.stopPropagation()" class="text-base md:text-lg focus:outline-none transition-transform hover:scale-110 active:scale-95 p-1" 
                            [class.text-yellow-400]="etfService.isFavorite(etf.code)" 
                            [class.text-gray-300]="!etfService.isFavorite(etf.code)">
                        <i class="fa-star" [class.fa-solid]="etfService.isFavorite(etf.code)" [class.fa-regular]="!etfService.isFavorite(etf.code)"></i>
                    </button>
                  </td>
                  <td class="p-3 md:p-4 sticky left-0 bg-white group-hover:bg-blue-50/50 transition-colors z-10 shadow-[1px_0_4px_-1px_rgba(0,0,0,0.1)] md:shadow-none">
                    <a [routerLink]="['/detail', etf.code]" class="block">
                      <div class="font-bold text-slate-800 group-hover:text-blue-600 transition-colors truncate max-w-[120px] md:max-w-none">{{ etf.name }}</div>
                      <div class="text-xs text-gray-400 flex items-center gap-2">
                         <span>{{ etf.code }}</span>
                         @if (etf.age > 0) {
                            <span class="text-gray-300 hidden sm:inline">|</span>
                            <span title="成立日期: {{etf.establishmentDate}}" class="hidden sm:inline">{{ etf.age | number:'1.1-1' }}年</span>
                         }
                         @if (etf.isBreakout) {
                            <span class="text-[10px] text-white bg-red-500 px-1 rounded whitespace-nowrap ml-1" title="今日或昨日突破30日新高">🚀 新高</span>
                         }
                         @if (etf.isNearTrendline) {
                            <span class="text-[10px] text-indigo-700 bg-indigo-100 px-1 rounded whitespace-nowrap ml-1" title="接近平行趋势线上下轨">📈 趋势线</span>
                         }
                      </div>
                    </a>
                  </td>
                  <td class="p-3 md:p-4 text-center">
                    <span class="inline-block px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] md:text-xs font-medium whitespace-nowrap">{{ etf.displayIndustry }}</span>
                  </td>
                  <td class="p-3 md:p-4 text-right">
                    <div class="flex flex-col items-end">
                      <span class="font-bold text-slate-700">{{ etf.currentPrice | number:'1.3-3' }}</span>
                      <span class="text-xs scale-90 origin-right" [class.text-green-600]="etf.currentPrice <= etf.suggestedEntryPrice" [class.text-gray-400]="etf.currentPrice > etf.suggestedEntryPrice">
                        🎯 {{ etf.suggestedEntryPrice | number:'1.3-3' }}
                      </span>
                    </div>
                  </td>
                  <td class="p-3 md:p-4 text-right font-medium whitespace-nowrap" [class.text-red-500]="etf.changePercent7d > 0" [class.text-green-500]="etf.changePercent7d < 0">
                    {{ etf.changePercent7d > 0 ? '+' : '' }}{{ etf.changePercent7d | number:'1.2-2' }}%
                  </td>
                  <td class="p-3 md:p-4 text-center font-mono text-xs text-gray-500">
                    @if (etf.fundSize > 0) {
                      {{ etf.fundSize | number:'1.0-2' }}
                    } @else {
                      <span class="text-gray-300">--</span>
                    }
                  </td>
                   <td class="p-3 md:p-4 text-center text-xs">
                    @if (etf.goldenPrice > 0) {
                      <div class="flex flex-col items-center">
                        <span class="font-medium text-orange-600" title="近30日黄金分割(61.8%)位">{{ etf.goldenPrice | number:'1.3-3' }}</span>
                        @if (etf.isGolden) {
                          <span class="text-[10px] text-white bg-yellow-500 px-1 rounded whitespace-nowrap">触达</span>
                        }
                      </div>
                    } @else {
                      <span class="text-gray-300">--</span>
                    }
                  </td>
                  <td class="p-3 md:p-4 text-center">
                    <button (click)="openSignals(etf)" class="inline-flex items-center gap-1 md:gap-2 px-1 md:px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors whitespace-nowrap">
                      <span class="text-red-600 font-bold text-xs" title="买入信号数">{{ etf.buySignals }} <span class="hidden sm:inline">买</span></span>
                      <span class="w-px h-3 bg-gray-300"></span>
                      <span class="text-green-600 font-bold text-xs" title="卖出信号数">{{ etf.sellSignals }} <span class="hidden sm:inline">卖</span></span>
                    </button>
                  </td>
                  <td class="p-3 md:p-4 text-center">
                    <div class="relative w-12 md:w-16 h-1.5 md:h-2 bg-gray-200 rounded-full mx-auto overflow-hidden">
                      <div class="absolute top-0 left-0 h-full rounded-full transition-all duration-500" 
                           [style.width.%]="etf.score"
                           [class.bg-red-500]="etf.score >= 70"
                           [class.bg-yellow-500]="etf.score >= 40 && etf.score < 70"
                           [class.bg-green-500]="etf.score < 40">
                      </div>
                    </div>
                    <div class="text-[10px] text-gray-500 mt-1">{{ etf.score }}</div>
                  </td>
                   <!-- Health Column -->
                   <td class="p-3 md:p-4 text-center">
                     <div class="flex items-center justify-center gap-1 group/health relative">
                        <i class="fa-solid fa-heart-pulse text-xs" 
                           [class.text-red-500]="etf.health >= 70" 
                           [class.text-blue-500]="etf.health >= 40 && etf.health < 70" 
                           [class.text-gray-400]="etf.health < 40"></i>
                        <span class="text-xs font-bold font-mono">{{ etf.health }}</span>
                        
                        <!-- Tooltip -->
                        <div class="absolute bottom-full right-0 mb-2 hidden group-hover/health:block z-20 bg-slate-800 text-white text-[10px] p-2 rounded w-48 text-left shadow-lg">
                           <div class="mb-1 border-b border-gray-600 pb-1 font-bold">对称性分析 (Symmetry)</div>
                           <div class="flex justify-between">
                              <span>斜率比(Slope):</span>
                              <span>{{ etf.symmetry?.slopeRatio | number:'1.2-2' }}x</span>
                           </div>
                           <div class="flex justify-between">
                              <span>上波涨幅:</span>
                              <span>{{ etf.symmetry?.lastWave?.height | number:'1.2-2' }}</span>
                           </div>
                           <div class="flex justify-between">
                              <span>参考周期:</span>
                              <span>{{ etf.symmetry?.lastWave?.days }}天</span>
                           </div>
                        </div>
                     </div>
                  </td>
                  <td class="p-3 md:p-4 text-center">
                    <span class="px-2 py-1 rounded text-[10px] md:text-xs font-bold whitespace-nowrap border"
                          [class.bg-purple-100]="etf.suggestion === 'TAKE_PROFIT_CLEAR'"
                          [class.text-purple-700]="etf.suggestion === 'TAKE_PROFIT_CLEAR'"
                          [class.border-purple-200]="etf.suggestion === 'TAKE_PROFIT_CLEAR'"

                          [class.bg-orange-100]="etf.suggestion === 'TAKE_PROFIT_REDUCE'"
                          [class.text-orange-700]="etf.suggestion === 'TAKE_PROFIT_REDUCE'"
                          [class.border-orange-200]="etf.suggestion === 'TAKE_PROFIT_REDUCE'"

                          [class.bg-red-600]="etf.suggestion === 'BUY_POINT'"
                          [class.text-white]="etf.suggestion === 'BUY_POINT'"
                          [class.border-red-600]="etf.suggestion === 'BUY_POINT'"

                          [class.bg-green-100]="etf.suggestion === 'STOP_LOSS_REDUCE'"
                          [class.text-green-700]="etf.suggestion === 'STOP_LOSS_REDUCE'"
                          [class.border-green-200]="etf.suggestion === 'STOP_LOSS_REDUCE'"

                          [class.bg-green-200]="etf.suggestion === 'STOP_LOSS_CLEAR'"
                          [class.text-green-800]="etf.suggestion === 'STOP_LOSS_CLEAR'"
                          [class.border-green-300]="etf.suggestion === 'STOP_LOSS_CLEAR'"

                          [class.bg-blue-50]="etf.suggestion === 'OBSERVE'"
                          [class.text-blue-600]="etf.suggestion === 'OBSERVE'"
                          [class.border-blue-100]="etf.suggestion === 'OBSERVE'"

                          [class.bg-gray-100]="etf.suggestion === 'WAIT' || etf.suggestion === 'HOLD'"
                          [class.text-gray-500]="etf.suggestion === 'WAIT' || etf.suggestion === 'HOLD'"
                          [class.border-gray-200]="etf.suggestion === 'WAIT' || etf.suggestion === 'HOLD'">
                      {{ translateSuggestion(etf.suggestion) }}
                    </span>
                  </td>
                </tr>
              }
              @if (filteredAndSortedData().length === 0 && !etfService.loading()) {
                <tr>
                  <td colspan="11" class="p-8 md:p-12 text-center text-gray-400">
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
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        
        <!-- Pagination Controls -->
        @if (totalItems() > 0) {
          <div class="border-t border-gray-100 p-4 bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4">
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
    </div>
    
    <!-- Signal Detail Modal -->
    @if (selectedEtf) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" (click)="closeSignals()">
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 md:p-6 animate-[fadeIn_0.2s_ease-out]" (click)="$event.stopPropagation()">
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-lg md:text-xl font-bold text-slate-800">{{ selectedEtf.name }} <span class="text-gray-400 text-sm font-normal">{{ selectedEtf.code }}</span></h3>
            <button (click)="closeSignals()" class="text-gray-400 hover:text-gray-600 transition-colors bg-gray-100 w-8 h-8 rounded-full flex items-center justify-center">
              <i class="fa-solid fa-times text-lg"></i>
            </button>
          </div>
          
          <div class="space-y-4">
             <!-- Fund Info in Modal -->
            <div class="grid grid-cols-2 gap-2 text-sm bg-gray-50 p-3 rounded-lg border border-gray-100">
               <div><span class="text-gray-400">基金规模:</span> <span class="font-mono">{{ selectedEtf.fundSize | number:'1.2-2' }}亿</span></div>
               <div><span class="text-gray-400">成立时间:</span> <span>{{ selectedEtf.establishmentDate }}</span></div>
               <div><span class="text-gray-400">黄金支撑位:</span> <span class="font-mono text-orange-600">{{ selectedEtf.goldenPrice | number:'1.3-3' }}</span></div>
               <div><span class="text-gray-400">现价:</span> <span>{{ selectedEtf.currentPrice | number:'1.3-3' }}</span></div>
               <div><span class="text-gray-400">健康度:</span> <span class="font-bold text-blue-600">{{ selectedEtf.health }}</span></div>
               <div><span class="text-gray-400">斜率比:</span> <span class="font-mono">{{ selectedEtf.symmetry?.slopeRatio | number:'1.2-2' }}</span></div>
            </div>

            <div class="p-4 rounded-xl bg-red-50 border border-red-100">
              <h4 class="font-bold text-red-800 mb-2 flex items-center gap-2"><i class="fa-solid fa-arrow-trend-up"></i> 买入因子 ({{selectedEtf.buySignals}})</h4>
              <ul class="text-sm text-red-700 space-y-1 list-disc list-inside">
                @for (factor of selectedEtf.buyFactors; track factor) {
                    <li>{{ factor }}</li>
                }
                @if (selectedEtf.buyFactors.length === 0) { <li class="text-gray-400 list-none">未检测到强买入信号。</li> }
              </ul>
            </div>
            
            <div class="p-4 rounded-xl bg-green-50 border border-green-100">
              <h4 class="font-bold text-green-800 mb-2 flex items-center gap-2"><i class="fa-solid fa-arrow-trend-down"></i> 卖出因子 ({{selectedEtf.sellSignals}})</h4>
               <ul class="text-sm text-green-700 space-y-1 list-disc list-inside">
                @for (factor of selectedEtf.sellFactors; track factor) {
                    <li>{{ factor }}</li>
                }
                @if (selectedEtf.sellFactors.length === 0) { <li class="text-gray-400 list-none">未检测到强卖出信号。</li> }
              </ul>
            </div>
          </div>
          
          <div class="mt-6 text-right">
            <a [routerLink]="['/detail', selectedEtf.code]" class="inline-block px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors w-full text-center md:w-auto">查看完整图表</a>
          </div>
        </div>
      </div>
    }
  `
})
export class HomeComponent implements OnInit {
  etfService = inject(EtfService);
  
  // Filter Signals - Initialize from Service state
  searchTerm = signal('');
  showFilters = signal(false);
  filterGolden = signal(false);
  filterHighVolume = signal(false);
  filterBreakDowntrend = signal(false);
  filterBreakout = signal(false); // New signal for breakout
  filterNearTrendline = signal(false); // New signal for trendline
  filterBreakMA5 = signal(false);
  filterBreakMA20 = signal(false);
  filterTrend = signal('ALL');
  filterIndustry = signal('ALL');
  filterSuggestion = signal('ALL');
  filterMinBuySignals = signal(0);
  filterMinSellSignals = signal(0);
  filterMinScale = signal(0);
  filterMinAge = signal(0);

  // View Mode: 'ALL' or 'FAVORITES' or 'RECOMMENDED' (Default)
  viewMode = signal<'ALL' | 'FAVORITES' | 'RECOMMENDED'>('ALL'); // Changed default to ALL

  // Pagination & Sort
  currentPageSignal = signal(1);
  pageSize = signal(15);
  
  sortField = signal<string>('score');
  sortDirection = signal<SortDirection>('desc');

  // Modal
  selectedEtf: ETFAnalysis | null = null;

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
    
    // Explicitly handle viewMode to prefer ALL if saved is corrupted or empty
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
  toggleFav(code: string) { this.etfService.toggleFavorite(code); }
  
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
    this.viewMode.set('ALL'); // Reset to ALL by default
  }

  openSignals(etf: ETFAnalysis) { this.selectedEtf = etf; }
  closeSignals() { this.selectedEtf = null; }

  sort(field: string) {
    if (this.sortField() === field) {
      this.sortDirection.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDirection.set('desc');
    }
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
      
      // Recommended Filter
      if (this.viewMode() === 'RECOMMENDED' && item.suggestion !== 'BUY_POINT') return false;

      if (term && !item.name.includes(term) && !item.code.includes(term)) return false;
      if (this.filterGolden() && !item.isGolden) return false;
      if (this.filterHighVolume() && !item.isHighVolume) return false;
      if (this.filterBreakDowntrend() && !item.breakDowntrend) return false;
      if (this.filterBreakout() && !item.isBreakout) return false; // Breakout Filter
      if (this.filterNearTrendline() && !item.isNearTrendline) return false; // Near Trendline Filter
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
  
  translateSuggestion(s: string) {
    const map: Record<string, string> = {
      'OBSERVE': '👁 观察点',
      'BUY_POINT': '🚩 建仓点',
      'HOLD': '✊ 持仓待涨',
      'TAKE_PROFIT_REDUCE': '🎯 止盈A',
      'TAKE_PROFIT_CLEAR': '💰 止盈B',
      'STOP_LOSS_REDUCE': '🛡 止损A',
      'STOP_LOSS_CLEAR': '❌ 清仓点',
      'WAIT': '⏳ 观望'
    };
    return map[s] || s;
  }
}
