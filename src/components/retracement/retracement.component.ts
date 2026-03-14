
import { Component, ElementRef, ViewChild, inject, signal, effect, computed, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EtfService } from '../../services/etf.service';
import { KlinePoint } from '../../services/models';
import * as d3Raw from 'd3';
const d3 = d3Raw as any;

// ----------------------
// Interfaces & Types
// ----------------------

type TradeAction = '建' | '加1' | '加2' | '止盈1' | '止盈2' | '止损' | '清仓' | '观察';

interface TradeLog {
  date: string;
  action: TradeAction;
  price: number;
  shares: number;
  amount: number;
  reason: string;
  pnlRatio?: number; 
  pnlAmount?: number;
  totalPosPercent: number; 
}

interface ChannelPoint {
  date: string;
  middle: number;
  top: number;
  bottom: number;
  slope: number;
}

interface BacktestStats {
  finalBalance: number;
  totalReturn: number;
  maxDrawdown: number;
  winRate: number;
  tradeCount: number;
  avgHoldDays: number;
  equityCurve: { date: string, value: number }[];
  marketTypeStats: {
     bull: { wins: number, total: number };
     bear: { wins: number, total: number };
     sideways: { wins: number, total: number };
  };
}

interface StrategyConfig {
  // 1. Time & Target
  etfCode: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  commission: number; 

  // 2. Parallel Trend
  trendShortN: number; 
  trendLongM: number; 
  trendSlopeThreshold: number; 
  
  // 3. Golden Fib
  fibCallback1: number; 
  fibCallback2: number; 
  fibExtension: number; 
  
  // 4. Volume
  volBreakoutRatio: number; 
  volShrinkRatio: number; 
  
  // 5. Position
  posMode: 'PERCENT' | 'FIXED';
  posInitial: number; 
  posAdd1: number; 
  posAdd2: number; 
  posMax: number; 
  
  // 6. Stop/Profit
  stopLossPct: number; 
  takeProfitPct: number; 
}

@Component({
  selector: 'app-retracement',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex flex-col lg:flex-row h-[calc(100vh-80px)] gap-4 animate-[fadeIn_0.3s_ease-out] overflow-hidden">
      
      <!-- Left Panel: Configuration -->
      <div class="w-full lg:w-80 flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-5 shadow-sm z-10">
        <h2 class="text-lg font-bold text-slate-800 flex items-center justify-between sticky top-0 bg-white py-2 z-10 border-b border-gray-100">
          <span class="flex items-center gap-2"><i class="fa-solid fa-sliders text-indigo-600"></i> 策略配置</span>
          <button (click)="showRulesModal.set(true)" class="text-xs font-normal text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1">
             <i class="fa-regular fa-circle-question"></i> 规则说明
          </button>
        </h2>

        <!-- Group 1: Basic -->
        <div class="space-y-3">
           <div class="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex justify-between">
              <span>基础设置</span>
              <span class="text-indigo-500 cursor-pointer" (click)="resetConfig()">重置</span>
           </div>
           <div>
              <label class="text-xs text-gray-500 block mb-1">ETF 代码</label>
              <div class="relative">
                 <input [(ngModel)]="config.etfCode" type="text" class="w-full pl-8 pr-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono font-bold text-slate-700">
                 <i class="fa-solid fa-search absolute left-2.5 top-2.5 text-gray-400 text-xs"></i>
              </div>
           </div>
           <div class="grid grid-cols-2 gap-2">
              <div>
                 <label class="text-xs text-gray-500 block mb-1">初始资金</label>
                 <input [(ngModel)]="config.initialCapital" type="number" class="w-full px-2 py-1.5 border border-gray-200 rounded text-xs">
              </div>
              <div>
                 <label class="text-xs text-gray-500 block mb-1">佣金费率</label>
                 <input [(ngModel)]="config.commission" type="number" step="0.0001" class="w-full px-2 py-1.5 border border-gray-200 rounded text-xs">
              </div>
           </div>
           <div class="grid grid-cols-2 gap-2">
              <div>
                 <label class="text-xs text-gray-500 block mb-1">开始日期</label>
                 <input [(ngModel)]="config.startDate" type="date" class="w-full px-2 py-1.5 border border-gray-200 rounded text-xs">
              </div>
              <div>
                 <label class="text-xs text-gray-500 block mb-1">结束日期</label>
                 <input [(ngModel)]="config.endDate" type="date" class="w-full px-2 py-1.5 border border-gray-200 rounded text-xs">
              </div>
           </div>
        </div>

        <hr class="border-gray-100">

        <!-- Group 2: Trend & Fib -->
        <div class="space-y-3">
           <div class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">趋势与波段 (Golden Fib)</div>
           <div class="flex justify-between items-center">
              <label class="text-xs text-gray-600">趋势周期 (短/长)</label>
              <div class="flex gap-1 w-24">
                 <input [(ngModel)]="config.trendShortN" type="number" class="w-full px-1 py-1 border border-gray-200 rounded text-xs text-center" placeholder="10">
                 <input [(ngModel)]="config.trendLongM" type="number" class="w-full px-1 py-1 border border-gray-200 rounded text-xs text-center" placeholder="20">
              </div>
           </div>
           <div class="flex justify-between items-center">
              <label class="text-xs text-gray-600">首加回调 (Add1)</label>
              <div class="relative w-16">
                 <input [(ngModel)]="config.fibCallback1" type="number" step="0.001" class="w-full px-1 py-1 border border-gray-200 rounded text-xs text-right pr-4">
                 <span class="absolute right-1 top-1 text-[10px] text-gray-400">%</span>
              </div>
           </div>
           <div class="flex justify-between items-center">
              <label class="text-xs text-gray-600">二加回调 (Add2)</label>
              <div class="relative w-16">
                 <input [(ngModel)]="config.fibCallback2" type="number" step="0.001" class="w-full px-1 py-1 border border-gray-200 rounded text-xs text-right pr-4">
                 <span class="absolute right-1 top-1 text-[10px] text-gray-400">%</span>
              </div>
           </div>
        </div>

        <hr class="border-gray-100">

        <!-- Group 3: Position Management -->
        <div class="space-y-3">
           <div class="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex justify-between items-center">
              <span>仓位管理</span>
              <div class="flex bg-gray-100 rounded p-0.5">
                 <button (click)="config.posMode='PERCENT'" [class.bg-white]="config.posMode==='PERCENT'" [class.shadow-sm]="config.posMode==='PERCENT'" class="px-2 py-0.5 text-[10px] rounded transition-all">比例</button>
                 <button (click)="config.posMode='FIXED'" [class.bg-white]="config.posMode==='FIXED'" [class.shadow-sm]="config.posMode==='FIXED'" class="px-2 py-0.5 text-[10px] rounded transition-all">金额</button>
              </div>
           </div>
           
           <div class="grid grid-cols-2 gap-2 text-center">
              <div>
                 <label class="text-[10px] text-gray-500 mb-1">底仓 {{config.posMode==='PERCENT'?'%':'元'}}</label>
                 <input [(ngModel)]="config.posInitial" type="number" class="w-full px-1 py-1 border border-gray-200 rounded text-xs text-center">
              </div>
              <div>
                 <label class="text-[10px] text-gray-500 mb-1">总仓上限 %</label>
                 <input [(ngModel)]="config.posMax" type="number" class="w-full px-1 py-1 border border-gray-200 rounded text-xs text-center">
              </div>
           </div>
           <div class="flex justify-between items-center">
              <label class="text-xs text-gray-600">加仓比例 (首/次)</label>
              <div class="flex gap-1 w-24">
                 <input [(ngModel)]="config.posAdd1" type="number" class="w-full px-1 py-1 border border-gray-200 rounded text-xs text-center" title="相对于底仓的倍数">
                 <input [(ngModel)]="config.posAdd2" type="number" class="w-full px-1 py-1 border border-gray-200 rounded text-xs text-center" title="相对于底仓的倍数">
              </div>
           </div>
        </div>

        <div class="mt-auto pt-4 pb-10 lg:pb-0">
           <button (click)="runBacktest()" [disabled]="isLoading()" 
                   class="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg shadow-md transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              @if (isLoading()) { 
                 <i class="fa-solid fa-circle-notch fa-spin"></i>
              } @else { 
                 <i class="fa-solid fa-play"></i> 执行回测 
              }
           </button>
           
           @if (errorMsg()) {
              <div class="mt-2 text-xs text-red-500 text-center bg-red-50 p-1 rounded">{{ errorMsg() }}</div>
           }
        </div>
      </div>

      <!-- Right Panel: Results -->
      <div class="flex-grow flex flex-col h-full overflow-hidden bg-gray-50 relative">
         @if (!result()) {
            <div class="flex flex-col items-center justify-center h-full text-gray-400">
               <i class="fa-solid fa-chess-board text-6xl mb-4 text-gray-200"></i>
               <p>配置参数并点击“执行回测”以开始</p>
            </div>
         } @else {
            <!-- 1. Stats Header -->
            <div class="bg-white border-b border-gray-200 p-4 shadow-sm z-10 flex-shrink-0 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
               <div>
                  <p class="text-[10px] text-gray-400 uppercase">期末总资产</p>
                  <p class="text-lg font-mono font-bold text-slate-800">{{ result()!.finalBalance | number:'1.0-0' }}</p>
               </div>
               <div>
                  <p class="text-[10px] text-gray-400 uppercase">总收益率</p>
                  <p class="text-lg font-mono font-bold" [class.text-red-500]="result()!.totalReturn > 0" [class.text-green-500]="result()!.totalReturn < 0">
                     {{ result()!.totalReturn > 0 ? '+' : ''}}{{ result()!.totalReturn | number:'1.2-2' }}%
                  </p>
               </div>
               <div>
                  <p class="text-[10px] text-gray-400 uppercase">最大回撤</p>
                  <p class="text-lg font-mono font-bold text-slate-700">{{ result()!.maxDrawdown | number:'1.2-2' }}%</p>
               </div>
               <div>
                  <p class="text-[10px] text-gray-400 uppercase">胜率 / 盈亏比</p>
                  <p class="text-lg font-mono font-bold text-red-600">{{ result()!.winRate | number:'1.1-1' }}% <span class="text-xs text-gray-400 font-normal">Win%</span></p>
               </div>
               <div>
                  <p class="text-[10px] text-gray-400 uppercase">交易次数</p>
                  <p class="text-lg font-bold text-slate-700">{{ result()!.tradeCount }}</p>
               </div>
               <div>
                  <p class="text-[10px] text-gray-400 uppercase">平均持仓</p>
                  <p class="text-lg font-bold text-slate-700">{{ result()!.avgHoldDays | number:'1.0-0' }}天</p>
               </div>
            </div>

            <!-- 2. Chart Area -->
            <div class="flex-grow relative bg-white overflow-hidden p-2 flex flex-col">
                <!-- Toolbar for Chart -->
                <div class="absolute top-4 left-4 z-10 flex gap-2">
                   <div class="bg-white/90 p-1.5 rounded border border-gray-200 shadow-sm text-[10px] flex gap-2 pointer-events-none">
                      <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-green-500"></span> 建/加</span>
                      <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-orange-500"></span> 止盈</span>
                      <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-blue-500"></span> 止损/清</span>
                   </div>
                   <div class="bg-white/90 p-1.5 rounded border border-gray-200 shadow-sm text-[10px] flex gap-2 pointer-events-none">
                      <span class="flex items-center gap-1"><span class="w-3 h-1 bg-red-200 border-b border-red-500"></span> 上升趋势</span>
                      <span class="flex items-center gap-1"><span class="w-3 h-1 bg-green-200 border-b border-green-500"></span> 下降趋势</span>
                   </div>
                </div>
                <div #chartContainer class="w-full h-full relative"></div>
            </div>

            <!-- 3. Trade Logs -->
            <div class="h-64 flex-shrink-0 bg-white border-t border-gray-200 flex flex-col">
               <div class="px-4 py-2 bg-gray-50 border-b border-gray-100 font-bold text-xs text-gray-500 flex justify-between items-center">
                  <span>交易明细 ({{ logs().length }})</span>
                  <!-- Simple Filter -->
                  <div class="flex gap-2">
                     <button class="px-2 py-0.5 bg-white border border-gray-200 rounded hover:bg-gray-100 text-[10px]">仅看盈利</button>
                     <button class="px-2 py-0.5 bg-white border border-gray-200 rounded hover:bg-gray-100 text-[10px]">仅看亏损</button>
                  </div>
               </div>
               <div class="overflow-y-auto flex-grow custom-scrollbar">
                  <table class="w-full text-left text-xs">
                     <thead class="bg-white sticky top-0 shadow-sm text-gray-400 z-10">
                        <tr>
                           <th class="p-2 pl-4">日期</th>
                           <th class="p-2">操作</th>
                           <th class="p-2 text-right">成交价</th>
                           <th class="p-2 text-right">数量</th>
                           <th class="p-2 text-right">盈亏金额</th>
                           <th class="p-2 text-right">盈亏比例</th>
                           <th class="p-2 w-48">策略条件</th>
                           <th class="p-2 text-right">累计仓位</th>
                        </tr>
                     </thead>
                     <tbody class="divide-y divide-gray-50">
                        @for (log of logs(); track $index) {
                           <tr class="hover:bg-gray-50 font-mono transition-colors">
                              <td class="p-2 pl-4 text-gray-500">{{ log.date }}</td>
                              <td class="p-2">
                                 <span class="px-1.5 py-0.5 rounded text-[10px] font-bold border"
                                    [class.bg-green-50]="log.action.includes('建') || log.action.includes('加')"
                                    [class.text-green-700]="log.action.includes('建') || log.action.includes('加')"
                                    [class.border-green-200]="log.action.includes('建') || log.action.includes('加')"
                                    [class.bg-orange-50]="log.action.includes('止盈')"
                                    [class.text-orange-700]="log.action.includes('止盈')"
                                    [class.border-orange-200]="log.action.includes('止盈')"
                                    [class.bg-blue-50]="log.action.includes('止损') || log.action.includes('清')"
                                    [class.text-blue-700]="log.action.includes('止损') || log.action.includes('清')"
                                    [class.border-blue-200]="log.action.includes('止损') || log.action.includes('清')">
                                    {{ log.action }}
                                 </span>
                              </td>
                              <td class="p-2 text-right">{{ log.price | number:'1.3-3' }}</td>
                              <td class="p-2 text-right">{{ log.shares }}</td>
                              <td class="p-2 text-right">
                                 @if (log.pnlAmount) {
                                    <span [class.text-red-500]="log.pnlAmount > 0" [class.text-green-500]="log.pnlAmount < 0">
                                       {{ log.pnlAmount > 0 ? '+' : ''}}{{ log.pnlAmount | number:'1.0-0' }}
                                    </span>
                                 } @else { <span class="text-gray-300">-</span> }
                              </td>
                              <td class="p-2 text-right">
                                 @if (log.pnlRatio) {
                                    <span [class.text-red-500]="log.pnlRatio > 0" [class.text-green-500]="log.pnlRatio < 0">
                                       {{ log.pnlRatio | number:'1.2-2' }}%
                                    </span>
                                 } @else { <span class="text-gray-300">-</span> }
                              </td>
                              <td class="p-2 text-gray-500 text-[10px] break-words" title="{{log.reason}}">{{ log.reason }}</td>
                              <td class="p-2 text-right font-bold text-slate-700">{{ (log.totalPosPercent * 100) | number:'1.0-0' }}%</td>
                           </tr>
                        }
                     </tbody>
                  </table>
               </div>
            </div>
         }
      </div>
    </div>

    <!-- Rules Modal -->
    @if (showRulesModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" (click)="showRulesModal.set(false)">
        <div class="bg-white w-full max-w-2xl max-h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-[fadeIn_0.2s_ease-out]" (click)="$event.stopPropagation()">
           <div class="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-slate-50 flex-shrink-0">
              <h3 class="text-lg font-bold text-slate-800 flex items-center gap-2"><i class="fa-solid fa-book-open text-indigo-600"></i> 策略交易规则 (Strategy Rules)</h3>
              <button (click)="showRulesModal.set(false)" class="text-gray-400 hover:text-slate-600 transition-colors bg-white rounded-full p-2 hover:bg-gray-200 w-8 h-8 flex items-center justify-center"><i class="fa-solid fa-times"></i></button>
           </div>
           <div class="p-6 overflow-y-auto custom-scrollbar text-sm leading-relaxed text-slate-600 space-y-5">
              <!-- Content describing R1-R6 rules -->
              <div class="p-4 bg-indigo-50 rounded-xl border border-indigo-100 flex gap-3">
                 <i class="fa-solid fa-lightbulb text-indigo-500 text-xl mt-1"></i>
                 <div>
                    <h4 class="font-bold text-indigo-800 mb-1">核心逻辑：趋势跟随 + 斐波那契波段</h4>
                    <p class="text-indigo-700 text-xs">本策略基于线性回归通道判断趋势方向，利用斐波那契回调位寻找最佳买点，并结合成交量进行量价确认。核心在于“顺大势，逆小势”。</p>
                 </div>
              </div>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div class="border border-gray-100 rounded-lg p-3 hover:shadow-sm transition-shadow">
                    <h4 class="font-bold text-slate-800 mb-2 flex items-center gap-2"><span class="bg-slate-800 text-white text-[10px] px-1.5 rounded">R1</span> 趋势识别 (Trend)</h4>
                    <p class="text-xs text-gray-500">计算过去 M 天 (长周期) 的线性回归通道。斜率 (Slope) > 0 定义为上升趋势，Slope < 0 为下降趋势。策略<strong class="text-red-500">仅在上升趋势中</strong>尝试开仓。</p>
                 </div>

                 <div class="border border-gray-100 rounded-lg p-3 hover:shadow-sm transition-shadow">
                    <h4 class="font-bold text-slate-800 mb-2 flex items-center gap-2"><span class="bg-red-600 text-white text-[10px] px-1.5 rounded">R2</span> 建仓信号 (Entry)</h4>
                    <ul class="list-disc list-inside space-y-1 text-xs text-gray-500">
                        <li><strong>突破买入</strong>: 收盘价创 N 天新高，且成交量放大 (VolRatio > 1.5)。</li>
                        <li><strong>回调买入</strong>: 上升趋势中，价格回调至斐波那契支撑位 (如 38.2%) 且未跌破，同时成交量萎缩 (缩量回调)。</li>
                    </ul>
                 </div>

                 <div class="border border-gray-100 rounded-lg p-3 hover:shadow-sm transition-shadow">
                    <h4 class="font-bold text-slate-800 mb-2 flex items-center gap-2"><span class="bg-blue-600 text-white text-[10px] px-1.5 rounded">R3</span> 仓位管理 (Position)</h4>
                    <p class="text-xs text-gray-500">采用金字塔式建仓。底仓由参数设定。当价格符合加仓条件 (顺势回调确认支撑) 时，按设定倍数 (如 0.5x, 0.3x) 加仓，严格控制总仓位上限。</p>
                 </div>

                 <div class="border border-gray-100 rounded-lg p-3 hover:shadow-sm transition-shadow">
                    <h4 class="font-bold text-slate-800 mb-2 flex items-center gap-2"><span class="bg-green-600 text-white text-[10px] px-1.5 rounded">R4</span> 止盈止损 (Exit)</h4>
                    <ul class="list-disc list-inside space-y-1 text-xs text-gray-500">
                        <li><strong>止盈</strong>: 触及斐波那契扩展位 (1.618倍) 或收益率达标 (30%)。</li>
                        <li><strong>止损</strong>: 跌破成本价 (5%) 或趋势通道破位 (斜率转负)。</li>
                    </ul>
                 </div>
              </div>
           </div>
           <div class="p-4 border-t border-gray-100 bg-gray-50 text-center">
              <button (click)="showRulesModal.set(false)" class="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors">我已了解</button>
           </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
  `]
})
export class RetracementComponent {
  private etfService = inject(EtfService);
  
  chartContainer = viewChild<ElementRef>('chartContainer');

  // --- State Signals ---
  isLoading = signal(false);
  errorMsg = signal<string | null>(null);
  showRulesModal = signal(false);
  
  config: StrategyConfig = {
    etfCode: '510300',
    startDate: '2020-01-01',
    endDate: new Date().toISOString().split('T')[0],
    initialCapital: 100000,
    commission: 0.0003,
    trendShortN: 10,
    trendLongM: 20,
    trendSlopeThreshold: 0.05, 
    fibCallback1: 0.328,
    fibCallback2: 0.618,
    fibExtension: 1.0,
    volBreakoutRatio: 1.5,
    volShrinkRatio: 0.6,
    posMode: 'PERCENT',
    posInitial: 30, 
    posAdd1: 0.3, 
    posAdd2: 0.7, 
    posMax: 80, 
    stopLossPct: 0.05,
    takeProfitPct: 0.30
  };

  // Results
  result = signal<BacktestStats | null>(null);
  logs = signal<TradeLog[]>([]);
  chartData = signal<{history: KlinePoint[], markers: any[], channels: ChannelPoint[]} | null>(null);

  constructor() {
    effect(() => {
        const d = this.chartData();
        const container = this.chartContainer();
        if (d && container) {
            setTimeout(() => this.renderChart(d, container), 0);
        }
    });
  }

  resetConfig() {
      this.config = {
        ...this.config,
        trendShortN: 10, trendLongM: 20,
        fibCallback1: 0.328, fibCallback2: 0.618,
        volBreakoutRatio: 1.5, volShrinkRatio: 0.6,
        posMode: 'PERCENT', posInitial: 30, posAdd1: 0.3, posAdd2: 0.7, posMax: 80
      };
  }

  runBacktest() {
    if (!this.config.etfCode) return;
    this.isLoading.set(true);
    this.errorMsg.set(null);
    this.result.set(null);

    this.etfService.getBacktestData(this.config.etfCode).subscribe({
       next: (data) => {
          if (!data || data.history.length < 100) {
             this.errorMsg.set('数据不足，无法执行长周期回测');
             this.isLoading.set(false);
             return;
          }
          setTimeout(() => {
             this.executeStrategy(data.history);
             this.isLoading.set(false);
          }, 100);
       },
       error: () => {
          this.errorMsg.set('数据获取失败');
          this.isLoading.set(false);
       }
    });
  }

  // --- Core Strategy Logic ---
  private executeStrategy(fullHistory: KlinePoint[]) {
     const history = fullHistory.filter(d => d.date >= this.config.startDate && d.date <= this.config.endDate);
     if (history.length < 50) {
         this.errorMsg.set('选定区间内数据不足');
         return;
     }

     let cash = this.config.initialCapital;
     let shares = 0;
     let entryPrice = 0; 
     const tradeLogs: TradeLog[] = [];
     const markers: any[] = [];
     const equityCurve: {date: string, value: number}[] = [];
     const channels: ChannelPoint[] = [];

     let waveHigh = -Infinity;
     let waveLow = Infinity;
     let holdingDays = 0;
     let lastAction: TradeAction | 'NONE' = 'NONE';
     let highestPriceSinceEntry = 0;

     // Calculate Indicators & Channels
     // We compute the LR channel for the trailing M days at each point
     const M = this.config.trendLongM;
     
     const getSlopeAndChannel = (idx: number, period: number): {slope: number, top: number, bottom: number, middle: number} => {
         if (idx < period - 1) return { slope: 0, top: history[idx].high, bottom: history[idx].low, middle: history[idx].close };
         
         // Linear Regression components
         let sumX=0, sumY=0, sumXY=0, sumXX=0;
         const startIndex = idx - period + 1;
         
         // X is 0 to period-1
         for(let i=0; i<period; i++) {
             const p = history[startIndex + i];
             const x = i;
             const y = p.close;
             sumX += x; 
             sumY += y; 
             sumXY += x*y; 
             sumXX += x*x;
         }
         
         const slope = (period * sumXY - sumX * sumY) / (period * sumXX - sumX * sumX);
         const intercept = (sumY - slope * sumX) / period;
         
         // Calculate Channel Bounds (Max deviation)
         let maxDevHigh = -Infinity;
         let minDevLow = Infinity;
         
         for(let i=0; i<period; i++) {
             const p = history[startIndex + i];
             const regY = slope * i + intercept;
             maxDevHigh = Math.max(maxDevHigh, p.high - regY);
             minDevLow = Math.min(minDevLow, p.low - regY);
         }
         
         // Current Day Values (x = period - 1)
         const currentX = period - 1;
         const currentMid = slope * currentX + intercept;
         
         return {
             slope: slope / history[idx].close, // Normalized slope
             middle: currentMid,
             top: currentMid + maxDevHigh,
             bottom: currentMid + minDevLow
         };
     };

     const buy = (idx: number, type: TradeAction, reason: string) => {
         const p = history[idx].close;
         let budget = 0;
         const totalAsset = cash + shares * p;
         
         if (type === '建') {
             if (this.config.posMode === 'FIXED') budget = this.config.posInitial;
             else budget = this.config.initialCapital * (this.config.posInitial / 100);
         } else if (type.includes('加')) {
             const initialBase = this.config.posMode === 'FIXED' ? this.config.posInitial : (this.config.initialCapital * this.config.posInitial/100);
             const multiplier = type === '加1' ? this.config.posAdd1 : this.config.posAdd2;
             budget = initialBase * multiplier;
         }

         const maxAsset = totalAsset * (this.config.posMax / 100);
         const currentPosVal = shares * p;
         if (currentPosVal >= maxAsset) return; 
         
         budget = Math.min(budget, cash);
         budget = Math.min(budget, maxAsset - currentPosVal);

         const tradeShares = Math.floor(budget / p / 100) * 100;
         if (tradeShares <= 0) return;

         const cost = tradeShares * p;
         const fee = cost * this.config.commission;
         
         if (cash < cost + fee) return;

         cash -= (cost + fee);
         entryPrice = (entryPrice * shares + cost) / (shares + tradeShares);
         shares += tradeShares;
         
         tradeLogs.push({
             date: history[idx].date, action: type, price: p, shares: tradeShares, amount: cost, reason,
             totalPosPercent: (shares*p)/(cash + shares*p)
         });
         markers.push({date: history[idx].date, type: 'BUY', label: type, price: p, reason: reason});
         lastAction = type;
         
         if (type === '建') {
             waveHigh = p; 
             waveLow = history.slice(Math.max(0, idx-30), idx).reduce((min, cur) => Math.min(min, cur.low), Infinity);
             highestPriceSinceEntry = p;
             holdingDays = 0;
         }
     };

     const sell = (idx: number, type: TradeAction, reason: string, ratio: number = 1.0) => {
         if (shares === 0) return;
         const p = history[idx].close;
         const tradeShares = Math.ceil(shares * ratio / 100) * 100; 
         const actualShares = Math.min(shares, Math.max(100, Math.floor(shares * ratio / 100) * 100));
         
         if (actualShares <= 0) return;

         const revenue = actualShares * p;
         const fee = revenue * this.config.commission;
         const cost = actualShares * entryPrice;
         const pnl = revenue - fee - cost;
         
         cash += (revenue - fee);
         shares -= actualShares;
         if (shares < 100) { 
             const dustRev = shares * p;
             cash += dustRev;
             shares = 0;
         }

         tradeLogs.push({
             date: history[idx].date, action: type, price: p, shares: actualShares, amount: revenue, reason,
             pnlAmount: pnl, pnlRatio: (p - entryPrice)/entryPrice * 100,
             totalPosPercent: (shares*p)/(cash + shares*p)
         });
         markers.push({date: history[idx].date, type: 'SELL', label: type, price: p, reason: reason});
         lastAction = type;
         
         if (shares === 0) {
             lastAction = 'NONE';
             waveHigh = -Infinity;
         }
     };

     // Loop
     for (let i = M; i < history.length; i++) {
         const today = history[i];
         
         // Update Wave Stats if Holding
         if (shares > 0) {
             highestPriceSinceEntry = Math.max(highestPriceSinceEntry, today.high);
             if (today.high > waveHigh) {
                 waveHigh = today.high;
             }
             holdingDays++;
         }

         const channelInfo = getSlopeAndChannel(i, this.config.trendLongM);
         channels.push({
             date: today.date,
             ...channelInfo
         });

         const slopeShort = getSlopeAndChannel(i, this.config.trendShortN).slope;
         const volAvg = history.slice(i-5, i).reduce((a,b)=>a+b.volume,0)/5;
         const volRatio = today.volume / (volAvg || 1);

         // 1. ENTRY Logic
         if (shares === 0) {
             const recentHigh = Math.max(...history.slice(i-this.config.trendShortN, i).map(d => d.high));
             
             if (today.close > recentHigh && channelInfo.slope > 0 && volRatio > this.config.volBreakoutRatio) {
                 buy(i, '建', '突破新高+放量');
             }
         } 
         // 2. HOLDING Logic
         else {
             const range = waveHigh - waveLow;
             const fib1 = waveHigh - range * this.config.fibCallback1; 
             const fib2 = waveHigh - range * this.config.fibCallback2; 
             
             // A. STOP LOSS
             if (today.close < entryPrice * (1 - this.config.stopLossPct)) {
                 sell(i, '止损', '硬损触发');
                 continue;
             }
             if (range > 0 && today.close < waveHigh - range * 1.2) { 
                 sell(i, '清仓', '趋势破坏');
                 continue;
             }

             // B. ADD POSITIONS
             if (volRatio < this.config.volShrinkRatio) {
                 if (today.low <= fib1 && today.close > fib1 * 0.98 && (lastAction as string) === '建') {
                     buy(i, '加1', '回调32.8%+缩量');
                 } else if (today.low <= fib2 && today.close > fib2 * 0.98 && ((lastAction as string) === '建' || (lastAction as string) === '加1')) {
                     buy(i, '加2', '回调61.8%+缩量');
                 }
             }

             // C. TAKE PROFIT
             if ((today.close - entryPrice) / entryPrice > this.config.takeProfitPct) {
                 sell(i, '止盈2', '达到硬性止盈位');
                 continue;
             }
             const extPrice = waveHigh + range * this.config.fibExtension;
             if (today.high >= extPrice) {
                 sell(i, '止盈1', '触及延伸目标位', 50); 
             }
             
             if (slopeShort < -0.02) { 
                 sell(i, '清仓', '短期趋势反转');
             }
         }
         
         equityCurve.push({date: today.date, value: cash + shares * today.close});
     }

     const finalBal = equityCurve[equityCurve.length-1].value;
     let peak = this.config.initialCapital;
     let maxDd = 0;
     equityCurve.forEach(e => {
         if (e.value > peak) peak = e.value;
         const dd = (peak - e.value) / peak;
         if (dd > maxDd) maxDd = dd;
     });
     
     const winningTrades = tradeLogs.filter(t => t.pnlAmount && t.pnlAmount > 0).length;
     const totalTrades = tradeLogs.filter(t => t.pnlAmount !== undefined).length;

     this.logs.set(tradeLogs.reverse());
     this.chartData.set({ history, markers, channels });
     this.result.set({
         finalBalance: finalBal,
         totalReturn: (finalBal - this.config.initialCapital) / this.config.initialCapital * 100,
         maxDrawdown: maxDd * 100,
         winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
         tradeCount: totalTrades,
         avgHoldDays: 0, 
         equityCurve,
         marketTypeStats: { bull: {wins:0,total:0}, bear: {wins:0,total:0}, sideways: {wins:0,total:0} }
     });
  }

  // --- D3 Chart ---
  private renderChart(data: {history: KlinePoint[], markers: any[], channels: ChannelPoint[]}, containerRef: ElementRef) {
     const element = containerRef.nativeElement;
     d3.select(element).selectAll('*').remove();
     
     const { history, markers, channels } = data;
     if (!history.length) return;

     const margin = { top: 20, right: 50, bottom: 30, left: 10 };
     const width = element.clientWidth - margin.left - margin.right;
     const height = element.clientHeight - margin.top - margin.bottom;

     const svg = d3.select(element).append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

     // X Axis
     const x = d3.scaleBand()
        .domain(history.map(d => d.date))
        .range([0, width])
        .padding(0.2);

     const yMin = d3.min(history, (d: any) => d.low)! * 0.95;
     const yMax = d3.max(history, (d: any) => d.high)! * 1.05;
     const y = d3.scaleLinear().domain([yMin, yMax]).range([height, 0]);

     // Axes
     const xAxis = d3.axisBottom(x)
        .tickValues(x.domain().filter((d: any, i: number) => i % Math.floor(history.length / 6) === 0))
        .tickFormat((d: any) => d.slice(2)); 
     
     svg.append('g').attr('transform', `translate(0,${height})`).call(xAxis).attr('class', 'text-gray-400 text-[10px]');
     svg.append('g').attr('transform', `translate(${width},0)`).call(d3.axisRight(y).ticks(5)).attr('class', 'text-gray-400 text-[10px]');

     // --- Draw Trend Channels (Background Ribbon) ---
     // We need to split channels into "Up" and "Down" segments to color them differently
     const channelSegments: { type: 'UP'|'DOWN', points: ChannelPoint[] }[] = [];
     let currentSegment: { type: 'UP'|'DOWN', points: ChannelPoint[] } | null = null;

     channels.forEach(pt => {
         const type = pt.slope >= 0 ? 'UP' : 'DOWN';
         if (!currentSegment || currentSegment.type !== type) {
             if (currentSegment) channelSegments.push(currentSegment);
             currentSegment = { type, points: [pt] };
         } else {
             currentSegment.points.push(pt);
         }
     });
     if (currentSegment) channelSegments.push(currentSegment);

     const areaGen = d3.area()
        .x((d: any) => x(d.date)! + x.bandwidth()/2)
        .y0((d: any) => y(d.bottom))
        .y1((d: any) => y(d.top))
        .curve(d3.curveMonotoneX);

     const lineTop = d3.line().x((d: any) => x(d.date)! + x.bandwidth()/2).y((d: any) => y(d.top)).curve(d3.curveMonotoneX);
     const lineBottom = d3.line().x((d: any) => x(d.date)! + x.bandwidth()/2).y((d: any) => y(d.bottom)).curve(d3.curveMonotoneX);

     channelSegments.forEach(seg => {
         // Draw Fill
         svg.append('path')
            .datum(seg.points)
            .attr('fill', seg.type === 'UP' ? '#fecaca' : '#bbf7d0') // Red-200 / Green-200
            .attr('fill-opacity', 0.4)
            .attr('d', areaGen);
         
         // Draw Borders
         const borderColor = seg.type === 'UP' ? '#ef4444' : '#22c55e';
         svg.append('path').datum(seg.points).attr('fill', 'none').attr('stroke', borderColor).attr('stroke-width', 1).attr('stroke-dasharray', '2,2').attr('d', lineTop);
         svg.append('path').datum(seg.points).attr('fill', 'none').attr('stroke', borderColor).attr('stroke-width', 1).attr('stroke-dasharray', '2,2').attr('d', lineBottom);
     });

     // Candles
     const candles = svg.selectAll('.candle').data(history).enter().append('g');
     candles.append('line')
        .attr('x1', (d: any) => x(d.date)! + x.bandwidth()/2)
        .attr('x2', (d: any) => x(d.date)! + x.bandwidth()/2)
        .attr('y1', (d: any) => y(d.high)).attr('y2', (d: any) => y(d.low))
        .attr('stroke', (d: any) => d.close > d.open ? '#ef4444' : '#22c55e');
     candles.append('rect')
        .attr('x', (d: any) => x(d.date)!)
        .attr('y', (d: any) => y(Math.max(d.open, d.close)))
        .attr('width', x.bandwidth())
        .attr('height', (d: any) => Math.max(1, Math.abs(y(d.open) - y(d.close))))
        .attr('fill', (d: any) => d.close > d.open ? '#ef4444' : '#22c55e');

     // Markers
     markers.forEach(m => {
         const mx = x(m.date);
         if (mx === undefined) return;
         const cx = mx + x.bandwidth()/2;
         const cy = y(m.price);
         const isBuy = m.type === 'BUY';
         const color = isBuy ? '#10b981' : (m.label.includes('止盈') ? '#f97316' : '#3b82f6');
         
         svg.append('circle').attr('cx', cx).attr('cy', isBuy ? cy + 10 : cy - 10).attr('r', 4).attr('fill', color);
         svg.append('text').attr('x', cx).attr('y', isBuy ? cy + 22 : cy - 15)
            .text(m.label).attr('fill', color).attr('font-size', '9px').attr('text-anchor', 'middle').attr('font-weight', 'bold');
     });

     // Crosshair & Tooltip
     const crosshairX = svg.append('line').attr('stroke', '#94a3b8').attr('stroke-width', 1).attr('stroke-dasharray', '3,3').style('display', 'none').style('pointer-events', 'none');
     const crosshairY = svg.append('line').attr('stroke', '#94a3b8').attr('stroke-width', 1).attr('stroke-dasharray', '3,3').style('display', 'none').style('pointer-events', 'none');
     
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

               const m = markers.find(mark => mark.date === d.date);
               
               let html = `<div class="font-bold mb-1">${d.date}</div>`;
               html += `<div class="flex justify-between gap-4"><span>收盘:</span><span>${d.close.toFixed(3)}</span></div>`;
               html += `<div class="flex justify-between gap-4"><span>涨跌:</span><span class="${d.close>d.open?'text-red-500':'text-green-500'}">${((d.close-d.open)/d.open*100).toFixed(2)}%</span></div>`;
               
               if (m) {
                   html += `<div class="mt-2 pt-1 border-t border-gray-200 font-bold ${m.type==='BUY'?'text-red-600':'text-green-600'}">${m.label}</div>`;
                   if (m.reason) html += `<div class="text-gray-500 max-w-[150px] whitespace-normal">${m.reason}</div>`;
               }

               const box = element.getBoundingClientRect();
               let left = mx + 20;
               let top = my + 20;
               if (left + 160 > width) left = mx - 150;
               
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
