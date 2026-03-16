import { GoogleGenAI } from '@google/genai';

const FEISHU_APP_ID = 'cli_a93fba04b8789bb5';
const FEISHU_APP_SECRET = 'H7C81LLfgBe6xYPsZRopbc6EpJelyK4V';

async function getFeishuAccessToken() {
    const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            app_id: FEISHU_APP_ID,
            app_secret: FEISHU_APP_SECRET
        })
    });
    const data = await res.json();
    if (data.code !== 0) {
        console.error('Error getting Feishu token:', data);
        throw new Error(`Feishu token error: ${data.msg}`);
    }
    return data.tenant_access_token;
}

async function replyFeishuMessage(messageId: string, text: string) {
    try {
        const token = await getFeishuAccessToken();
        const res = await fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/reply`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: JSON.stringify({ text }),
                msg_type: 'text'
            })
        });
        const data = await res.json();
        if (data.code !== 0) {
            console.error('Error replying to Feishu message:', data);
        } else {
            console.log('Successfully replied to Feishu message:', messageId);
        }
    } catch (err) {
        console.error('Exception in replyFeishuMessage:', err);
    }
}

async function fetchStockData(code: string) {
    const market = (code.startsWith('5') || code.startsWith('6')) ? '1' : '0';
    const secid = `${market}.${code}`;
    
    const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=101&fqt=1&end=20500101&lmt=100`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (!data || !data.data || !data.data.klines) {
        return null;
    }
    
    const klines = data.data.klines.map((k: string) => {
        const parts = k.split(',');
        return {
            date: parts[0],
            open: parseFloat(parts[1]),
            close: parseFloat(parts[2]),
            high: parseFloat(parts[3]),
            low: parseFloat(parts[4]),
            volume: parseFloat(parts[5]),
            amount: parseFloat(parts[6])
        };
    });
    
    return {
        code,
        name: data.data.name,
        klines
    };
}

export async function processFeishuMessage(text: string, messageId: string) {
    try {
        // Extract ETF code (6 digits)
        const match = text.match(/\d{6}/);
        if (!match) {
            await replyFeishuMessage(messageId, '请提供有效的6位ETF代码（通常以5或1开头），例如：510300');
            return;
        }
        
        const code = match[0];
        await replyFeishuMessage(messageId, `正在为您分析 ETF ${code}，请稍候...`);
        
        const stockData = await fetchStockData(code);
        if (!stockData || stockData.klines.length < 2) {
            await replyFeishuMessage(messageId, `抱歉，未能获取到ETF代码 ${code} 的足够行情数据。`);
            return;
        }
        
        const latest = stockData.klines[stockData.klines.length - 1];
        const prev = stockData.klines[stockData.klines.length - 2];
        const changePercent = ((latest.close - prev.close) / prev.close) * 100;
        
        // Calculate simple MAs
        const calcMa = (n: number) => {
            if (stockData.klines.length < n) return null;
            let sum = 0;
            for(let i = 0; i < n; i++) sum += stockData.klines[stockData.klines.length - 1 - i].close;
            return sum / n;
        };
        const ma5 = calcMa(5);
        const ma20 = calcMa(20);
        const ma60 = calcMa(60);
        
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
        
        const prompt = `
你是一位资深量化分析师和ETF基金研究专家。用户查询了ETF代码：${stockData.code} (${stockData.name})。
最新交易日数据：
- 日期：${latest.date}
- 收盘价：${latest.close}
- 涨跌幅：${changePercent.toFixed(2)}%
- 最高价：${latest.high}
- 最低价：${latest.low}
- 成交量：${latest.volume}
- 5日均线：${ma5 ? ma5.toFixed(3) : 'N/A'}
- 20日均线：${ma20 ? ma20.toFixed(3) : 'N/A'}
- 60日均线：${ma60 ? ma60.toFixed(3) : 'N/A'}

请根据以上数据，并使用 googleSearch 工具搜索该ETF的跟踪指数、最新资讯、资金流向（如份额增减）和宏观基本面情况，生成一份专业的ETF行情分析报告及买卖建议。
报告需包含以下部分，请严格按照此结构输出：

### 🤖 AI 量化交易计划
- **综合评级**：(例如：强烈推荐、推荐、中性、回避)
- **风险等级**：(例如：高、中、低)
- **操作建议**：(例如：定投买入、网格交易、持有待涨、逢高减仓、清仓)
- **目标价**：(给出具体数值或区间)
- **止损价**：(给出具体数值)

### 📊 技术面买卖信号分析
- **买入信号**：(列出当前支持买入的技术因子，如均线多头、突破压力位等)
- **卖出信号**：(列出当前支持卖出的技术因子，如跌破支撑、指标死叉等)

### 📰 核心资讯与基本面摘要
(总结该ETF跟踪指数的近期重要新闻、政策、行业景气度或资金面变化)

### 📈 行情分析与综合建议
(结合技术面、资金面和基本面，给出详细的分析逻辑和最终建议，可提及折溢价情况或定投策略)

请直接输出 Markdown 格式的报告内容。
`;

        const response = await ai.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }]
            }
        });
        
        const report = response.text || '分析生成失败。';
        await replyFeishuMessage(messageId, report);
        
    } catch (error) {
        console.error('Feishu processing error:', error);
        await replyFeishuMessage(messageId, '抱歉，分析过程中出现错误，请稍后再试。');
    }
}
