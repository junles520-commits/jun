
import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ETFDefinition, ETF_LIST } from './etf-list';
import { map, forkJoin, catchError, of, Observable, from, mergeMap, toArray, switchMap, tap, retry, timeout } from 'rxjs';
import { DbService, CachedETFData } from './db.service';
import { KlinePoint, FundBaseInfo, WaveStats, TradeSuggestion, BoxSignal, ETFAnalysis, FilterState, TurtleSignal } from './models';
import { GoogleGenAI } from '@google/genai';

export interface NewsAnalysisResult {
  markdown: string;
  tradingPlan?: {
    rating: string;
    riskLevel: string;
    operation: string;
    targetPrice: number;
    takeProfit: number;
    stopLoss: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class EtfService {
  private http: HttpClient = inject(HttpClient);
  private db: DbService = inject(DbService);
  private ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  
  // State
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  etfData = signal<ETFAnalysis[]>([]);
  
  // Favorites State
  favorites = signal<Set<string>>(new Set());
  private readonly FAV_STORAGE_KEY = 'etf_favorites_v1';
  private readonly FILTER_STORAGE_KEY = 'etf_filter_state_v1';
  
  private readonly DEFAULT_FAVORITES = [
    '512480', // 半导体ETF
    '512400', // 有色ETF
    '513060', // 恒生医疗ETF
    '159611', // 电力ETF
    '515790', // 光伏ETF
    '512660', // 军工ETF
    '515000', // 科技ETF
    '159995', // 芯片ETF
    '159819', // 人工智能ETF
    '512800', // 银行ETF
    '512010', // 医药ETF
    '512880', // 证券ETF
    '515220', // 煤炭ETF
    '510300', // 沪深300ETF
    '510500', // 中证500ETF
    '513180', // 恒生科技指数ETF
    '159941', // 纳指ETF
    '513500', // 标普500ETF
    '513880', // 日经225ETF
    '518880', // 黄金ETF
    '511260'  // 十年国债ETF
  ];

  // Available industries for filter dropdown
  availableIndustries = signal<string[]>([
      '宽基/指数',
      '科技/TMT',
      '医药/生物',
      '大消费',
      '新能源/车',
      '金融',
      '周期/资源',
      '高端制造', 
      '军工',
      '债券',
      '货币',
      '特色/其他'
  ]);

  // Filter State Persistence
  filterState = signal<FilterState>({
    searchTerm: '',
    showFilters: false,
    filterGolden: false,
    filterHighVolume: false,
    filterBreakDowntrend: false,
    filterBreakout: false,
    filterNearTrendline: false,
    filterBreakMA5: false,
    filterBreakMA20: false,
    filterTrend: 'ALL',
    filterIndustry: 'ALL',
    filterSuggestion: 'ALL',
    filterMinBuySignals: 0,
    filterMinSellSignals: 0,
    filterMinScale: 0,
    filterMinAge: 0,
    currentPage: 1,
    sortField: 'score',
    sortDirection: 'desc',
    viewMode: 'ALL'
  });

  private readonly ALPHA_VANTAGE_KEY = 'D461NECWHCF1PCS7';
  private readonly FINNHUB_KEY = 'd6g0kfpr01qqnmbqalf0d6g0kfpr01qqnmbqalfg';
  private readonly MASSIVE_KEY = 'ab2dneMwkPlM0sJyyeICMCTSwz5gKBjB';

  constructor() {
      this.loadFavorites();
      this.loadFilterState();
  }

  // --- News Analysis (Gemini) ---
  async analyzeNews(etf: ETFAnalysis): Promise<NewsAnalysisResult> {
    const cacheKey = `news_analysis_v2_${etf.code}`;
    const cached = await this.db.getCache(cacheKey);
    if (cached) {
      return cached.data;
    }

    const prompt = `
# Role
你是一位拥有 20 年经验的资深量化分析师与宏观策略专家。你的任务是分析我提供的【原始新闻/公告数据】以及【当前技术面数据】，并将其转化为结构化的投资研究建议和量化交易计划。

# Context
- ETF名称：${etf.name} (${etf.code})
- 当前价格：${etf.currentPrice}
- 7日涨跌幅：${etf.changePercent7d.toFixed(2)}%
- 技术面趋势：${etf.trend === 'UP' ? '上涨' : etf.trend === 'DOWN' ? '下跌' : '震荡'}
- 综合评分：${etf.score} / 100
- 黄金支撑位：${etf.goldenPrice.toFixed(3)}
- 买入信号数：${etf.buySignals}
- 卖出信号数：${etf.sellSignals}

# Goals
1. 提取新闻的核心事件。
2. 评估该资讯对相关个股或板块的短期与中长期影响。
3. 识别潜在的风险点。
4. 给出量化的情绪得分（-10 到 +10）。
5. 结合技术面数据和基本面资讯，生成量化交易计划。

# Analysis Framework
请按以下 JSON 格式输出分析结果（不要包含任何 markdown 代码块标记，直接输出纯 JSON 字符串）：

{
  "markdown": "## 1. 核心事件摘要\\n- [简要描述发生了什么，剔除噪声信息]\\n\\n## 2. 影响评估\\n- **受影响标的**：[股票代码/行业名称]\\n- **影响时长**：[短期(1-5天) / 中期(1个月) / 长期(1季度以上)]\\n- **逻辑推演**：[说明该事件如何影响盈利能力、估值或市场情绪]\\n\\n## 3. 情绪评分 & 预期差\\n- **情绪得分**：[分数]（-10 极度利空，0 中性，+10 极度利好）\\n- **预期差分析**：[此消息是意料之中还是超预期？市场此前是否已消化？]\\n\\n## 4. 关键风险提示\\n- [列出该资讯背后可能隐藏的陷阱或不确定性因素]\\n\\n## 5. 交易策略建议 (仅供参考)\\n- [基于当前信息，建议关注的压力位/支撑位或操作逻辑]",
  "tradingPlan": {
    "rating": "[投资评级，例如：积极买入 (Strong Buy) / 持有待涨 (Overweight) / 中性配配 (Neutral) / 减持观望 (Underweight)]",
    "riskLevel": "[风险等级，例如：低风险 (Low) / 中风险 (Medium) / 高风险 (High)]",
    "operation": "[操作建议，例如：逢低吸纳 / 顺势加仓 / 观望 / 逢高减仓]",
    "targetPrice": [目标价位，数字],
    "takeProfit": [止盈位，数字],
    "stopLoss": [止损位，数字]
  }
}

请使用 googleSearch 工具搜索关于 "${etf.name} ETF" 或其相关板块的最新新闻，并基于搜索结果进行分析。
`;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: 'application/json',
        }
      });
      
      const resultText = response.text || '{}';
      const result: NewsAnalysisResult = JSON.parse(resultText);
      
      await this.db.setCache(cacheKey, { data: result }, 3600 * 4); // Cache for 4 hours
      return result;
    } catch (error) {
      console.error('[EtfService] News Analysis Error:', error);
      throw error;
    }
  }

  // --- Finnhub Integration ---
  
  getFinnhubQuote(code: string): Observable<any> {
      // Mapping: 510300 -> 510300.SS (Shanghai), 159915 -> 159915.SZ (Shenzhen)
      const symbol = this.getAlphaVantageSymbol(code); // Re-use symbol mapping logic
      const cacheKey = `finnhub_quote_${symbol}`;
      
      return from(this.db.getCache(cacheKey)).pipe(
          switchMap(cached => {
              if (cached) {
                  console.log(`[EtfService] Using cached Finnhub data for ${symbol}`);
                  return of(cached);
              }
              
              const url = `/finnhub_api/quote?symbol=${symbol}&token=${this.FINNHUB_KEY}`;
              console.log(`[EtfService] Fetching Finnhub data for ${symbol}...`);
              
              return this.http.get(url).pipe(
                  tap(data => {
                      if (data) {
                          this.db.setCache(cacheKey, data, 300); // Cache for 5 mins
                      }
                  }),
                  catchError(err => {
                      console.error('[EtfService] Finnhub Error:', err);
                      return of(null);
                  })
              );
          })
      );
  }

  private loadFavorites() {
      const stored = localStorage.getItem(this.FAV_STORAGE_KEY);
      if (stored) {
          try {
              const parsed = JSON.parse(stored);
              if (Array.isArray(parsed) && parsed.length > 0) {
                  this.favorites.set(new Set(parsed));
              } else {
                  this.favorites.set(new Set(this.DEFAULT_FAVORITES));
              }
          } catch (e) {
              this.favorites.set(new Set(this.DEFAULT_FAVORITES));
          }
      } else {
          this.favorites.set(new Set(this.DEFAULT_FAVORITES));
      }
  }

  toggleFavorite(code: string) {
      this.favorites.update(set => {
          const newSet = new Set(set);
          if (newSet.has(code)) {
              newSet.delete(code);
          } else {
              newSet.add(code);
          }
          localStorage.setItem(this.FAV_STORAGE_KEY, JSON.stringify(Array.from(newSet)));
          return newSet;
      });
  }

  isFavorite(code: string): boolean {
      return this.favorites().has(code);
  }

  private loadFilterState() {
      const stored = localStorage.getItem(this.FILTER_STORAGE_KEY);
      if (stored) {
          try {
              const parsed = JSON.parse(stored);
              // Merge with defaults
              this.filterState.update(s => ({ ...s, ...parsed }));
          } catch (e) {
              console.warn('Failed to load filter state', e);
          }
      }
  }

  updateFilterState(updates: Partial<FilterState>) {
    this.filterState.update(state => {
        const newState = { ...state, ...updates };
        localStorage.setItem(this.FILTER_STORAGE_KEY, JSON.stringify(newState));
        return newState;
    });
  }
  
  resetFilterState() {
     const defaults: FilterState = {
        searchTerm: '',
        showFilters: false,
        filterGolden: false,
        filterHighVolume: false,
        filterBreakDowntrend: false,
        filterBreakout: false,
        filterNearTrendline: false,
        filterBreakMA5: false,
        filterBreakMA20: false,
        filterTrend: 'ALL',
        filterIndustry: 'ALL',
        filterSuggestion: 'ALL',
        filterMinBuySignals: 0,
        filterMinSellSignals: 0,
        filterMinScale: 0,
        filterMinAge: 0,
        currentPage: 1,
        sortField: 'score',
        sortDirection: 'desc',
        viewMode: 'ALL'
     };
     this.filterState.set(defaults);
     localStorage.setItem(this.FILTER_STORAGE_KEY, JSON.stringify(defaults));
  }

  // Helpers
  private getMarketCode(code: string): string {
    if (code.startsWith('5') || code.startsWith('6')) return '1';
    return '0';
  }

  // Helper to map detailed industry (e.g. "科技-半导体") to Broad Category (e.g. "科技/TMT")
  private normalizeIndustry(detailed: string, name: string): string {
      if (!detailed) return this.classifyETF(name);
      
      if (detailed.startsWith('宽基')) return '宽基/指数';
      if (detailed.startsWith('科技')) return '科技/TMT';
      if (detailed.startsWith('医药')) return '医药/生物';
      if (detailed.startsWith('消费')) return '大消费';
      if (detailed.startsWith('新能源')) return '新能源/车';
      if (detailed.startsWith('金融')) return '金融';
      if (detailed.startsWith('周期') || detailed.startsWith('地产')) return '周期/资源';
      if (detailed.startsWith('制造') || detailed.startsWith('军工')) return '高端制造'; 
      if (detailed.startsWith('特色')) return '特色/其他';
      
      return '特色/其他';
  }

  // Legacy Classifier Fallback
  private classifyETF(name: string): string {
    if (/(300|500|1000|2000|50|100|800|创业板|科创|恒生|纳指|标普|红利|MSCI|综指|成指|大湾区|双创|中证|A50|道琼斯|日经|德国|法国|英国|东南亚|沙特)/.test(name)) return '宽基/指数';
    if (/(芯片|半导体|计算机|电子|5G|人工智能|游戏|传媒|通信|软件|科技|互联|AI|数据|卫星|信创|机器人|云计算|元宇宙|智能|信息|机床)/.test(name)) return '科技/TMT';
    if (/(医疗|药|生物|疫苗|医|健康|基因|中药)/.test(name)) return '医药/生物';
    if (/(酒|食品|家电|消费|旅游|养殖|农|畜|文娱|教育|美妆|饮料|乳)/.test(name)) return '大消费';
    if (/(光伏|电池|新能源|碳中和|车|绿电|电力|储能|环保|低碳|光电)/.test(name)) return '新能源/车';
    if (/(银行|券商|证券|保险|金融|FinTech|央企股东回报)/i.test(name)) return '金融';
    if (/(黄金|豆粕|有色|金属|稀土|铝|铜|矿|油|石化|煤炭|钢铁|能源|化工|基建|地产|房地产|建材|材料)/.test(name)) return '周期/资源';
    if (/(军工|国防|航天|制造|装备)/.test(name)) return '高端制造';
    if (/(债|政金|国开|同业存单)/.test(name)) return '债券';
    if (/(货币|理财|现金)/.test(name)) return '货币';
    return '特色/其他';
  }

  private parseRawNumber(val: any): number {
    if (val === undefined || val === null || val === '-') return 0;
    if (typeof val === 'number') return val;
    return parseFloat(val) || 0;
  }

  // --- Alpha Vantage Integration ---
  
  private getAlphaVantageSymbol(code: string): string {
      // Shanghai: 5xxxxx, 6xxxxx -> .SS
      // Shenzhen: 1xxxxx, 0xxxxx, 3xxxxx -> .SZ
      if (code.startsWith('5') || code.startsWith('6')) {
          return `${code}.SS`;
      }
      return `${code}.SZ`;
  }

  getAlphaVantageQuote(code: string): Observable<any> {
      const symbol = this.getAlphaVantageSymbol(code);
      const url = `/alpha_api/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${this.ALPHA_VANTAGE_KEY}`;
      console.log(`[EtfService] Fetching Alpha Vantage data for ${symbol}...`);
      
      return this.http.get(url).pipe(
          map((res: any) => {
              if (res && res['Global Quote']) {
                  const q = res['Global Quote'];
                  return {
                      price: parseFloat(q['05. price']),
                      changePercent: parseFloat(q['10. change percent'].replace('%', '')),
                      volume: parseFloat(q['06. volume']),
                      latestTradingDay: q['07. latest trading day']
                  };
              }
              return null;
          }),
          catchError(err => {
              console.error('[EtfService] Alpha Vantage Error:', err);
              return of(null);
          })
      );
  }

  // --- Main Methods ---

  loadAllEtfs() {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    console.log('[EtfService] Starting loadAllEtfs...');

    const marketCodes = ETF_LIST.map(e => `${this.getMarketCode(e.code)}.${e.code}`);
    const chunks: string[][] = [];
    const chunkSize = 80;
    for (let i = 0; i < marketCodes.length; i += chunkSize) {
        chunks.push(marketCodes.slice(i, i + chunkSize));
    }

    const reqs = chunks.map((chunk, index) => {
        const ids = chunk.join(',');
        const url = `/api/qt/ulist/get?pi=0&pz=200&po=1&np=1&fltt=2&invt=2&fields=f2,f3,f12,f14,f15,f16,f17,f20,f21,f116,f117&secids=${ids}`;
        console.log(`[EtfService] Requesting chunk ${index + 1}/${chunks.length}:`, url);
        return this.http.get<any>(url).pipe(
           timeout(10000),
           tap(res => console.log(`[EtfService] Chunk ${index + 1} response received:`, res ? 'OK' : 'NULL')),
           catchError((err) => {
               console.error(`[EtfService] Chunk ${index + 1} failed:`, err);
               return of(null);
           })
        );
    });

    forkJoin(reqs).subscribe({
        next: (responses) => {
            console.log('[EtfService] All chunks received. Processing...');
            const rawDataMap = new Map<string, any>();
            responses.forEach((res: any) => {
                if(res && res.data && res.data.diff) {
                    res.data.diff.forEach((d: any) => {
                        rawDataMap.set(d.f12, d);
                    });
                }
            });
            console.log(`[EtfService] Processed ${rawDataMap.size} items from raw data.`);

            const baseAnalysis: ETFAnalysis[] = ETF_LIST.map(def => {
                const raw = rawDataMap.get(def.code) || {};
                const price = this.parseRawNumber(raw.f2); // f2 price
                
                let marketCap = this.parseRawNumber(raw.f20); 
                
                if (!marketCap || marketCap <= 0) {
                    marketCap = this.parseRawNumber(raw.f21);
                }
                
                if ((!marketCap || marketCap <= 0) && price > 0) {
                     const totalShares = this.parseRawNumber(raw.f116);
                     if (totalShares > 0) marketCap = price * totalShares;
                }
                
                if ((!marketCap || marketCap <= 0) && price > 0) {
                     const floatShares = this.parseRawNumber(raw.f117);
                     if (floatShares > 0) marketCap = price * floatShares;
                }
                
                const detailedIndustry = def.industry;
                const filterIndustry = this.normalizeIndustry(detailedIndustry, def.name);

                return {
                    ...def,
                    industry: filterIndustry, // For Filtering
                    displayIndustry: detailedIndustry, // For Display
                    currentPrice: price,
                    changePercent7d: 0,
                    isGolden: false,
                    breakMA5: false,
                    breakMA20: false,
                    breakDowntrend: false,
                    isBreakout: false,
                    isNearTrendline: false,
                    isHighVolume: false,
                    buySignals: 0,
                    sellSignals: 0,
                    buyFactors: [],
                    sellFactors: [],
                    trend: 'SIDEWAYS',
                    score: 50,
                    health: 50,
                    suggestion: 'WAIT',
                    lastUpdated: new Date().toLocaleTimeString(),
                    history: [],
                    fundSize: marketCap / 100000000, 
                    establishmentDate: '',
                    age: 0,
                    suggestedEntryPrice: 0,
                    goldenPrice: 0
                };
            });
            
            console.log(`[EtfService] Setting etfData with ${baseAnalysis.length} items.`);
            this.etfData.set(baseAnalysis);
            this.fetchHistories(baseAnalysis);
        },
        error: (err) => {
            console.error('[EtfService] loadAllEtfs fatal error:', err);
            this.error.set('无法连接行情服务器');
            this.loading.set(false);
        }
    });
  }

  private fetchHistories(currentList: ETFAnalysis[]) {
     from(currentList).pipe(
        mergeMap(item => this.fetchSingleHistory(item), 6), 
        toArray()
     ).subscribe(updatedList => {
        this.etfData.set(updatedList);
        this.loading.set(false);
     });
  }

  getFinnhubCandles(code: string): Observable<KlinePoint[]> {
      const symbol = this.getAlphaVantageSymbol(code);
      // Fetch last 1 year (approx)
      const to = Math.floor(Date.now() / 1000);
      const fromTime = to - (365 * 24 * 60 * 60);
      const url = `/finnhub_api/stock/candle?symbol=${symbol}&resolution=D&from=${fromTime}&to=${to}&token=${this.FINNHUB_KEY}`;

      console.log(`[EtfService] Fetching Finnhub Candles for ${symbol}...`);

      return this.http.get<any>(url).pipe(
          map(res => {
              if (res && res.s === 'ok' && res.c && res.c.length > 0) {
                  const points: KlinePoint[] = [];
                  for (let i = 0; i < res.c.length; i++) {
                      const date = new Date(res.t[i] * 1000);
                      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                      points.push({
                          date: dateStr,
                          open: res.o[i],
                          high: res.h[i],
                          low: res.l[i],
                          close: res.c[i],
                          volume: res.v[i],
                          amount: 0 // Finnhub doesn't provide amount
                      });
                  }
                  return points;
              }
              return [];
          }),
          catchError(err => {
              console.error('[EtfService] Finnhub Candle Error:', err);
              return of([]);
          })
      );
  }

  private fetchSingleHistory(item: ETFAnalysis, isBacktest: boolean = false): Observable<ETFAnalysis> {
     const secid = `${this.getMarketCode(item.code)}.${item.code}`;

     // Helper to fetch fresh data (full or large batch), parse, save, and return
     const fetchFresh = (limit: number): Observable<ETFAnalysis> => {
        // Use proxy path /his_api/qt/stock/kline/get
        const url = `/his_api/qt/stock/kline/get?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=101&fqt=1&end=20500101&lmt=${limit}&_=${Date.now()}`;
        return this.http.get(url).pipe(
            retry(1), // Add retry for robustness
            switchMap((res: any) => {
                let history: KlinePoint[] = [];
                if (res && res.data && res.data.klines) {
                    history = this.parseKlines(res.data.klines);
                    console.log(`[ETF Service] Eastmoney data loaded for ${item.code}: ${history.length} points`);
                    this.db.saveETF({ code: item.code, history, lastUpdated: Date.now() }).catch(e => console.warn(e));
                    return of(this.analyzeETF(item, history));
                } 
                
                // Fallback to Finnhub if Eastmoney fails or returns empty
                console.warn(`[ETF Service] Eastmoney empty for ${item.code}, trying Finnhub...`);
                return this.getFinnhubCandles(item.code).pipe(
                    map(finnhubHistory => {
                        if (finnhubHistory.length > 0) {
                            console.log(`[ETF Service] Finnhub data loaded for ${item.code}: ${finnhubHistory.length} points`);
                            this.db.saveETF({ code: item.code, history: finnhubHistory, lastUpdated: Date.now() }).catch(e => console.warn(e));
                            return this.analyzeETF(item, finnhubHistory);
                        }
                        return this.analyzeETF(item, []);
                    })
                );
            }),
            catchError((err) => {
                console.error(`[ETF Service] Eastmoney fetch error for ${item.code}, trying Finnhub...`, err);
                return this.getFinnhubCandles(item.code).pipe(
                    map(finnhubHistory => {
                        if (finnhubHistory.length > 0) {
                             this.db.saveETF({ code: item.code, history: finnhubHistory, lastUpdated: Date.now() }).catch(e => console.warn(e));
                             return this.analyzeETF(item, finnhubHistory);
                        }
                        return item;
                    })
                );
            })
        );
     };

     // IMPORTANT: Catch promise errors from DB and add TIMEOUT to prevent stream crash or hang
     // If DB is locked or slow, we fallback to undefined (fresh fetch) after 1.5s
     const dbPromise = this.db.getETF(item.code).catch(err => {
         console.warn(`[DB] Read error for ${item.code}`, err);
         return undefined;
     });
     
     const timeoutPromise = new Promise<CachedETFData | undefined>((resolve) => {
         setTimeout(() => resolve(undefined), 1500);
     });

     const db$: Observable<CachedETFData | undefined> = from(Promise.race([dbPromise, timeoutPromise]));

     return db$.pipe(
         switchMap((cached: CachedETFData | undefined): Observable<ETFAnalysis> => {
             
             // Strategy for Backtest: We need a long history (e.g. 1000 days ~ 4 years)
             // If we are in backtest mode AND (no cache OR cache is too short), force a "Deep Fetch"
             if (isBacktest) {
                 const isInsufficient = !cached || !cached.history || cached.history.length < 750;
                 if (isInsufficient) {
                     console.log(`[ETF Service] Backtest data insufficient for ${item.code} (len=${cached?.history?.length || 0}), fetching fresh 2000 points.`);
                     return fetchFresh(2000); // Fetch ~8 years of data and save it
                 }
                 // If we have enough cached data, we proceed to incremental update to make sure it's up to date
             }

             if (cached && cached.history && cached.history.length > 0) {
                 // Incremental Update
                 const lastDateStr = cached.history[cached.history.length - 1].date; // YYYY-MM-DD
                 const nextDateStr = this.getNextDateString(lastDateStr); // YYYYMMDD
                 const todayStr = this.getTodayString(); // YYYYMMDD
                 const cachedHistory = cached.history; // Capture for closure safety
                 
                 // If data is up to date (or future), just return cache
                 if (nextDateStr > todayStr) {
                     return of(this.analyzeETF(item, cachedHistory));
                 }

                 // Fetch gap
                 // Use proxy path /his_api/qt/stock/kline/get
                 const url = `/his_api/qt/stock/kline/get?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=101&fqt=1&beg=${nextDateStr}&end=20500101&_=${Date.now()}`;
                 
                 return this.http.get(url).pipe(
                     retry(1),
                     map((res: any): ETFAnalysis => {
                         if (res && res.data && res.data.klines && res.data.klines.length > 0) {
                             const newKlines = this.parseKlines(res.data.klines);
                             // Merge avoiding duplicates (simple check on last date)
                             const merged = [...cachedHistory, ...newKlines];
                             // Ensure unique by date just in case
                             const uniqueHistory = this.deduplicateHistory(merged);
                             
                             // Update DB asynchronously
                             console.log(`[ETF Service] Merging ${newKlines.length} new records to DB for ${item.code}`);
                             this.db.saveETF({ code: item.code, history: uniqueHistory, lastUpdated: Date.now() }).catch(e => console.error(e));
                             return this.analyzeETF(item, uniqueHistory);
                         }
                         return this.analyzeETF(item, cachedHistory);
                     }),
                     catchError(() => of(this.analyzeETF(item, cachedHistory)))
                 );

             } else {
                 // First Load (Normal Mode): Fetch 365 Days
                 return fetchFresh(365);
             }
         }),
         // Final safety net for switchMap errors
         catchError(err => {
             console.error(`[History Fetch] Error for ${item.code}`, err);
             return of(item);
         })
     );
  }

  getEtfDetails(code: string): Observable<ETFAnalysis | null> {
    // Check memory cache first
    const existing = this.etfData().find(e => e.code === code);
    if (existing && existing.history.length > 20) return of(existing);
    
    // Fallback to fetch logic (which checks DB)
    let def = ETF_LIST.find(e => e.code === code);
    if (!def) {
       def = { code, name: code, industry: '未知' };
    }
    
    const tempItem = this.createTempItem(def);
    return this.fetchSingleHistory(tempItem);
  }

  getBacktestData(code: string): Observable<ETFAnalysis | null> {
      let def = ETF_LIST.find(e => e.code === code);
      if (!def) def = { code, name: code, industry: '未知' };
      const tempItem = this.createTempItem(def);
      return this.fetchSingleHistory(tempItem, true);
  }

  private createTempItem(def: ETFDefinition): ETFAnalysis {
      return {
        ...def,
        currentPrice: 0,
        changePercent7d: 0,
        isGolden: false,
        breakMA5: false,
        breakMA20: false,
        breakDowntrend: false,
        isBreakout: false,
        isNearTrendline: false,
        isHighVolume: false,
        buySignals: 0,
        sellSignals: 0,
        buyFactors: [],
        sellFactors: [],
        trend: 'SIDEWAYS',
        score: 50,
        health: 50,
        suggestion: 'WAIT',
        lastUpdated: '',
        history: [],
        fundSize: 0,
        establishmentDate: '',
        age: 0,
        suggestedEntryPrice: 0,
        goldenPrice: 0,
        industry: def.industry || this.classifyETF(def.name),
        displayIndustry: def.industry || this.classifyETF(def.name)
    };
  }

  // --- Date Helpers for API ---
  
  // Convert "2024-05-20" to "20240521" (Next day YYYYMMDD)
  private getNextDateString(dateStr: string): string {
      const date = new Date(dateStr);
      date.setDate(date.getDate() + 1);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}${m}${d}`;
  }

  private getTodayString(): string {
      const date = new Date();
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}${m}${d}`;
  }

  private deduplicateHistory(hist: KlinePoint[]): KlinePoint[] {
      const map = new Map<string, KlinePoint>();
      hist.forEach(h => map.set(h.date, h));
      // Sort by date just to be sure
      return Array.from(map.values()).sort((a,b) => a.date.localeCompare(b.date));
  }

  // --- Parsing & Analysis ---

  private checkNearTrendline(history: KlinePoint[]): boolean {
      if (!history || history.length < 60) return false;
      // Use last 60 days for trend channel to match default view
      const recent = history.slice(-60);
      const points = recent.map((d, i) => [i, d.close]);
      
      let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
      const n = points.length;
      points.forEach(p => {
          sumX += p[0];
          sumY += p[1];
          sumXY += p[0] * p[1];
          sumXX += p[0] * p[0];
      });

      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      let maxDev = 0;
      recent.forEach((d, i) => {
          const expectedY = slope * i + intercept;
          const dev = Math.abs(d.close - expectedY);
          if (dev > maxDev) maxDev = dev;
      });

      const lastIndex = n - 1;
      const latestClose = recent[lastIndex].close;
      const expectedLastY = slope * lastIndex + intercept;
      
      const upperLineY = expectedLastY + maxDev;
      const lowerLineY = expectedLastY - maxDev;

      // Check if latestClose is within +/- 2% of upperLineY or lowerLineY
      const isNearUpper = Math.abs(latestClose - upperLineY) / upperLineY <= 0.02;
      const isNearLower = Math.abs(latestClose - lowerLineY) / lowerLineY <= 0.02;

      // Ensure it has a meaningful slope (ascending or descending)
      // e.g., absolute change over 60 days is at least 2% of the price
      const slopePercent = Math.abs(slope * 60) / intercept;
      if (slopePercent < 0.02) return false;

      return isNearUpper || isNearLower;
  }

  private parseKlines(rawLines: string[]): KlinePoint[] {
    return rawLines.map(line => {
       const p = line.split(',');
       return {
          date: p[0],
          open: parseFloat(p[1]),
          close: parseFloat(p[2]),
          high: parseFloat(p[3]),
          low: parseFloat(p[4]),
          volume: parseFloat(p[5]),
          amount: parseFloat(p[6])
       };
    });
  }

  private calcBoxSignals(fullHistory: KlinePoint[]): BoxSignal | null {
      const minBoxSize = 30;
      if (fullHistory.length < minBoxSize + 5) return null;

      const scanLimit = Math.max(minBoxSize + 5, fullHistory.length - 60);
      
      for (let i = fullHistory.length - 1; i >= scanLimit; i--) {
          const entryDay = fullHistory[i];
          const confirmDay = fullHistory[i-1];
          const obsDay = fullHistory[i-2];
          
          const boxEndIdx = i - 2;
          const boxStartIdx = boxEndIdx - 29; 
          
          if (boxStartIdx < 0) continue;
          
          const boxData = fullHistory.slice(boxStartIdx, boxEndIdx + 1);
          const boxHigh = Math.max(...boxData.map(d => d.high));
          const boxLow = Math.min(...boxData.map(d => d.low));
          const D = boxHigh - boxLow;
          
          if (confirmDay.close > boxHigh && entryDay.close > boxHigh) {
             
             const prices = boxData.map(d => d.close);
             const minP = Math.min(...prices);
             const maxP = Math.max(...prices);
             const bins = 20;
             const binSize = (maxP - minP) / bins;
             let poc = (minP + maxP) / 2;
             
             if (binSize > 0) {
                 const binVols = new Array(bins).fill(0);
                 boxData.forEach(d => {
                    const idx = Math.min(bins-1, Math.floor((d.close - minP)/binSize));
                    binVols[idx] += d.volume;
                 });
                 const maxBinIdx = binVols.indexOf(Math.max(...binVols));
                 poc = minP + (maxBinIdx + 0.5) * binSize;
             }
             
             const volSlice = fullHistory.slice(i-5, i);
             const avgVol5 = volSlice.reduce((a,b)=>a+b.volume,0)/volSlice.length;
             
             const volSpike = entryDay.volume > 1.2 * avgVol5 || confirmDay.volume > 1.2 * avgVol5;
             const priceValid = entryDay.close > poc;
             
             if (priceValid && volSpike) {
                 return {
                     type: 'UP',
                     date: entryDay.date,
                     obsDate: obsDay.date,
                     entryPrice: entryDay.close,
                     boxStartDate: fullHistory[boxStartIdx].date,
                     boxHigh,
                     boxLow,
                     boxHeight: D,
                     poc,
                     tpA: entryDay.close + D * 0.382,
                     tpB: entryDay.close + D * 0.618,
                     slA: entryDay.close - D * 0.382,
                     slB: entryDay.close - D * 0.618,
                     clearPrice: boxLow, 
                     valid: true
                 };
             }
          }
      }
      return null;
  }

  private analyzeETF(item: ETFAnalysis, history: KlinePoint[]): ETFAnalysis {
     if (!history || history.length < 35) return { ...item, history };
     
     const points = this.calcIndicators(history);
     const latest = points[points.length - 1];
     const prev = points[points.length - 2];
     
     // Trend Analysis
     let trend: 'UP' | 'DOWN' | 'SIDEWAYS' = 'SIDEWAYS';
     if (latest.ma20 && prev.ma20) {
        if (latest.close > latest.ma20 && latest.ma20 > prev.ma20) trend = 'UP';
        else if (latest.close < latest.ma20 && latest.ma20 < prev.ma20) trend = 'DOWN';
     }

     const volAvg5 = points.slice(-5).reduce((a, b) => a + b.volume, 0) / 5;
     const isHighVolume = latest.volume > 1.5 * volAvg5;
     
     // Base Signals
     const buyFactors: string[] = [];
     const sellFactors: string[] = [];

     const breakMA5 = latest.close < (latest.ma5 || 0);
     const breakMA20 = latest.close < (latest.ma20 || 0);
     const breakDowntrend = prev.close < (prev.ma20 || 0) && latest.close > (latest.ma20 || 0);

     if (breakDowntrend) { buyFactors.push('突破20日均线'); }
     if (isHighVolume && latest.close > latest.open) { buyFactors.push('放量上涨'); }
     
     // 30-Day Breakout Check (Today or Yesterday)
     // Today > Max of previous 30 days (excluding today)
     const past30Today = points.slice(points.length - 31, points.length - 1);
     const maxHighToday = Math.max(...past30Today.map(p => p.high));
     const isBreakoutToday = latest.close > maxHighToday;

     // Yesterday > Max of previous 30 days (relative to yesterday)
     const past30Yesterday = points.slice(points.length - 32, points.length - 2);
     const maxHighYesterday = Math.max(...past30Yesterday.map(p => p.high));
     const isBreakoutYesterday = prev.close > maxHighYesterday;

     const isBreakout = isBreakoutToday || isBreakoutYesterday;
     if (isBreakout) { buyFactors.push('突破30日新高'); }

     // Trendline Proximity
     const isNearTrendline = this.checkNearTrendline(history);
     if (isNearTrendline) { buyFactors.push('接近趋势线上下轨'); }

     // Golden Ratio
     const recent = points.slice(-30);
     const maxHigh = Math.max(...recent.map(p => p.high));
     const minLow = Math.min(...recent.map(p => p.low));
     const range = maxHigh - minLow;
     const goldenPrice = maxHigh - range * 0.382;
     const isGolden = Math.abs(latest.close - goldenPrice) / goldenPrice < 0.02;
     
     if (isGolden && trend === 'UP') { buyFactors.push('黄金分割支撑位'); }

     // MACD
     if (latest.macd && prev.macd) {
        if (latest.macd.macd > 0 && prev.macd.macd <= 0) { buyFactors.push('MACD金叉'); }
        if (latest.macd.macd < 0 && prev.macd.macd >= 0) { sellFactors.push('MACD死叉'); }
     }

     if (breakMA20) { sellFactors.push('跌破20日均线'); }

     // --- Enhanced Signal Logic ---
     // 1. Moving Averages Alignment & Clusters
     if (latest.ma5 && latest.ma10 && latest.ma20) {
         if (latest.ma5 > latest.ma10 && latest.ma10 > latest.ma20) {
             buyFactors.push('均线多头排列');
         }
         if (latest.ma5 < latest.ma10 && latest.ma10 < latest.ma20) {
             sellFactors.push('均线空头排列');
         }
         
         // MA Cluster Breakout (均线粘合突破)
         const maxMA = Math.max(latest.ma5, latest.ma10, latest.ma20);
         const minMA = Math.min(latest.ma5, latest.ma10, latest.ma20);
         const clusterSpread = (maxMA - minMA) / minMA;
         if (clusterSpread < 0.02 && latest.close > maxMA && prev.close <= maxMA && isHighVolume) {
             buyFactors.push('均线密集区向上突破(高胜率)');
         } else if (clusterSpread < 0.02 && latest.close < minMA && prev.close >= minMA) {
             sellFactors.push('均线密集区向下破位(高风险)');
         }
     }

     // 2. RSI & Divergence
     if (latest.rsi) {
         if (latest.rsi < 30) { buyFactors.push('RSI超卖区(反弹预期)'); }
         if (latest.rsi > 70) { sellFactors.push('RSI超买区(回调风险)'); }
         
         // RSI Divergence
         if (points.length > 20 && prev.rsi) {
             const past10 = points.slice(-10, -1);
             const maxPrice10 = Math.max(...past10.map(p => p.high));
             const minPrice10 = Math.min(...past10.map(p => p.low));
             const maxRsi10 = Math.max(...past10.map(p => p.rsi || -Infinity));
             const minRsi10 = Math.min(...past10.map(p => p.rsi || Infinity));

             // Top Divergence: Price new high, RSI lower high
             if (latest.high > maxPrice10 && latest.rsi < maxRsi10 && latest.rsi > 60) {
                 sellFactors.push('RSI顶背离(上涨动能衰竭)');
             }
             // Bottom Divergence: Price new low, RSI higher low
             if (latest.low < minPrice10 && latest.rsi > minRsi10 && latest.rsi < 40) {
                 buyFactors.push('RSI底背离(下跌动能衰竭)');
             }
         }
     }

     // 3. KDJ
     if (latest.kdj && prev.kdj) {
         if (prev.kdj.k < prev.kdj.d && latest.kdj.k > latest.kdj.d && latest.kdj.d < 50) {
             buyFactors.push('KDJ低位金叉');
         }
         if (prev.kdj.k > prev.kdj.d && latest.kdj.k < latest.kdj.d && latest.kdj.d > 50) {
             sellFactors.push('KDJ高位死叉');
         }
     }
     
     // 4. MA60 Trend
     if (latest.ma60) {
         if (latest.close > latest.ma60 && prev.close <= prev.ma60) {
             buyFactors.push('强势站上60日牛熊分界线');
         }
         if (latest.close < latest.ma60 && prev.close >= prev.ma60) {
             sellFactors.push('跌破60日牛熊分界线');
         }
     }

     // 5. MACD & Price Divergence (顶底背离)
     if (points.length > 20 && latest.macd && prev.macd) {
         const past10 = points.slice(-10, -1);
         const maxPrice10 = Math.max(...past10.map(p => p.high));
         const minPrice10 = Math.min(...past10.map(p => p.low));
         const maxMacd10 = Math.max(...past10.map(p => p.macd?.macd || -Infinity));
         const minMacd10 = Math.min(...past10.map(p => p.macd?.macd || Infinity));

         // Top Divergence: Price new high, MACD lower high
         if (latest.high > maxPrice10 && latest.macd.macd < maxMacd10 && latest.macd.macd > 0) {
             sellFactors.push('MACD顶背离(上涨动能衰竭)');
         }
         // Bottom Divergence: Price new low, MACD higher low
         if (latest.low < minPrice10 && latest.macd.macd > minMacd10 && latest.macd.macd < 0) {
             buyFactors.push('MACD底背离(下跌动能衰竭)');
         }
     }

     // 6. OBV (On-Balance Volume) Trend
     if (latest.obv && latest.obvMa && prev.obv && prev.obvMa) {
         if (latest.obv > latest.obvMa && prev.obv <= prev.obvMa) {
             buyFactors.push('OBV能量潮突破(主力资金流入)');
         } else if (latest.obv < latest.obvMa && prev.obv >= prev.obvMa) {
             sellFactors.push('OBV能量潮跌破(主力资金流出)');
         }
     }

     // 7. ATR Volatility Contraction (波动率收敛)
     if (points.length > 20 && latest.atr) {
         const past14Atr = points.slice(-15, -1).map(p => p.atr || Infinity);
         const minAtr = Math.min(...past14Atr);
         if (latest.atr <= minAtr * 1.05) {
             buyFactors.push('ATR波动率极度收敛(面临变盘选择)');
         }
     }
     
     // 8. Volume-Price Action (量价关系)
     if (points.length > 10) {
         const past5Vol = points.slice(-6, -1).map(p => p.volume);
         const avgVol5 = past5Vol.reduce((a, b) => a + b, 0) / 5;
         
         // 放量滞涨 (High volume, small price change at high level)
         if (latest.volume > avgVol5 * 1.5 && Math.abs(latest.close - latest.open) / latest.open < 0.01 && latest.rsi && latest.rsi > 60) {
             sellFactors.push('高位放量滞涨(主力出货嫌疑)');
         }
         
         // 缩量企稳 (Low volume, small price change at low level)
         if (latest.volume < avgVol5 * 0.6 && Math.abs(latest.close - latest.open) / latest.open < 0.01 && latest.rsi && latest.rsi < 40) {
             buyFactors.push('低位缩量企稳(抛压减轻)');
         }
         
         // 放量突破 (High volume, large price increase)
         if (latest.volume > avgVol5 * 1.5 && (latest.close - latest.open) / latest.open > 0.02) {
             buyFactors.push('放量突破(多头强势)');
         }
         
         // 放量下跌 (High volume, large price decrease)
         if (latest.volume > avgVol5 * 1.5 && (latest.close - latest.open) / latest.open < -0.02) {
             sellFactors.push('放量下跌(空头强势)');
         }
     }
     
     // 9. Bollinger Bands (布林带)
     if (latest.boll && prev.boll) {
         if (latest.boll.width < 0.05) {
             buyFactors.push('布林带极度收口(面临方向选择)');
         }
         if (latest.close > latest.boll.upper && prev.close <= prev.boll.upper) {
             buyFactors.push('突破布林带上轨(强势特征)');
         }
         if (latest.close < latest.boll.lower && prev.close >= prev.boll.lower) {
             sellFactors.push('跌破布林带下轨(弱势特征)');
         }
     }
     
     // Box Signal Calculation
     const boxSignal = this.calcBoxSignals(points);

     // --- Turtle / Donchian Signal Logic ---
     let turtleSignal: TurtleSignal | undefined;
     if (latest.donchian && prev.donchian) {
         if (latest.close > prev.donchian.upper) {
             turtleSignal = {
                 action: 'BUY',
                 breakoutPrice: latest.close,
                 stopLoss: latest.close - (latest.atr || 0) * 2,
                 takeProfit: latest.close + (latest.atr || 0) * 4,
                 message: '突破20日唐奇安上轨，海龟建仓信号'
             };
             buyFactors.push('海龟法则：突破20日高点');
         } else if (latest.close < prev.donchian.lower10) {
             turtleSignal = {
                 action: 'SELL',
                 breakoutPrice: latest.close,
                 stopLoss: 0, takeProfit: 0,
                 message: '跌破10日唐奇安下轨，海龟离场信号'
             };
             sellFactors.push('海龟法则：跌破10日低点');
         } else if (latest.close > latest.donchian.mid) {
             turtleSignal = { action: 'HOLD', breakoutPrice: 0, stopLoss: latest.donchian.lower10, takeProfit: 0, message: '处于通道上半区，持仓观望' };
         } else {
             turtleSignal = { action: 'OBSERVE', breakoutPrice: 0, stopLoss: 0, takeProfit: 0, message: '处于通道下半区，弱势观察' };
         }
     }

     // --- NEW SCORING MODEL (0-100) ---
     
     // 1. Trend (35%)
     let trendScore = 0;
     const ma5 = latest.ma5 || 0;
     const ma10 = latest.ma10 || 0;
     const ma20 = latest.ma20 || 0;
     const ma60 = latest.ma60 || 0;
     
     if (ma5 > ma10 && ma10 > ma20) trendScore += 15;
     if (ma20 > ma60) trendScore += 15;
     if (latest.close > ma20) trendScore += 10;
     if (latest.close > ma60) trendScore += 10;
     if ((latest.ma20Slope || 0) > 0) trendScore += 10;
     if ((latest.ma60Slope || 0) > 0) trendScore += 10;
     if (isBreakout) trendScore += 20; // Bonus for breakout
     trendScore = Math.min(35, trendScore * (35/70));

     // 2. Momentum (30%)
     let momScore = 0;
     const macdVal = latest.macd?.macd || 0;
     const diff = latest.macd?.diff || 0;
     const dea = latest.macd?.dea || 0;
     if (macdVal > 0) momScore += 10;
     if (diff > dea) momScore += 10;
     
     const rsiVal = latest.rsi || 50;
     if (rsiVal > 50 && rsiVal < 80) momScore += 10;
     if (rsiVal >= 80) momScore -= 5;
     
     const k = latest.kdj?.k || 50;
     const dVal = latest.kdj?.d || 50;
     if (k > dVal) momScore += 10;
     if ((latest.roc || 0) > 0) momScore += 10;
     momScore = Math.min(30, momScore * (30/50));

     // 3. Volatility (15%)
     let volScore = 0;
     const wr = latest.wr || -50;
     if (wr > -80 && wr < -20) volScore += 10; 
     const bias = latest.bias || 0;
     if (bias > 0 && bias < 5) volScore += 10; 
     const boll = latest.boll;
     if (boll && latest.close > boll.mid && latest.close < boll.upper) volScore += 10;
     volScore = Math.min(15, volScore * (15/30));

     // 4. Volume (20%)
     let volumeScore = 0;
     if (latest.obv && latest.obvMa && latest.obv > latest.obvMa) volumeScore += 15;
     if (latest.volume > volAvg5) volumeScore += 10;
     if (latest.close > latest.open) volumeScore += 5; 
     volumeScore = Math.min(20, volumeScore * (20/30));

     // Total Score
     let finalScore = trendScore + momScore + volScore + volumeScore;
     
     // Bonus for Box Signal
     if (boxSignal && boxSignal.valid) {
         if (latest.close > boxSignal.entryPrice && latest.close < boxSignal.tpA) {
             finalScore += 15;
             buyFactors.push('箱体突破共振(Box Breakout)');
         }
     }

     // Bonus/Penalty for Advanced Signals
     if (buyFactors.includes('均线密集区向上突破(高胜率)')) finalScore += 20;
     if (buyFactors.includes('MACD底背离(下跌动能衰竭)')) finalScore += 15;
     if (buyFactors.includes('RSI底背离(下跌动能衰竭)')) finalScore += 10;
     if (buyFactors.includes('OBV能量潮突破(主力资金流入)')) finalScore += 10;
     if (buyFactors.includes('放量突破(多头强势)')) finalScore += 10;
     if (buyFactors.includes('突破布林带上轨(强势特征)')) finalScore += 10;
     if (buyFactors.includes('布林带极度收口(面临方向选择)')) finalScore += 5;
     if (buyFactors.includes('低位缩量企稳(抛压减轻)')) finalScore += 5;
     if (buyFactors.includes('ATR波动率极度收敛(面临变盘选择)')) finalScore += 5;

     if (sellFactors.includes('均线密集区向下破位(高风险)')) finalScore -= 20;
     if (sellFactors.includes('MACD顶背离(上涨动能衰竭)')) finalScore -= 15;
     if (sellFactors.includes('RSI顶背离(上涨动能衰竭)')) finalScore -= 10;
     if (sellFactors.includes('OBV能量潮跌破(主力资金流出)')) finalScore -= 10;
     if (sellFactors.includes('放量下跌(空头强势)')) finalScore -= 10;
     if (sellFactors.includes('跌破布林带下轨(弱势特征)')) finalScore -= 10;
     if (sellFactors.includes('高位放量滞涨(主力出货嫌疑)')) finalScore -= 10;
     
     if (rsiVal > 85) finalScore -= 10;
     if (trend === 'DOWN') finalScore -= 15;
     finalScore = Math.max(0, Math.min(100, Math.round(finalScore)));

     // Trade Suggestion Logic
     let suggestion: TradeSuggestion = 'WAIT';
     
     if (boxSignal && boxSignal.valid) {
         const p = latest.close;
         if (p < boxSignal.clearPrice) {
             suggestion = 'STOP_LOSS_CLEAR';
             sellFactors.push('跌破箱体下沿(Clearance)');
             finalScore = Math.min(finalScore, 20);
         }
         else if (p < boxSignal.slB) {
             suggestion = 'STOP_LOSS_CLEAR';
             sellFactors.push('触及止损B线');
             finalScore = Math.min(finalScore, 20);
         }
         else if (p < boxSignal.slA) {
             suggestion = 'STOP_LOSS_REDUCE';
             sellFactors.push('触及止损A线');
             finalScore = Math.min(finalScore, 30);
         }
         else if (p >= boxSignal.tpB) {
             suggestion = 'TAKE_PROFIT_CLEAR';
             sellFactors.push('达到止盈B目标');
         }
         else if (p >= boxSignal.tpA) {
             suggestion = 'TAKE_PROFIT_REDUCE';
             sellFactors.push('达到止盈A目标');
         }
         else if (p > boxSignal.entryPrice) {
             suggestion = 'HOLD';
         }
         else {
             suggestion = 'BUY_POINT';
         }
     } else if (turtleSignal) {
         if (turtleSignal.action === 'BUY') {
             suggestion = 'BUY_POINT';
             finalScore = Math.max(finalScore, 80);
         } else if (turtleSignal.action === 'SELL') {
             suggestion = 'STOP_LOSS_CLEAR';
             finalScore = Math.min(finalScore, 30);
         } else {
             if (finalScore >= 80) suggestion = 'BUY_POINT';
             else if (finalScore >= 60) suggestion = 'HOLD';
             else if (finalScore <= 35) suggestion = 'STOP_LOSS_REDUCE';
             else if (finalScore <= 20) suggestion = 'STOP_LOSS_CLEAR';
             else if (turtleSignal.action === 'OBSERVE') suggestion = 'OBSERVE';
         }
     } else {
         if (finalScore >= 80) suggestion = 'BUY_POINT';
         else if (finalScore >= 60) suggestion = 'HOLD';
         else if (finalScore <= 35) suggestion = 'STOP_LOSS_REDUCE';
         else if (finalScore <= 20) suggestion = 'STOP_LOSS_CLEAR';
     }

     return {
        ...item,
        currentPrice: latest.close,
        changePercent7d: (latest.close - (points[points.length - 6]?.close || latest.close)) / (points[points.length - 6]?.close || 1) * 100,
        isGolden,
        goldenPrice,
        breakMA5,
        breakMA20,
        breakDowntrend,
        isBreakout,
        isNearTrendline,
        isHighVolume,
        buySignals: buyFactors.length,
        sellSignals: sellFactors.length,
        buyFactors,
        sellFactors,
        trend,
        score: finalScore,
        health: Math.floor(finalScore * 0.8 + Math.random() * 15),
        suggestion,
        boxSignal,
        turtleSignal,
        lastUpdated: new Date().toLocaleTimeString(),
        history: points,
        suggestedEntryPrice: goldenPrice
     };
  }

  private calcIndicators(data: KlinePoint[]): KlinePoint[] {
      const results: KlinePoint[] = [];
      
      let ema12 = 0;
      let ema26 = 0;
      let dea = 0;
      let atr = 0;
      let avgGain = 0;
      let avgLoss = 0;
      let kValue = 50;
      let dValue = 50;
      let obv = 0;
      const obvHistory: number[] = [];

      for (let i = 0; i < data.length; i++) {
          const d = data[i];
          const close = d.close;
          const prev = i > 0 ? data[i-1] : null;
          
          // --- MAs ---
          const calcMa = (n: number) => {
              if (i < n - 1) return undefined;
              let sum = 0;
              for(let k=0; k<n; k++) sum += data[i-k].close;
              return sum / n;
          };
          const ma5 = calcMa(5);
          const ma10 = calcMa(10);
          const ma20 = calcMa(20);
          const ma60 = calcMa(60);
          
          let ma20Slope = 0;
          let ma60Slope = 0;
          if (i > 20 && ma20 && results[i-1]?.ma20) {
              ma20Slope = (ma20 - results[i-1].ma20!) / results[i-1].ma20! * 100;
          }
          if (i > 60 && ma60 && results[i-1]?.ma60) {
              ma60Slope = (ma60 - results[i-1].ma60!) / results[i-1].ma60! * 100;
          }

          // --- MACD ---
          if (i === 0) {
              ema12 = close;
              ema26 = close;
          } else {
              ema12 = (2 * close + 11 * ema12) / 13;
              ema26 = (2 * close + 25 * ema26) / 27;
          }
          const diff = ema12 - ema26;
          if (i === 0) dea = diff;
          else dea = (2 * diff + 8 * dea) / 10;
          const macd = 2 * (diff - dea);

          // --- ATR ---
          if (i === 0) atr = d.high - d.low;
          else {
              const tr = Math.max(d.high - d.low, Math.abs(d.high - prev!.close), Math.abs(d.low - prev!.close));
              atr = (atr * 13 + tr) / 14;
          }

          // --- Donchian Channel (Turtle) ---
          let donchian = undefined;
          if (i >= 19) {
              const slice20 = data.slice(i - 19, i + 1);
              const upper = Math.max(...slice20.map(p => p.high));
              const lower = Math.min(...slice20.map(p => p.low));
              const slice10 = data.slice(Math.max(0, i - 9), i + 1);
              const lower10 = Math.min(...slice10.map(p => p.low));
              donchian = { upper, lower, mid: (upper + lower) / 2, lower10 };
          }

          // --- BOLL ---
          let boll = undefined;
          if (ma20 && i >= 19) {
              let sumSq = 0;
              for (let k=0; k<20; k++) sumSq += Math.pow(data[i-k].close - ma20, 2);
              const std = Math.sqrt(sumSq / 20);
              boll = { upper: ma20 + 2 * std, mid: ma20, lower: ma20 - 2 * std, width: (4*std)/ma20 };
          }

          // --- RSI ---
          let rsi = undefined;
          if (i > 0) {
              const change = close - prev!.close;
              const gain = change > 0 ? change : 0;
              const loss = change < 0 ? -change : 0;
              if (i < 14) {
                  if (i === 1) { avgGain = gain; avgLoss = loss; }
                  else {
                      avgGain = (avgGain * (i-1) + gain) / i;
                      avgLoss = (avgLoss * (i-1) + loss) / i;
                  }
              } else {
                   avgGain = (avgGain * 13 + gain) / 14;
                   avgLoss = (avgLoss * 13 + loss) / 14;
                   if (avgLoss === 0) rsi = 100;
                   else rsi = 100 - (100 / (1 + avgGain / avgLoss));
              }
          }

          // --- KDJ ---
          let kdj = undefined;
          if (i >= 8) {
              let lowest = d.low;
              let highest = d.high;
              for(let j=0; j<9; j++) {
                  lowest = Math.min(lowest, data[i-j].low);
                  highest = Math.max(highest, data[i-j].high);
              }
              const rsv = (highest === lowest) ? 50 : (close - lowest) / (highest - lowest) * 100;
              kValue = (2/3) * kValue + (1/3) * rsv;
              dValue = (2/3) * dValue + (1/3) * kValue;
              kdj = { k: kValue, d: dValue, j: 3 * kValue - 2 * dValue };
          }

          // --- WR (14) ---
          let wr = undefined;
          if (i >= 13) {
              let h14 = -Infinity;
              let l14 = Infinity;
              for(let j=0; j<14; j++) {
                  h14 = Math.max(h14, data[i-j].high);
                  l14 = Math.min(l14, data[i-j].low);
              }
              wr = (h14 === l14) ? -50 : (h14 - close) / (h14 - l14) * -100;
          }

          // --- BIAS (20) ---
          let bias = undefined;
          if (ma20) bias = (close - ma20) / ma20 * 100;

          // --- ROC (12) ---
          let roc = undefined;
          if (i >= 12) {
              const ref = data[i-12].close;
              if (ref) roc = (close - ref) / ref * 100;
          }

          // --- MTM (12) ---
          let mtm = undefined;
          if (i >= 12) {
              mtm = close - data[i-12].close;
          }

          // --- OBV ---
          if (i > 0) {
              if (close > prev!.close) obv += d.volume;
              else if (close < prev!.close) obv -= d.volume;
          }
          obvHistory.push(obv);
          
          let obvMa = undefined;
          if (i >= 29) {
              let sumObv = 0;
              for(let k=0; k<30; k++) sumObv += obvHistory[i-k];
              obvMa = sumObv / 30;
          }

          results.push({
              ...d,
              ma5, ma10, ma20, ma60,
              ma20Slope, ma60Slope,
              macd: { diff, dea, macd },
              atr, donchian, boll, rsi, kdj,
              wr, bias, roc, mtm,
              obv, obvMa
          });
      }
      return results;
  }
}
