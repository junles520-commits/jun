
export interface ETFDefinition {
  code: string;
  name: string;
  industry: string; // Dynamic industry classification
  marketCap?: number; // Total Market Cap (fallback for Scale)

  // Real-time snapshot fields (optional as they come from API)
  snapshotPrice?: number;
  snapshotChangePercent?: number;
  snapshotVolume?: number;
  snapshotHigh?: number;
  snapshotLow?: number;
  snapshotOpen?: number;
}

// Comprehensive list of monitored ETFs
export const ETF_LIST: ETFDefinition[] = [
  // 一、宽基ETF（一级+二级细分）
  { code: '510300', name: '沪深300ETF华泰柏瑞', industry: '宽基-沪深300' },
  { code: '510050', name: '上证50ETF', industry: '宽基-上证50' },
  { code: '510500', name: '中证500ETF', industry: '宽基-中证500' },
  { code: '512100', name: '中证1000ETF', industry: '宽基-中证1000' },
  { code: '563360', name: 'A500ETF华泰柏瑞', industry: '宽基-中证A500' },
  { code: '563080', name: '中证A50ETF易方达', industry: '宽基-中证A50' },
  { code: '563300', name: '中证2000ETF', industry: '宽基-中证2000' },
  { code: '588000', name: '科创50ETF', industry: '宽基-科创50' },
  { code: '588880', name: '科创100ETF华泰柏瑞', industry: '宽基-科创100' },
  { code: '159915', name: '创业板ETF易方达', industry: '宽基-创业板' },
  { code: '588380', name: '双创50ETF', industry: '宽基-双创50' },
  { code: '159920', name: '恒生ETF', industry: '宽基-恒生指数' },
  { code: '513050', name: '中概互联网ETF易方达', industry: '宽基-中概互联' },
  { code: '513130', name: '恒生科技ETF', industry: '宽基-恒生科技' },
  { code: '513100', name: '纳指ETF', industry: '宽基-纳斯达克' },
  { code: '513500', name: '标普500ETF', industry: '宽基-标普500' },
  { code: '510880', name: '红利ETF', industry: '宽基-红利指数' },
  { code: '159266', name: '港股通央企红利ETF', industry: '宽基-港股央企红利' },

  // 二、行业/主题ETF（一级行业-二级行业）
  // 科技类
  { code: '512480', name: '半导体ETF', industry: '科技-半导体/芯片' },
  { code: '159819', name: '人工智能ETF易方达', industry: '科技-人工智能' },
  { code: '515880', name: '通信ETF', industry: '科技-通信/5G' },
  { code: '159852', name: '软件ETF', industry: '科技-软件' },
  { code: '159851', name: '金融科技ETF', industry: '科技-金融科技' },
  { code: '159890', name: '云计算ETF', industry: '科技-云计算' },

  // 新能源类
  { code: '515790', name: '光伏ETF', industry: '新能源-光伏' },
  { code: '159840', name: '锂电池ETF', industry: '新能源-锂电池' },
  { code: '515030', name: '新能源车ETF', industry: '新能源-新能车' },
  { code: '159755', name: '电池ETF', industry: '新能源-通用电池' },
  { code: '159625', name: '绿色电力ETF', industry: '新能源-绿电' },
  { code: '159790', name: '碳中和ETF', industry: '新能源-碳中和' },

  // 医药医疗类
  { code: '512010', name: '医药ETF易方达', industry: '医药-通用医药' },
  { code: '512170', name: '医疗ETF', industry: '医药-医疗服务' },
  { code: '159992', name: '创新药ETF', industry: '医药-创新药' },
  { code: '560080', name: '中药ETF', industry: '医药-中药' },
  { code: '159883', name: '医疗器械ETF', industry: '医药-医疗器械' },
  { code: '159859', name: '生物医药ETF', industry: '医药-生物医药' },

  // 周期资源类
  { code: '518880', name: '黄金ETF', industry: '周期-黄金/贵金属' },
  { code: '512400', name: '有色金属ETF', industry: '周期-有色金属' },
  { code: '516150', name: '稀土ETF嘉实', industry: '周期-稀土' },
  { code: '159518', name: '标普油气ETF', industry: '周期-油气' },
  { code: '515220', name: '煤炭ETF', industry: '周期-煤炭' },
  { code: '510410', name: '资源ETF', industry: '周期-综合资源' },

  // 制造装备类
  { code: '512710', name: '军工龙头ETF', industry: '制造-军工' },
  { code: '562500', name: '机器人ETF', industry: '制造-机器人' },
  { code: '159206', name: '卫星ETF', industry: '制造-卫星产业' },
  { code: '159663', name: '机床ETF', industry: '制造-工业母机' },
  { code: '560280', name: '工程机械ETF', industry: '制造-工程机械' },

  // 金融类
  { code: '512880', name: '证券ETF', industry: '金融-证券/券商' },
  { code: '512800', name: '银行ETF', industry: '金融-银行' },
  { code: '512070', name: '证券保险ETF易方达', industry: '金融-保险' },

  // 消费类
  { code: '159928', name: '消费ETF', industry: '消费-综合消费' },
  { code: '515170', name: '食品饮料ETF', industry: '消费-食品饮料' },
  { code: '159996', name: '家电ETF', industry: '消费-家电' },
  { code: '159732', name: '消费电子ETF', industry: '消费-消费电子' },
  { code: '512690', name: '酒ETF', industry: '消费-酒类' },
  { code: '159766', name: '旅游ETF', industry: '消费-旅游' },

  // 传媒文娱类
  { code: '512980', name: '传媒ETF', industry: '传媒-综合传媒' },
  { code: '159869', name: '游戏ETF', industry: '传媒-游戏' },
  { code: '159855', name: '影视ETF', industry: '传媒-影视' },

  // 地产基建类
  { code: '512200', name: '房地产ETF', industry: '地产基建-房地产' },
  { code: '516950', name: '基建ETF', industry: '地产基建-基建' },
  { code: '159745', name: '建材ETF', industry: '地产基建-建材' },

  // 其他特色品类
  { code: '159201', name: '自由现金流ETF', industry: '特色-现金流' },
  { code: '159825', name: '农业ETF', industry: '特色-农业' },
  { code: '159867', name: '畜牧ETF', industry: '特色-畜牧养殖' }

];
