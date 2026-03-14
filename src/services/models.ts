
import { ETFDefinition } from './etf-list';

export interface KlinePoint {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
  // Moving Averages
  ma5?: number;
  ma10?: number;
  ma20?: number;
  ma60?: number;
  // Slopes (Percentage Change per day)
  ma20Slope?: number;
  ma60Slope?: number;
  
  // Indicators
  macd?: { diff: number; dea: number; macd: number };
  kdj?: { k: number; d: number; j: number };
  rsi?: number;
  wr?: number; // Williams %R
  boll?: { upper: number; mid: number; lower: number; width: number }; 
  bias?: number; // BIAS 20
  
  // New Indicators
  atr?: number; // Average True Range (14)
  donchian?: { upper: number; lower: number; mid: number; lower10: number }; // Turtle Channel
  roc?: number; // Rate of Change
  mtm?: number; // Momentum
  obv?: number; // On-Balance Volume
  obvMa?: number; // MA of OBV
}

export interface FundBaseInfo {
  fundSize: number; // In Billions (亿元)
  establishmentDate: string; // YYYY-MM-DD
  age: number; // Years since establishment
}

export interface WaveStats {
  height: number;
  days: number;
  slope: number;
}

// Updated Trade Suggestion Types for Multi-period Resonance
export type TradeSuggestion = 
  'OBSERVE' |          // 观察点
  'BUY_POINT' |        // 建仓点
  'HOLD' |             // 持仓
  'TAKE_PROFIT_REDUCE' | // 止盈(减仓)
  'TAKE_PROFIT_CLEAR' |  // 止盈(清仓)
  'STOP_LOSS_REDUCE' |   // 止损(减仓)
  'STOP_LOSS_CLEAR' |    // 止损(清仓)
  'WAIT';              // 观望

export interface BoxSignal {
  type: 'UP' | 'DOWN';
  date: string; // Entry Date
  obsDate: string; // Observation Date
  boxHigh: number;
  boxLow: number;
  boxHeight: number;
  entryPrice: number;
  poc: number; // Point of Control
  tpA: number; // Target 38.2%
  tpB: number; // Target 61.8%
  slA: number; // Stop Loss 38.2%
  slB: number; // Stop Loss 61.8%
  clearPrice: number; // Clearance Point (Box Low)
  valid: boolean;
  boxStartDate: string; // For drawing box
}

export interface TurtleSignal {
  action: 'BUY' | 'SELL' | 'HOLD' | 'OBSERVE';
  breakoutPrice: number;
  stopLoss: number;
  takeProfit: number;
  message: string;
}

export interface ETFAnalysis extends ETFDefinition, FundBaseInfo {
  currentPrice: number;
  suggestedEntryPrice: number; // Calculated Buy Target
  goldenPrice: number; // Golden Ratio Support Price (0.618 retracement)
  changePercent7d: number;
  isGolden: boolean; 
  breakMA5: boolean;
  breakMA20: boolean;
  breakDowntrend: boolean; 
  isBreakout: boolean; // New: Breakout 30-day high
  isHighVolume: boolean;
  isNearTrendline?: boolean; // New: Near Trendline
  
  // Counts
  buySignals: number;
  sellSignals: number;
  
  // Detailed Reasons
  buyFactors: string[];
  sellFactors: string[];

  trend: 'UP' | 'DOWN' | 'SIDEWAYS';
  score: number;
  health: number; // New Health Score
  symmetry?: {
      lastWave: WaveStats;
      currentSlope: number;
      slopeRatio: number; // current / last
  };

  suggestion: TradeSuggestion;
  boxSignal?: BoxSignal | null; // Multi-period Resonance Signal
  turtleSignal?: TurtleSignal; // Donchian/Turtle Signal
  lastUpdated: string;
  history: KlinePoint[];
  
  displayIndustry: string; // New field for UI display (e.g. '科技-半导体')
}

export interface FilterState {
  searchTerm: string;
  showFilters: boolean;
  filterGolden: boolean;
  filterHighVolume: boolean;
  filterBreakDowntrend: boolean;
  filterBreakout: boolean; // New Filter
  filterNearTrendline?: boolean; // New Filter
  filterBreakMA5: boolean;
  filterBreakMA20: boolean;
  filterTrend: string;
  filterIndustry: string; 
  filterSuggestion: string; // New Filter
  filterMinBuySignals: number;
  filterMinSellSignals: number;
  // New Filters
  filterMinScale: number; // Billion
  filterMinAge: number; // Years
  currentPage: number;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  // View State
  viewMode: 'ALL' | 'FAVORITES' | 'RECOMMENDED';
}
