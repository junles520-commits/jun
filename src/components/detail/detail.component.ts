
import { Component, OnInit, ElementRef, inject, signal, effect, computed, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { EtfService, NewsAnalysisResult } from '../../services/etf.service';
import { ETFAnalysis, KlinePoint } from '../../services/models';
import * as d3Raw from 'd3';
const d3 = d3Raw as any;
import { drawBaseLayer, drawSupRes, drawTrendChannel, drawVolumeProfile, drawResonanceSignal, drawMASlope, drawSubCharts, drawFibonacci, calculateLR, FibLevel, drawStrategyMarkers, drawDonchianChannel } from './chart-painters';

@Component({
  selector: 'app-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="space-y-4 md:space-y-6 pb-12 animate-[fadeIn_0.3s_ease-out]">
      <!-- Header -->
      <div class="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div class="w-full">
           <div class="flex items-center gap-3 mb-2">
             <a routerLink="/" class="text-gray-400 hover:text-blue-600 transition-colors"><i class="fa-solid fa-arrow-left text-lg"></i></a>
             <h1 class="text-xl md:text-2xl font-bold text-slate-800 truncate">{{ data()?.name }}</h1>
             <span class="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs font-mono whitespace-nowrap">{{ data()?.code }}</span>
           </div>
           
           <div class="flex flex-wrap items-center gap-x-4 md:gap-x-6 gap-y-2 text-xs md:text-sm text-gray-500">
             <span>现价: <strong class="text-slate-800 text-sm md:text-base">{{ data()?.currentPrice | number:'1.3-3' }}</strong></span>
             <span [class.text-red-500]="(data()?.changePercent7d || 0) > 0" [class.text-green-500]="(data()?.changePercent7d || 0) < 0">
               7日涨跌: {{ data()?.changePercent7d | number:'1.2-2' }}%
             </span>

             <div class="flex items-center gap-2 md:gap-3 ml-auto md:ml-0 text-[10px] md:text-xs whitespace-nowrap">
                <span class="text-gray-400 hidden sm:inline">更新时间: {{ data()?.lastUpdated }}</span>
                <span class="w-px h-3 bg-gray-300 hidden sm:block"></span>
                <span class="text-slate-600 font-medium" title="近30个交易日每日振幅((最高-最低)/最低)的平均值">
                   30日平均振幅: <span class="text-purple-600 font-bold">{{ avgVolatility30d() | number:'1.2-2' }}%</span>
                </span>
             </div>
             
             @if (alphaVantageData()) {
                 <div class="flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-lg border border-indigo-100 mt-2 md:mt-0" title="数据来源: Alpha Vantage">
                    <span class="text-xs font-bold text-indigo-800">Alpha Vantage</span>
                    <span class="text-sm font-mono font-bold text-indigo-600">{{ alphaVantageData()?.price | number:'1.3-3' }}</span>
                    <span class="text-xs" [class.text-red-500]="(alphaVantageData()?.changePercent || 0) > 0" [class.text-green-500]="(alphaVantageData()?.changePercent || 0) < 0">
                        {{ (alphaVantageData()?.changePercent || 0) > 0 ? '+' : '' }}{{ alphaVantageData()?.changePercent | number:'1.2-2' }}%
                    </span>
                 </div>
             }
             
             @if (finnhubData()) {
                 <div class="flex items-center gap-2 px-3 py-1 bg-teal-50 rounded-lg border border-teal-100 mt-2 md:mt-0" title="数据来源: Finnhub">
                    <span class="text-xs font-bold text-teal-800">Finnhub</span>
                    <span class="text-sm font-mono font-bold text-teal-600">{{ finnhubData()?.c | number:'1.3-3' }}</span>
                    <span class="text-xs" [class.text-red-500]="(finnhubData()?.dp || 0) > 0" [class.text-green-500]="(finnhubData()?.dp || 0) < 0">
                        {{ (finnhubData()?.dp || 0) > 0 ? '+' : '' }}{{ finnhubData()?.dp | number:'1.2-2' }}%
                    </span>
                 </div>
             }
           </div>
        </div>
      </div>

      <!-- Professional Trading Plan -->
      <div class="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100">
         <div class="flex items-center gap-2 mb-4">
           <h3 class="font-bold text-slate-700 text-sm md:text-base">
             <i class="fa-solid fa-crosshairs text-red-500"></i> AI 量化交易计划
           </h3>
           <span class="px-2 py-0.5 bg-red-50 text-red-600 rounded text-[10px] font-medium border border-red-100">专业版</span>
           @if (newsAnalysis()?.tradingPlan) {
             <span class="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-medium border border-indigo-100 animate-pulse">
               <i class="fa-solid fa-bolt mr-1"></i> AI 深度分析已应用
             </span>
           }
         </div>
         @if (getProfessionalAdvice(); as advice) {
           <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
             <!-- 投资评级 -->
             <div class="p-3 bg-gray-50 rounded-lg border border-gray-100 flex flex-col justify-center items-center text-center">
               <p class="text-[10px] md:text-xs text-gray-500 mb-1">投资评级</p>
               <p class="text-xs md:text-sm font-bold px-2 py-1 rounded border" [ngClass]="advice.ratingColor">
                 {{ advice.rating }}
               </p>
             </div>
             <!-- 风险等级 -->
             <div class="p-3 bg-gray-50 rounded-lg border border-gray-100 flex flex-col justify-center items-center text-center">
               <p class="text-[10px] md:text-xs text-gray-500 mb-1">风险等级</p>
               <p class="text-xs md:text-sm font-bold" [ngClass]="advice.riskColor">
                 <i class="fa-solid fa-shield-halved mr-1"></i> {{ advice.riskLevel }}
               </p>
             </div>
             <!-- 操作建议 -->
             <div class="p-3 bg-gray-50 rounded-lg border border-gray-100 flex flex-col justify-center items-center text-center col-span-2 md:col-span-1">
               <p class="text-[10px] md:text-xs text-gray-500 mb-1">操作建议</p>
               <p class="text-xs md:text-sm font-bold text-slate-700">
                 {{ advice.operation }}
               </p>
             </div>
             <!-- 目标价位 -->
             <div class="p-3 bg-red-50 rounded-lg border border-red-100 flex flex-col justify-center items-center text-center">
               <p class="text-[10px] md:text-xs text-red-800/70 mb-1">目标价位</p>
               <p class="text-sm md:text-base font-mono font-bold text-red-600">
                 {{ advice.targetPrice | number:'1.3-3' }}
               </p>
             </div>
             <!-- 止盈位 -->
             <div class="p-3 bg-red-50 rounded-lg border border-red-100 flex flex-col justify-center items-center text-center">
               <p class="text-[10px] md:text-xs text-red-800/70 mb-1">止盈位</p>
               <p class="text-sm md:text-base font-mono font-bold text-red-600">
                 {{ advice.takeProfit | number:'1.3-3' }}
               </p>
             </div>
             <!-- 止损位 -->
             <div class="p-3 bg-green-50 rounded-lg border border-green-100 flex flex-col justify-center items-center text-center">
               <p class="text-[10px] md:text-xs text-green-800/70 mb-1">止损位</p>
               <p class="text-sm md:text-base font-mono font-bold text-green-600">
                 {{ advice.stopLoss | number:'1.3-3' }}
               </p>
             </div>
           </div>
         }
      </div>

      <!-- Main Chart Container -->
      <div class="bg-white p-2 md:p-4 rounded-xl shadow-sm border border-gray-200 min-h-[450px] md:min-h-[650px] relative flex flex-col">
        <div class="flex flex-wrap justify-between items-center mb-2 md:mb-4 px-1 gap-2 md:gap-4">
           <div class="flex flex-wrap items-center gap-3 md:gap-4 w-full md:w-auto">
               <h3 class="font-bold text-slate-700 text-sm md:text-base">K线 / 成交量 / MACD</h3>
           </div>
           
           <div class="flex flex-wrap gap-2 md:gap-4 text-xs select-none items-center w-full md:w-auto justify-between md:justify-end">
             
             <!-- Range Selector -->
             <div class="flex bg-gray-100 rounded-lg p-0.5 md:p-1">
                @for (range of ranges; track range) {
                   <button (click)="setRange(range)" 
                      class="px-2 md:px-3 py-1 rounded-md transition-all font-medium border border-transparent text-[10px] md:text-xs"
                      [class.bg-white]="selectedRange() === range"
                      [class.shadow-sm]="selectedRange() === range"
                      [class.border-gray-200]="selectedRange() === range"
                      [class.text-blue-600]="selectedRange() === range"
                      [class.text-gray-500]="selectedRange() !== range"
                      [class.hover:text-blue-500]="selectedRange() !== range">
                      {{ range }}日
                   </button>
                }
             </div>

             <!-- Legend & Tools Container -->
             <div class="flex items-center gap-2 md:gap-4">
                 <!-- MA Legend (Hidden on small mobile) -->
                 <div class="hidden sm:flex items-center gap-2">
                     <button (click)="toggleMA('ma5')" 
                             [class.opacity-100]="showMA5()" [class.opacity-40]="!showMA5()"
                             class="flex items-center gap-1 hover:opacity-80 transition-opacity focus:outline-none">
                        <span class="w-2 h-2 md:w-3 md:h-0.5 rounded-full md:rounded-none bg-purple-500"></span> <span class="hidden md:inline">MA5</span>
                     </button>
                     <button (click)="toggleMA('ma20')" 
                             [class.opacity-100]="showMA20()" [class.opacity-40]="!showMA20()"
                             class="flex items-center gap-1 hover:opacity-80 transition-opacity focus:outline-none">
                        <span class="w-2 h-2 md:w-3 md:h-0.5 rounded-full md:rounded-none bg-orange-500"></span> <span class="hidden md:inline">MA20</span>
                     </button>
                     <button (click)="toggleMA('ma60')" 
                             [class.opacity-100]="showMA60()" [class.opacity-40]="!showMA60()"
                             class="flex items-center gap-1 hover:opacity-80 transition-opacity focus:outline-none">
                        <span class="w-2 h-2 md:w-3 md:h-0.5 rounded-full md:rounded-none bg-blue-500"></span> <span class="hidden md:inline">MA60</span>
                     </button>
                 </div>
                 
                 <span class="w-px h-3 bg-gray-300 mx-1 hidden sm:block"></span>

                 <!-- Drawing Tools Dropdown -->
                 <div class="relative">
                    <button (click)="toggleDrawingsMenu()" 
                            class="px-2 md:px-3 py-1 md:py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-slate-700 rounded-lg shadow-sm flex items-center gap-1 md:gap-2 transition-colors text-[10px] md:text-xs"
                            [class.text-blue-600]="showDrawingsMenu()"
                            [class.border-blue-200]="showDrawingsMenu()">
                       <i class="fa-solid fa-layer-group"></i> <span class="hidden sm:inline">画线显示</span>
                       <i class="fa-solid fa-chevron-down text-[8px] md:text-[10px]"></i>
                    </button>

                    @if (showDrawingsMenu()) {
                      <div class="fixed inset-0 z-40" (click)="showDrawingsMenu.set(false)"></div>
                      <div class="absolute right-0 top-full mt-2 w-48 md:w-56 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-[fadeIn_0.1s_ease-out]">
                         <div class="p-1 space-y-0.5 max-h-[300px] md:max-h-[400px] overflow-y-auto">
                            <!-- Standard Tools -->
                            <div class="px-3 py-1 text-[10px] text-gray-400 font-bold uppercase tracking-wider">基础画线</div>
                            <button (click)="toggleStrategyMarkers()" class="w-full text-left px-3 py-2 text-xs flex items-center justify-between rounded-lg hover:bg-gray-50 transition-colors group">
                               <span class="text-slate-700 font-medium">策略买卖点 (R1-R10)</span>
                               @if (showStrategyMarkers()) { <i class="fa-solid fa-check text-red-500"></i> }
                            </button>
                            <button (click)="toggleSupRes()" class="w-full text-left px-3 py-2 text-xs flex items-center justify-between rounded-lg hover:bg-gray-50 transition-colors group">
                               <span class="text-slate-700 font-medium">智能支撑/压力 (线性回归)</span>
                               @if (showSupRes()) { <i class="fa-solid fa-check text-indigo-500"></i> }
                            </button>
                            <button (click)="toggleTrendChannel()" class="w-full text-left px-3 py-2 text-xs flex items-center justify-between rounded-lg hover:bg-gray-50 transition-colors group">
                               <span class="text-slate-700 font-medium">平行趋势线 (通道)</span>
                               @if (showTrendChannel()) { <i class="fa-solid fa-check text-blue-500"></i> }
                            </button>
                            <button (click)="toggleFib()" class="w-full text-left px-3 py-2 text-xs flex items-center justify-between rounded-lg hover:bg-gray-50 transition-colors group">
                               <span class="text-slate-700 font-medium">黄金分割 + 拓展线</span>
                               @if (showFib()) { <i class="fa-solid fa-check text-orange-500"></i> }
                            </button>

                            <div class="h-px bg-gray-100 my-1"></div>
                            
                            <!-- Advanced Tools -->
                            <div class="px-3 py-1 text-[10px] text-gray-400 font-bold uppercase tracking-wider">高级共振</div>
                            <button (click)="toggleResonance()" class="w-full text-left px-3 py-2 text-xs flex items-center justify-between rounded-lg hover:bg-gray-50 transition-colors group">
                               <span class="text-slate-700 font-medium">多周期共振标注 (箱体+POC)</span>
                               @if (showResonance()) { <i class="fa-solid fa-check text-yellow-600"></i> }
                            </button>
                            <button (click)="toggleVolume123()" class="w-full text-left px-3 py-2 text-xs flex items-center justify-between rounded-lg hover:bg-gray-50 transition-colors group">
                               <span class="text-slate-700 font-medium">成交量分布 + 波浪理论</span>
                               @if (showVolume123()) { <i class="fa-solid fa-check text-purple-500"></i> }
                            </button>
                            <button (click)="toggleMASlope()" class="w-full text-left px-3 py-2 text-xs flex items-center justify-between rounded-lg hover:bg-gray-50 transition-colors group">
                               <span class="text-slate-700 font-medium">均线斜率共振</span>
                               @if (showMASlope()) { <i class="fa-solid fa-check text-pink-500"></i> }
                            </button>
                            <button (click)="toggleDonchian()" class="w-full text-left px-3 py-2 text-xs flex items-center justify-between rounded-lg hover:bg-gray-50 transition-colors group">
                               <span class="text-slate-700 font-medium">海龟交易法则 (唐奇安通道)</span>
                               @if (showDonchian()) { <i class="fa-solid fa-check text-teal-500"></i> }
                            </button>
                         </div>
                      </div>
                    }
                 </div>
             </div>
           </div>
        </div>
        
        <div #chartContainer class="flex-grow w-full h-[400px] md:h-[650px] relative"></div>
        
        @if (!data()) {
          <div class="absolute inset-0 flex items-center justify-center bg-white/80 z-20">
            <div class="text-center">
               <i class="fa-solid fa-circle-notch fa-spin text-3xl md:text-4xl text-blue-500 mb-2"></i>
               <p class="text-gray-500 text-xs md:text-sm">正在加载市场数据...</p>
            </div>
          </div>
        } 
        
        @if (data() && (!data()!.history || data()!.history.length === 0)) {
           <div class="absolute inset-0 flex items-center justify-center bg-white z-20">
            <div class="text-center">
               <i class="fa-solid fa-chart-area text-4xl text-gray-300 mb-2"></i>
               <p class="text-gray-500 text-sm font-bold">暂无历史K线数据</p>
               <p class="text-gray-400 text-xs mb-3">可能因网络原因加载失败</p>
               <button (click)="refresh()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 transition-colors">
                  <i class="fa-solid fa-sync mr-1"></i> 重新加载
               </button>
            </div>
          </div>
        }
      </div>

      <!-- Analysis Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <!-- Fibonacci Module -->
        <div class="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100">
           <div class="flex justify-between items-center mb-4">
             <h3 class="font-bold text-slate-700 flex items-center gap-2 text-sm md:text-base">
                <i class="fa-solid fa-list-ol text-blue-500"></i> 关键点位 (黄金分割)
             </h3>
             <span class="text-[10px] md:text-xs px-2 py-1 rounded bg-gray-100 text-gray-500 font-medium">
                {{ data()?.trend === 'DOWN' ? '下降趋势 (压力/反弹)' : '上升/震荡 (支撑/回调)' }}
             </span>
           </div>
           
           <div class="space-y-3">
              @for (level of fibLevels(); track level.label) {
                  <div class="flex justify-between items-center p-2 rounded text-xs md:text-sm transition-colors"
                       [ngClass]="level.bgClass || 'bg-gray-50'"
                       [class.border-l-4]="level.borderClass"
                       [ngClass]="level.borderClass || 'border-transparent'">
                     <span class="font-medium" [ngClass]="level.textClass || 'text-gray-500'">
                       @if(level.isExtension) { <i class="fa-solid fa-bolt mr-1 text-[10px]"></i> }
                       {{ level.label }}
                     </span>
                     <span class="font-mono font-bold" [ngClass]="level.textClass || 'text-slate-700'">{{ level.val | number:'1.3-3' }}</span>
                  </div>
              }
           </div>
           
           <div class="mt-4 text-[10px] md:text-xs text-gray-400 leading-relaxed border-t border-gray-100 pt-3">
               <i class="fa-solid fa-info-circle mr-1"></i> 基于近{{ selectedRange() }}个交易日高低点。上升趋势关注回撤支撑 (38.2%/61.8%)，下降趋势关注反弹压力 (-38.2%/-61.8%)。带⚡标记为趋势拓展目标位。
           </div>
        </div>

        <!-- Analysis Summary (Beginner Friendly) -->
        <div class="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <div class="flex items-center gap-2 mb-3">
               <h3 class="font-bold text-slate-700 text-sm md:text-base">
                 <i class="fa-solid fa-graduation-cap text-emerald-500"></i> 新手操作指南
               </h3>
               <span class="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[10px] font-medium border border-emerald-100">AI 智能解读</span>
            </div>

            <!-- One Sentence Summary -->
            <div class="p-3 bg-blue-50 border border-blue-100 rounded-lg mb-4">
               <p class="text-xs md:text-sm text-blue-800 leading-relaxed font-medium">
                 <i class="fa-solid fa-lightbulb text-blue-500 mr-1"></i> {{ getBeginnerSummary() }}
               </p>
            </div>

            <div class="grid grid-cols-2 gap-3 mb-4">
              <!-- Technical Score with Progress Bar -->
              <div class="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div class="flex justify-between items-end mb-1">
                   <p class="text-[10px] md:text-xs text-gray-500">技术评分 (0-100)</p>
                   <p class="text-lg font-bold" [ngClass]="{'text-red-500': (data()?.score || 0) >= 70, 'text-green-500': (data()?.score || 0) <= 30, 'text-blue-500': (data()?.score || 0) > 30 && (data()?.score || 0) < 70}">
                     {{ data()?.score }}
                   </p>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-1.5 mb-1">
                  <div class="h-1.5 rounded-full" 
                       [style.width.%]="data()?.score"
                       [ngClass]="{'bg-red-500': (data()?.score || 0) >= 70, 'bg-green-500': (data()?.score || 0) <= 30, 'bg-blue-500': (data()?.score || 0) > 30 && (data()?.score || 0) < 70}">
                  </div>
                </div>
                <p class="text-[9px] text-gray-400 text-right">
                   {{ (data()?.score || 0) >= 70 ? '超买区 (风险高)' : ((data()?.score || 0) <= 30 ? '超卖区 (机会大)' : '震荡区 (中性)') }}
                </p>
              </div>

              <!-- Risk/Reward Ratio -->
              <div class="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <p class="text-[10px] md:text-xs text-gray-500 mb-1">当前盈亏比估算</p>
                <p class="text-sm font-bold text-slate-700 truncate" [title]="getRiskRewardRatio().text">
                   {{ getRiskRewardRatio().ratio ? (getRiskRewardRatio().ratio | number:'1.1-1') : '-' }} 
                   <span class="text-[10px] font-normal text-gray-500 ml-1">{{ getRiskRewardRatio().text.split(' ')[0] }}</span>
                </p>
                <p class="text-[9px] text-gray-400 mt-1.5 truncate">
                   上望: {{ getRiskRewardRatio().resistance | number:'1.3-3' }} | 下看: {{ getRiskRewardRatio().support | number:'1.3-3' }}
                </p>
              </div>
            </div>
            
            <!-- Actionable Advice List -->
            <div class="space-y-2.5 bg-slate-50 p-3 rounded-lg border border-slate-100">
              <div class="flex justify-between items-start text-xs md:text-sm gap-4">
                <span class="text-gray-500 whitespace-nowrap"><i class="fa-solid fa-scale-balanced w-4 text-center"></i> 仓位建议</span>
                <span class="font-medium text-slate-700 text-right leading-snug">
                  {{ getPositionAdvice() }}
                </span>
              </div>
              <div class="h-px bg-slate-200 w-full"></div>
              <div class="flex justify-between items-center text-xs md:text-sm">
                <span class="text-gray-500"><i class="fa-solid fa-arrow-trend-up w-4 text-center"></i> 趋势状态</span>
                <span class="font-bold px-2 py-0.5 rounded text-[10px] md:text-xs" 
                  [class.bg-red-100]="data()?.trend === 'UP'" [class.text-red-700]="data()?.trend === 'UP'"
                  [class.bg-green-100]="data()?.trend === 'DOWN'" [class.text-green-700]="data()?.trend === 'DOWN'"
                  [class.bg-gray-200]="data()?.trend === 'SIDEWAYS'" [class.text-gray-700]="data()?.trend === 'SIDEWAYS'">
                  {{ data()?.trend === 'UP' ? '上涨趋势 (多头)' : (data()?.trend === 'DOWN' ? '下跌趋势 (空头)' : '震荡整理 (无方向)') }}
                </span>
              </div>
              <div class="h-px bg-slate-200 w-full"></div>
              <div class="flex justify-between items-center text-xs md:text-sm">
                <span class="text-gray-500"><i class="fa-solid fa-bolt w-4 text-center"></i> 黄金坑信号</span>
                <span class="font-bold" [class.text-yellow-600]="data()?.isGolden" [class.text-gray-400]="!data()?.isGolden">
                  {{ data()?.isGolden ? '✅ 已触发 (关注低吸机会)' : '未触发' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Volatility & Signals -->
      <div class="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100">
         <h4 class="text-xs md:text-sm font-bold text-gray-500 uppercase mb-4 flex items-center gap-2">
            <i class="fa-solid fa-chart-bar text-purple-500"></i> 近30日日内振幅 (Intraday Amplitude)
         </h4>
         <div class="h-48 md:h-64 flex items-end justify-between gap-1 overflow-x-auto pb-10 pt-8 relative px-2">
            @for (point of recentHistory(); track point.date) {
               <div class="flex-1 min-w-[16px] md:min-w-[24px] flex flex-col justify-end items-center group relative h-full">
                   <div class="mb-2 transform -rotate-45 text-[9px] md:text-xs font-bold text-slate-500 whitespace-nowrap origin-bottom-left" style="margin-left: 8px;">
                      {{ ((point.high - point.low) / point.low * 100) | number:'1.2-2' }}%
                   </div>
                   <div class="w-full max-w-[20px] rounded-t-sm transition-all relative hover:opacity-80 border-t border-x border-black/5"
                        [style.height.%]="getVolatilityPercent(point)"
                        [class.bg-red-400]="point.close > point.open"
                        [class.bg-green-400]="point.close <= point.open">
                   </div>
                   <div class="absolute -bottom-8 text-[9px] md:text-[10px] text-gray-400 transform -rotate-45 whitespace-nowrap origin-top-left ml-2">
                      {{ point.date | slice:5:7 }}/{{ point.date | slice:8:10 }}
                   </div>
               </div>
            }
         </div>
      </div>
      
      <!-- Detailed Signal Factors -->
      <div class="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 class="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm md:text-base">
          <i class="fa-solid fa-list-check text-blue-500"></i> 信号因子详情
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div class="p-4 md:p-5 rounded-xl bg-red-50 border border-red-100">
             <h4 class="font-bold text-red-800 mb-4 flex items-center gap-2 text-sm md:text-base">
               <i class="fa-solid fa-circle-arrow-up"></i> 买入信号 ({{ data()?.buySignals }})
             </h4>
             @if (data()?.buyFactors?.length) {
               <ul class="space-y-3">
                 @for (factor of data()?.buyFactors; track factor) {
                   <li class="flex items-start gap-2 text-xs md:text-sm text-slate-700">
                     <i class="fa-solid fa-check-circle text-red-500 mt-0.5"></i> <span>{{ factor }}</span>
                   </li>
                 }
               </ul>
             }
          </div>
          <div class="p-4 md:p-5 rounded-xl bg-green-50 border border-green-100">
             <h4 class="font-bold text-green-800 mb-4 flex items-center gap-2 text-sm md:text-base">
               <i class="fa-solid fa-circle-arrow-down"></i> 卖出信号 ({{ data()?.sellSignals }})
             </h4>
             @if (data()?.sellFactors?.length) {
               <ul class="space-y-3">
                 @for (factor of data()?.sellFactors; track factor) {
                   <li class="flex items-start gap-2 text-xs md:text-sm text-slate-700">
                     <i class="fa-solid fa-circle-exclamation text-green-500 mt-0.5"></i> <span>{{ factor }}</span>
                   </li>
                 }
               </ul>
             }
          </div>
        </div>
      </div>

      <!-- News Analysis Module -->
      <div class="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100">
        <div class="flex justify-between items-center mb-4">
          <h3 class="font-bold text-slate-700 flex items-center gap-2 text-sm md:text-base">
            <i class="fa-solid fa-newspaper text-indigo-500"></i> AI 资讯与情绪分析
          </h3>
          <button (click)="loadNewsAnalysis()" [disabled]="isAnalyzingNews()" class="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1 font-medium">
            <i class="fa-solid fa-robot" [class.fa-spin]="isAnalyzingNews()"></i> 
            {{ isAnalyzingNews() ? '分析中...' : '重新分析' }}
          </button>
        </div>
        
        <div class="bg-slate-50 rounded-xl p-4 md:p-5 border border-slate-100 min-h-[150px] relative">
          @if (isAnalyzingNews()) {
            <div class="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10 rounded-xl">
               <i class="fa-solid fa-circle-notch fa-spin text-3xl text-indigo-500 mb-3"></i>
               <p class="text-sm text-slate-500 font-medium">AI 正在全网检索并分析最新资讯...</p>
               <p class="text-xs text-slate-400 mt-1">这可能需要 10-20 秒，请耐心等待</p>
            </div>
          }
          
          @if (newsAnalysisError()) {
            <div class="text-center py-8">
              <i class="fa-solid fa-triangle-exclamation text-3xl text-red-400 mb-2"></i>
              <p class="text-red-500 text-sm font-medium">分析失败</p>
              <p class="text-xs text-slate-500 mt-1">{{ newsAnalysisError() }}</p>
            </div>
          } @else if (newsAnalysis()) {
            <div class="">
              <div [innerHTML]="formatMarkdown(newsAnalysis()!.markdown)"></div>
            </div>
          } @else if (!isAnalyzingNews()) {
            <div class="text-center py-8 text-slate-400">
              <i class="fa-solid fa-robot text-4xl mb-3 opacity-50"></i>
              <p class="text-sm">点击右上角按钮，获取 AI 深度资讯分析</p>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
  `]
})
export class DetailComponent implements OnInit {
  private route: ActivatedRoute = inject(ActivatedRoute);
  private etfService = inject(EtfService);
  private router = inject(Router);

  // ViewChilds
  chartContainer = viewChild<ElementRef>('chartContainer');

  code = signal<string>('');
  data = signal<ETFAnalysis | null>(null);

  // Moving Average Visibility Signals
  showMA5 = signal(true);
  showMA20 = signal(false);
  showMA60 = signal(false);
  
  // Overlay Visibility Signals
  showTrendChannel = signal(true);
  showFib = signal(true);
  // Grid, VolPrice, Chan removed
  showSupRes = signal(false); 
  showVolume123 = signal(false);
  showResonance = signal(false); 
  showMASlope = signal(false);
  showStrategyMarkers = signal(false);
  showDonchian = signal(false);

  showDrawingsMenu = signal(false);
  
  ranges = [30, 60, 90, 120];
  selectedRange = signal<number>(60); 

  resizeObserver: ResizeObserver | null = null;

  // News Analysis Signals
  isAnalyzingNews = signal(false);
  newsAnalysis = signal<NewsAnalysisResult | null>(null);
  newsAnalysisError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const d = this.data();
      const container = this.chartContainer();

      // Trigger re-render on any signal change
      this.showMA5(); this.showMA20(); this.showMA60();
      this.showFib(); this.showTrendChannel(); this.showSupRes(); this.showVolume123();
      this.showResonance(); this.showMASlope();
      this.showStrategyMarkers();
      this.selectedRange();

      if (d && container) {
        setTimeout(() => this.renderChart(d, container), 0);
      }
    });

    // Resize Observer for Main Chart to handle mobile rotation
    effect(() => {
       const container = this.chartContainer();
       if (container) {
           if (this.resizeObserver) this.resizeObserver.disconnect();
           this.resizeObserver = new ResizeObserver(() => {
               const d = this.data();
               if(d) this.renderChart(d, container);
           });
           this.resizeObserver.observe(container.nativeElement);
       }
    });
  }

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const c = params.get('code');
      if (c) {
        this.code.set(c);
        this.loadData(c);
        this.checkAlphaVantage(c);
      }
    });
  }

  alphaVantageData = signal<{price: number, changePercent: number, latestTradingDay: string} | null>(null);
  finnhubData = signal<{c: number, d: number, dp: number, h: number, l: number, o: number, pc: number, t: number} | null>(null);

  checkAlphaVantage(code: string) {
      this.etfService.getAlphaVantageQuote(code).subscribe(data => {
          if (data) {
              this.alphaVantageData.set(data);
          }
      });
      
      this.etfService.getFinnhubQuote(code).subscribe(data => {
          if (data) {
              this.finnhubData.set(data);
          }
      });
  }

  ngOnDestroy() {
      if (this.resizeObserver) this.resizeObserver.disconnect();
  }

  loadData(code: string) {
    this.data.set(null);
    this.etfService.getEtfDetails(code).subscribe(res => {
      this.data.set(res);
      if (res) {
        this.loadNewsAnalysis();
      }
    });
  }

  async loadNewsAnalysis() {
    const etf = this.data();
    if (!etf) return;

    this.isAnalyzingNews.set(true);
    this.newsAnalysisError.set(null);

    try {
      const result = await this.etfService.analyzeNews(etf);
      this.newsAnalysis.set(result);
    } catch (error: any) {
      this.newsAnalysisError.set(error.message || '获取新闻分析失败，请稍后重试');
    } finally {
      this.isAnalyzingNews.set(false);
    }
  }

  formatMarkdown(text: string): string {
    if (!text) return '';
    
    // Basic Markdown to HTML conversion with Tailwind classes
    let html = text
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold text-slate-800 mt-6 mb-3">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-slate-800 mt-8 mb-4 border-b border-slate-200 pb-2">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold text-slate-800 mt-8 mb-4">$1</h1>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong class="font-bold text-slate-800">$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em class="italic text-slate-700">$1</em>')
      .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" target="_blank" class="text-indigo-600 hover:text-indigo-800 underline">$1</a>')
      .replace(/^\- (.*$)/gim, '<li class="ml-6 list-disc text-slate-600 mb-1">$1</li>')
      .replace(/\n/gim, '<br>')
      .replace(/<br><br>/gim, '<br>');
      
    // Wrap loose text in p tags (simplified)
    html = '<div class="text-sm md:text-base text-slate-600 leading-relaxed space-y-2">' + html + '</div>';
    
    return html;
  }
  
  refresh() {
     if (this.code()) {
        this.loadData(this.code());
     }
  }
  
  setRange(r: number) { this.selectedRange.set(r); }

  toggleMA(type: 'ma5' | 'ma20' | 'ma60') {
    if (type === 'ma5') this.showMA5.update(v => !v);
    if (type === 'ma20') this.showMA20.update(v => !v);
    if (type === 'ma60') this.showMA60.update(v => !v);
  }

  toggleDrawingsMenu() { this.showDrawingsMenu.update(v => !v); }
  toggleTrendChannel() { this.showTrendChannel.update(v => !v); }
  toggleFib() { this.showFib.update(v => !v); }
  toggleSupRes() { this.showSupRes.update(v => !v); }
  toggleVolume123() { this.showVolume123.update(v => !v); }
  toggleResonance() { this.showResonance.update(v => !v); }
  toggleMASlope() { this.showMASlope.update(v => !v); }
  toggleStrategyMarkers() { this.showStrategyMarkers.update(v => !v); }
  toggleDonchian() { this.showDonchian.update(v => !v); }

  // --- Helpers for Template ---

  avgVolatility30d = computed(() => {
    const hist = this.data()?.history || [];
    if (hist.length < 30) return 0;
    const recent = hist.slice(-30);
    const sum = recent.reduce((acc, curr) => acc + (curr.high - curr.low) / curr.low, 0);
    return (sum / recent.length) * 100;
  });

  recentHistory = computed(() => {
    return this.data()?.history.slice(-30) || [];
  });

  fibLevels = computed<FibLevel[]>(() => {
    const d = this.data();
    if (!d || !d.history.length) return [];
    
    const range = this.selectedRange();
    const hist = d.history.slice(-range);
    const high = Math.max(...hist.map(k => k.high));
    const low = Math.min(...hist.map(k => k.low));
    const diff = high - low;
    
    const levels: FibLevel[] = [];
    
    if (d.trend === 'DOWN') {
        levels.push({ val: low, label: '0% (低点)', color: '#22c55e', dash: 'solid', isBase: true });
        levels.push({ val: high, label: '100% (高点)', color: '#ef4444', dash: 'solid' });
        levels.push({ val: low + diff * 0.382, label: '38.2% 压力', color: '#f97316', dash: '5,3' });
        levels.push({ val: low + diff * 0.5, label: '50.0% 中枢', color: '#94a3b8', dash: '3,3' });
        levels.push({ val: low + diff * 0.618, label: '61.8% 强压', color: '#ef4444', dash: '5,3' });
        levels.push({ val: low - diff * 0.382, label: '138.2% 拓展', color: '#22c55e', dash: '2,2', isExtension: true });
    } else {
        levels.push({ val: high, label: '0% (高点)', color: '#ef4444', dash: 'solid', isBase: true });
        levels.push({ val: low, label: '100% (低点)', color: '#22c55e', dash: 'solid' });
        levels.push({ val: high - diff * 0.382, label: '38.2% 支撑', color: '#f97316', dash: '5,3' });
        levels.push({ val: high - diff * 0.5, label: '50.0% 中枢', color: '#94a3b8', dash: '3,3' });
        levels.push({ val: high - diff * 0.618, label: '61.8% 强撑', color: '#22c55e', dash: '5,3' });
        levels.push({ val: high + diff * 0.382, label: '138.2% 拓展', color: '#ef4444', dash: '2,2', isExtension: true });
    }
    
    return levels;
  });

  getVolatilityPercent(point: KlinePoint): number {
      const hist = this.recentHistory();
      if (!hist.length) return 0;
      const maxAmp = Math.max(...hist.map(p => (p.high - p.low)/p.low));
      const currentAmp = (point.high - point.low) / point.low;
      return maxAmp > 0 ? (currentAmp / maxAmp) * 100 : 0;
  }

  getBeginnerSummary(): string {
    const d = this.data();
    if (!d) return '数据加载中...';
    
    if (d.score >= 80) return '当前技术面极度强势，市场情绪高涨。初学者请注意：此时追高风险较大，若持有可继续观望，若未上车建议等待回调。';
    if (d.score <= 20) return '当前技术面极度弱势，处于超卖区域。初学者请注意：此时不宜盲目割肉，激进者可关注止跌企稳信号，稳健者继续空仓等待。';
    
    if (d.trend === 'UP' && d.isGolden) return '上升趋势中的回调企稳，这是经典的“千金难买牛回头”形态，盈亏比较高，适合逢低布局。';
    if (d.trend === 'DOWN' && d.isGolden) return '下跌趋势中的超跌反弹信号。初学者请注意：抢反弹如同“火中取栗”，需严格设置止损，快进快出。';
    if (d.trend === 'UP') return '当前处于明显的上升趋势，顺势而为是最佳策略。建议依托均线（如MA20）持有，不破不卖。';
    if (d.trend === 'DOWN') return '当前处于明显的下跌趋势，市场处于“空头排列”。初学者建议多看少动，耐心等待趋势反转。';
    
    return '当前处于横盘震荡期，方向不明。建议采用“网格交易”或“高抛低吸”策略，控制好总体仓位。';
  }

  getPositionAdvice(): string {
    const d = this.data();
    if (!d) return '-';
    const vol = this.avgVolatility30d();
    
    let advice = '';
    if (d.trend === 'UP') {
      advice = '可保持中高仓位 (50%-70%)';
    } else if (d.trend === 'DOWN') {
      advice = '建议空仓或极低仓位 (<10%)';
    } else {
      advice = '建议半仓应对 (30%-50%)';
    }

    if (vol > 2.5) {
      advice += '。近期波动剧烈，请缩小单次买入金额，拉开加仓间距。';
    } else {
      advice += '。近期走势平稳，可按计划稳步建仓。';
    }
    return advice;
  }

  getRiskRewardRatio(): { ratio: number | null, text: string, support: number, resistance: number } {
    const d = this.data();
    const fibs = this.fibLevels();
    if (!d || !fibs.length) return { ratio: null, text: '计算中...', support: 0, resistance: 0 };

    const currentPrice = d.currentPrice;
    // Find nearest support (highest fib level < currentPrice)
    const supports = fibs.filter(f => f.val < currentPrice).sort((a, b) => b.val - a.val);
    // Find nearest resistance (lowest fib level > currentPrice)
    const resistances = fibs.filter(f => f.val > currentPrice).sort((a, b) => a.val - b.val);

    if (!supports.length || !resistances.length) return { ratio: null, text: '处于极值区域，无法计算', support: 0, resistance: 0 };

    const support = supports[0].val;
    const resistance = resistances[0].val;

    const downsideRisk = currentPrice - support;
    const upsideReward = resistance - currentPrice;

    if (downsideRisk <= 0) return { ratio: null, text: '支撑位极近，风险极低', support, resistance };

    const ratio = upsideReward / downsideRisk;
    
    let text = '';
    if (ratio >= 2) text = '极佳 (向上空间远大于向下风险)';
    else if (ratio >= 1.2) text = '良好 (向上空间大于向下风险)';
    else if (ratio >= 0.8) text = '中性 (风险收益对等)';
    else text = '较差 (向下风险大于向上空间)';

    return { ratio, text, support, resistance };
  }

  getProfessionalAdvice() {
    const d = this.data();
    const fibs = this.fibLevels();
    const vol = this.avgVolatility30d();
    const aiAnalysis = this.newsAnalysis();
    
    if (!d || !fibs.length) return null;

    const currentPrice = d.currentPrice;
    const supports = fibs.filter(f => f.val < currentPrice).sort((a, b) => b.val - a.val);
    const resistances = fibs.filter(f => f.val > currentPrice).sort((a, b) => a.val - b.val);

    let support1 = supports.length > 0 ? supports[0].val : currentPrice * 0.95;
    let res1 = resistances.length > 0 ? resistances[0].val : currentPrice * 1.05;
    let res2 = resistances.length > 1 ? resistances[1].val : res1 * 1.05;

    // 投资评级 (Investment Rating)
    let rating = '中性配配 (Neutral)';
    let ratingColor = 'text-gray-600 bg-gray-100 border-gray-200';
    if (d.score >= 80 || d.suggestion?.includes('SELL')) {
      rating = '减持观望 (Underweight)';
      ratingColor = 'text-green-700 bg-green-50 border-green-200'; // Green for sell/down in CN
    } else if (d.score <= 30 || d.suggestion?.includes('BUY') || d.isGolden) {
      rating = '积极买入 (Strong Buy)';
      ratingColor = 'text-red-700 bg-red-50 border-red-200'; // Red for buy/up in CN
    } else if (d.trend === 'UP') {
      rating = '持有待涨 (Overweight)';
      ratingColor = 'text-red-600 bg-red-50 border-red-100';
    }

    // 风险等级 (Risk Level)
    let riskLevel = '中风险 (Medium)';
    let riskColor = 'text-yellow-600';
    if (vol > 3 || d.trend === 'DOWN') {
      riskLevel = '高风险 (High)';
      riskColor = 'text-green-600'; // Green for risk/down
    } else if (vol < 1.5 && d.trend === 'UP') {
      riskLevel = '低风险 (Low)';
      riskColor = 'text-red-600';
    }

    // 操作建议 (Operation Suggestion)
    let operation = this.translateSuggestion(d.suggestion);
    if (d.isGolden) operation += ' (逢低吸纳)';
    if (d.isHighVolume && d.trend === 'UP') operation += ' (顺势加仓)';
    if (d.isHighVolume && d.trend === 'DOWN') operation += ' (规避下杀)';

    // Override with AI Trading Plan if available
    if (aiAnalysis?.tradingPlan) {
        const tp = aiAnalysis.tradingPlan;
        rating = tp.rating || rating;
        riskLevel = tp.riskLevel || riskLevel;
        operation = tp.operation || operation;
        res1 = Number(tp.targetPrice) || res1;
        res2 = Number(tp.takeProfit) || res2;
        support1 = Number(tp.stopLoss) || support1;
        
        // Adjust colors based on AI rating
        if (rating.includes('买') || rating.includes('Buy') || rating.includes('Overweight')) {
            ratingColor = 'text-red-700 bg-red-50 border-red-200';
        } else if (rating.includes('卖') || rating.includes('Sell') || rating.includes('Underweight') || rating.includes('减持')) {
            ratingColor = 'text-green-700 bg-green-50 border-green-200';
        } else {
            ratingColor = 'text-gray-600 bg-gray-100 border-gray-200';
        }

        if (riskLevel.includes('高') || riskLevel.includes('High')) {
            riskColor = 'text-green-600';
        } else if (riskLevel.includes('低') || riskLevel.includes('Low')) {
            riskColor = 'text-red-600';
        } else {
            riskColor = 'text-yellow-600';
        }
    }

    return {
      rating,
      ratingColor,
      operation,
      targetPrice: res1,
      takeProfit: res2,
      stopLoss: support1,
      riskLevel,
      riskColor
    };
  }

  translateSuggestion(s: string | undefined): string {
    if (!s) return '';
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

  // --- Chart Rendering ---

  renderChart(data: ETFAnalysis, containerRef: ElementRef) {
    const element = containerRef.nativeElement;
    d3.select(element).selectAll('*').remove();

    if (!data.history || data.history.length === 0) return;

    const range = this.selectedRange();
    const history = data.history.slice(-range);
    
    // INCREASED TOP MARGIN to prevent clipping of strategy markers
    const margin = { top: 50, right: 50, bottom: 30, left: 10 };
    const width = element.clientWidth - margin.left - margin.right;
    const height = element.clientHeight - margin.top - margin.bottom;

    const mainH = height * 0.65;
    const volH = height * 0.15;
    const macdH = height * 0.15;
    const gap = height * 0.025;

    const svg = d3.select(element).append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
      .domain(history.map(d => d.date))
      .range([0, width])
      .padding(0.2);

    // Initial Y Domain from Data
    let yMin = d3.min(history, (d: any) => d.low)! * 0.98;
    let yMax = d3.max(history, (d: any) => d.high)! * 1.02;

    // Expand Domain for Fib Extensions
    if (this.showFib()) {
       const fibs = this.fibLevels();
       if (fibs.length > 0) {
           const minFib = Math.min(...fibs.map(f => f.val));
           const maxFib = Math.max(...fibs.map(f => f.val));
           yMin = Math.min(yMin, minFib * 0.99); // Expand down if needed
           yMax = Math.max(yMax, maxFib * 1.01); // Expand up if needed
       }
    }

    const y = d3.scaleLinear().domain([yMin, yMax]).range([mainH, 0]);

    const volMax = d3.max(history, (d: any) => d.volume)!;
    const yVol = d3.scaleLinear().domain([0, volMax]).range([mainH + volH + gap, mainH + gap]);

    const macdVals = history.flatMap(d => [d.macd?.diff || 0, d.macd?.dea || 0, d.macd?.macd || 0]);
    const macdLimit = Math.max(Math.abs(d3.min(macdVals) || 0), Math.abs(d3.max(macdVals) || 0));
    const macdTop = mainH + volH + 2 * gap;
    const yMacd = d3.scaleLinear().domain([-macdLimit, macdLimit]).range([height, macdTop]);

    // Axis
    const xAxis = d3.axisBottom(x)
       .tickValues(x.domain().filter((d: any, i: number) => i % Math.floor(history.length / 5) === 0))
       .tickFormat((d: any) => d.slice(5)); 
    
    svg.append('g').attr('transform', `translate(0,${height})`).call(xAxis).attr('class', 'text-gray-400 text-[10px]');
    svg.append('g').attr('transform', `translate(${width},0)`).call(d3.axisRight(y).ticks(5)).attr('class', 'text-gray-400 text-[10px]');

    // Layers
    if (this.showTrendChannel()) drawTrendChannel(svg, history, x, y, width);
    
    if (this.showFib()) {
       const fibs = this.fibLevels(); // Recalculate based on current computed
       drawFibonacci(svg, fibs, width, y, 0, mainH); // Pass mainH instead of height for correct scaling
    }

    drawBaseLayer(svg, history, x, y, width, {
        showMA5: this.showMA5(),
        showMA20: this.showMA20(),
        showMA60: this.showMA60()
    });

    if (this.showSupRes()) drawSupRes(svg, history, x, y, width, svg);
    if (this.showVolume123()) drawVolumeProfile(svg, history, x, y, width);
    if (this.showResonance() && data.boxSignal) drawResonanceSignal(svg, data.boxSignal, x, y, width);
    if (this.showMASlope()) drawMASlope(svg, history, x, y);
    if (this.showStrategyMarkers()) drawStrategyMarkers(svg, history, x, y, width);
    if (this.showDonchian()) drawDonchianChannel(svg, history, x, y, width);

    const volGroup = svg.append('g');
    const macdGroup = svg.append('g');
    drawSubCharts(volGroup, macdGroup, history, x, yVol, yMacd, mainH + volH + gap, height - macdTop, width, macdTop);

    // Crosshair
    const tooltip = d3.select(element).append('div')
         .attr('class', 'chart-tooltip')
         .style('display', 'none')
         .style('pointer-events', 'none')
         .style('position', 'absolute')
         .style('z-index', '20')
         .style('background', 'rgba(255,255,255,0.95)')
         .style('padding', '8px')
         .style('border', '1px solid #e2e8f0')
         .style('border-radius', '4px')
         .style('box-shadow', '0 4px 6px -1px rgba(0, 0, 0, 0.1)')
         .style('font-size', '10px');

    const crosshairX = svg.append('line').attr('stroke', '#94a3b8').attr('stroke-width', 1).attr('stroke-dasharray', '3,3').style('display', 'none').style('pointer-events', 'none');
    const crosshairY = svg.append('line').attr('stroke', '#94a3b8').attr('stroke-width', 1).attr('stroke-dasharray', '3,3').style('display', 'none').style('pointer-events', 'none');

    svg.append('rect')
       .attr('width', width).attr('height', height)
       .attr('fill', 'transparent')
       .style('cursor', 'crosshair')
       .on('mousemove', (event: any) => {
           const [mx, my] = d3.pointer(event);
           const step = x.step();
           const index = Math.floor(mx / step);
           if (index >= 0 && index < history.length) {
               const d = history[index];
               const xPos = x(d.date)! + x.bandwidth()/2;
               
               crosshairX.attr('x1', xPos).attr('x2', xPos).attr('y1', 0).attr('y2', height).style('display', null);
               crosshairY.attr('x1', 0).attr('x2', width).attr('y1', my).attr('y2', my).style('display', null);

               let html = `<div class="font-bold mb-1">${d.date}</div>`;
               html += `<div class="flex justify-between gap-4"><span>收盘:</span><span>${d.close.toFixed(3)}</span></div>`;
               html += `<div class="flex justify-between gap-4"><span>涨跌:</span><span class="${d.close>d.open?'text-red-500':'text-green-500'}">${((d.close-d.open)/d.open*100).toFixed(2)}%</span></div>`;
               html += `<div class="flex justify-between gap-4"><span>成交:</span><span>${(d.volume/10000).toFixed(0)}万</span></div>`;
               
               const box = element.getBoundingClientRect();
               let left = mx + 20;
               let top = my + 20;
               if (left + 150 > width) left = mx - 140;
               
               tooltip.html(html)
                 .style('display', 'block')
                 .style('left', `${left}px`)
                 .style('top', `${top}px`);
           } else {
               crosshairX.style('display', 'none');
               crosshairY.style('display', 'none');
               tooltip.style('display', 'none');
           }
       })
       .on('mouseleave', () => {
           crosshairX.style('display', 'none');
           crosshairY.style('display', 'none');
           tooltip.style('display', 'none');
       });
  }
}
