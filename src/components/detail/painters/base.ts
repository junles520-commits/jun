
import * as d3Raw from 'd3';
const d3 = d3Raw as any;
import { KlinePoint } from '../../../services/models';
import { SelectionGroup, ScaleBand, ScaleLinear, FibLevel, calculateLR } from './types';

// --- 1. Base Layer Painter (Candles, MAs) ---
export function drawBaseLayer(
    container: SelectionGroup,
    data: KlinePoint[],
    x: ScaleBand,
    y: ScaleLinear,
    width: number,
    options: { showMA5: boolean, showMA20: boolean, showMA60: boolean }
) {
    // Candles
    const candles = container.selectAll('.candle').data(data).enter().append('g').attr('class', 'candle');
    candles.append('line')
        .attr('x1', (d: any) => x(d.date)! + x.bandwidth() / 2)
        .attr('x2', (d: any) => x(d.date)! + x.bandwidth() / 2)
        .attr('y1', (d: any) => y(d.high))
        .attr('y2', (d: any) => y(d.low))
        .attr('stroke', (d: any) => d.close > d.open ? '#ef4444' : '#22c55e').attr('stroke-width', 1);
    candles.append('rect')
        .attr('x', (d: any) => x(d.date)!)
        .attr('y', (d: any) => y(Math.max(d.open, d.close)))
        .attr('width', x.bandwidth())
        .attr('height', (d: any) => Math.max(1, Math.abs(y(d.open) - y(d.close))))
        .attr('fill', (d: any) => d.close > d.open ? '#ef4444' : '#22c55e')
        .attr('stroke', (d: any) => d.close > d.open ? '#ef4444' : '#22c55e');

    // MAs
    const drawMA = (key: 'ma5' | 'ma20' | 'ma60', color: string) => {
        const maData = data.filter(d => d[key]);
        const maLine = d3.line()
            .x((d: any) => x(d.date)! + x.bandwidth() / 2)
            .y((d: any) => y(d[key] as number))
            .curve(d3.curveMonotoneX);
        container.append('path').datum(maData)
            .attr('fill', 'none').attr('stroke', color).attr('stroke-width', 1.5).attr('d', maLine);
    };

    if (options.showMA5) drawMA('ma5', '#a855f7');
    if (options.showMA20) drawMA('ma20', '#f97316');
    if (options.showMA60) drawMA('ma60', '#3b82f6');
}

// --- 2. Smart Lines Painter (Support/Resistance & Trend Strength) ---
export function drawSupRes(
    container: SelectionGroup,
    data: KlinePoint[],
    x: ScaleBand,
    y: ScaleLinear,
    width: number,
    svg: SelectionGroup // Need SVG for badges outside clip
) {
    const pivotWindow = 5; 
    const N = 10; 
    
    const pivots: {type: 'HIGH'|'LOW', x: number, y: number}[] = [];
    for(let i = pivotWindow; i < data.length - pivotWindow; i++) {
        const curr = data[i];
        const range = data.slice(i-pivotWindow, i+pivotWindow+1);
        if (range.every(d => d.high <= curr.high)) pivots.push({type: 'HIGH', x: i, y: curr.high});
        if (range.every(d => d.low >= curr.low)) pivots.push({type: 'LOW', x: i, y: curr.low});
    }

    const lows = pivots.filter(p => p.type === 'LOW').slice(-N); 
    if (lows.length >= 3) {
        const lr = calculateLR(lows);
        let validCount = 0;
        lows.forEach(p => {
            const predictedY = lr.slope * p.x + lr.intercept;
            if (Math.abs(p.y - predictedY)/predictedY <= 0.01) validCount++; // Slightly looser tolerance
        });

        if (validCount >= 2) { // Relaxed rule
            const x1 = 0; const x2 = data.length - 1;
            container.append('line')
                .attr('x1', 0).attr('x2', width)
                .attr('y1', y(lr.slope * x1 + lr.intercept))
                .attr('y2', y(lr.slope * x2 + lr.intercept))
                .attr('stroke', '#22c55e').attr('stroke-width', 1.5);
            container.append('text').attr('x', width-5).attr('y', y(lr.slope * x2 + lr.intercept)-5)
                .text('智能支撑').attr('fill', '#22c55e').attr('text-anchor', 'end').attr('font-size', '10px');
        }
    }

    const highs = pivots.filter(p => p.type === 'HIGH').slice(-N);
    if (highs.length >= 3) {
        const lr = calculateLR(highs);
        let validCount = 0;
        highs.forEach(p => {
            const predictedY = lr.slope * p.x + lr.intercept;
            if (Math.abs(p.y - predictedY)/predictedY <= 0.01) validCount++;
        });

        if (validCount >= 2) {
            const x1 = 0; const x2 = data.length - 1;
            container.append('line')
                .attr('x1', 0).attr('x2', width)
                .attr('y1', y(lr.slope * x1 + lr.intercept))
                .attr('y2', y(lr.slope * x2 + lr.intercept))
                .attr('stroke', '#ef4444').attr('stroke-width', 1.5);
            container.append('text').attr('x', width-5).attr('y', y(lr.slope * x2 + lr.intercept)-5)
                .text('智能压力').attr('fill', '#ef4444').attr('text-anchor', 'end').attr('font-size', '10px');
        }
    }

    // Trend Strength Badge
    const closePoints = data.map((d, i) => ({x: i, y: d.close}));
    const trendLR = calculateLR(closePoints);
    const lastPrice = data[data.length-1].close;
    const pctSlope = (trendLR.slope / lastPrice) * 100;
    
    let strength = 'WEAK';
    let trendType = 'SIDEWAYS';
    let color = '#94a3b8';

    const lastPt = data[data.length-1];
    const ma20 = lastPt.ma20 || 0;
    
    if (pctSlope > 0) {
        if (lastPt.close > ma20) {
            trendType = 'UP';
            if (pctSlope >= 0.3) { strength = 'STRONG'; color = '#ef4444'; } 
            else { strength = 'NORMAL'; color = '#f87171'; }
        }
    } else {
        if (lastPt.close < ma20) {
            trendType = 'DOWN';
            if (Math.abs(pctSlope) >= 0.3) { strength = 'STRONG'; color = '#16a34a'; }
            else { strength = 'NORMAL'; color = '#4ade80'; }
        }
    }

    if (trendType !== 'SIDEWAYS') {
        const badgeGroup = svg.append('g').attr('transform', `translate(10, 50)`); 
        badgeGroup.append('rect').attr('width', 130).attr('height', 24).attr('rx', 4).attr('fill', color).attr('opacity', 0.1);
        badgeGroup.append('rect').attr('width', 3).attr('height', 24).attr('fill', color);
        badgeGroup.append('text').attr('x', 10).attr('y', 16)
            .text(`${trendType === 'UP' ? '上升' : '下降'}趋势: ${strength === 'STRONG' ? '强' : '普通'}`)
            .attr('fill', color).attr('font-size', '11px').attr('font-weight', 'bold');
    }
}

// --- 3. Trend Channel Painter ---
export function drawTrendChannel(
    container: SelectionGroup,
    data: KlinePoint[],
    x: ScaleBand,
    y: ScaleLinear,
    width: number
) {
    const trendData = data; 
    const fractalWindow = Math.max(2, Math.floor(trendData.length / 30)); 
    
    const highs: {x: number, y: number}[] = [];
    const lows: {x: number, y: number}[] = [];
    
    for (let i = fractalWindow; i < trendData.length - fractalWindow; i++) {
        const current = trendData[i];
        const range = trendData.slice(i - fractalWindow, i + fractalWindow + 1);
        if (range.every(d => d.low >= current.low)) lows.push({ x: i, y: current.low });
        if (range.every(d => d.high <= current.high)) highs.push({ x: i, y: current.high });
    }
    
    if (lows.length >= 2 && highs.length >= 2) {
        const allPoints = trendData.map((d, i) => ({x: i, y: d.close}));
        const globalLR = calculateLR(allPoints);
        const isUptrend = globalLR.slope > 0;

        let m = 0; 
        let b_support = 0; 
        let b_resistance = 0;
        
        // Simplified Logic for robustness
        if (isUptrend) {
            m = calculateLR(lows).slope;
            b_support = Math.min(...lows.map(p => p.y - m * p.x));
            b_resistance = Math.max(...highs.map(p => p.y - m * p.x));
        } else {
            m = calculateLR(highs).slope;
            b_resistance = Math.max(...highs.map(p => p.y - m * p.x));
            b_support = Math.min(...lows.map(p => p.y - m * p.x));
        }
        
        const fillColor = isUptrend ? '#fee2e2' : '#dcfce7'; 
        const strokeColor = isUptrend ? '#ef4444' : '#22c55e'; 

        const x1 = 0; const x2 = trendData.length - 1;
        const areaPoints = [ 
            { x: 0, y: m * x1 + b_resistance }, 
            { x: width, y: m * x2 + b_resistance }, 
            { x: width, y: m * x2 + b_support }, 
            { x: 0, y: m * x1 + b_support } 
        ];
        
        const areaGen = d3.line().x((d: any) => d.x).y((d: any) => y(d.y));
        container.append('path').datum(areaPoints).attr('d', areaGen).attr('fill', fillColor).attr('fill-opacity', 0.2).attr('stroke', 'none');
        
        const drawLine = (b: number, color: string) => { 
            container.append('line')
                .attr('x1', 0).attr('x2', width)
                .attr('y1', y(m * x1 + b)).attr('y2', y(m * x2 + b))
                .attr('stroke', color).attr('stroke-width', 1.5).attr('stroke-dasharray', '4,4').attr('opacity', 0.8); 
        };
        drawLine(b_resistance, strokeColor); 
        drawLine(b_support, strokeColor);
    }
}

// --- 9. Sub Charts (Volume & MACD) ---
export function drawSubCharts(
    volGroup: SelectionGroup,
    macdGroup: SelectionGroup,
    data: KlinePoint[],
    x: ScaleBand,
    yVol: ScaleLinear,
    yMacd: ScaleLinear,
    volH: number,
    macdH: number,
    width: number,
    macdTop: number
) {
    // Volume
    volGroup.selectAll('.vol-bar').data(data).enter().append('rect')
        .attr('x', (d: any) => x(d.date)!)
        .attr('y', (d: any) => yVol(d.volume))
        .attr('width', x.bandwidth())
        .attr('height', (d: any) => volH - yVol(d.volume))
        .attr('fill', (d: any) => d.close > d.open ? '#f87171' : '#4ade80');

    // MACD
    macdGroup.append('rect').attr('width', width).attr('height', macdH).attr('fill', '#f8fafc').attr('opacity', 0.5);
    macdGroup.append('line').attr('x1', 0).attr('x2', width).attr('y1', yMacd(0)).attr('y2', yMacd(0)).attr('stroke', '#cbd5e1').attr('stroke-width', 1).attr('stroke-dasharray', '3,3');
    macdGroup.selectAll('.macd-bar').data(data).enter().append('rect')
        .attr('x', (d: any) => x(d.date)!)
        .attr('y', (d: any) => { const val = d.macd?.macd || 0; return val >= 0 ? yMacd(val) : yMacd(0); })
        .attr('width', x.bandwidth())
        .attr('height', (d: any) => { const val = d.macd?.macd || 0; return Math.abs(yMacd(val) - yMacd(0)); })
        .attr('fill', (d: any) => (d.macd?.macd || 0) >= 0 ? '#ef4444' : '#22c55e').attr('opacity', 0.8);
    
    const lineDiff = d3.line().x((d: any) => x(d.date)! + x.bandwidth()/2).y((d: any) => yMacd(d.macd?.diff || 0));
    const lineDea = d3.line().x((d: any) => x(d.date)! + x.bandwidth()/2).y((d: any) => yMacd(d.macd?.dea || 0));
    
    macdGroup.append('path').datum(data).attr('fill', 'none').attr('stroke', '#3b82f6').attr('stroke-width', 1.5).attr('d', lineDiff);
    macdGroup.append('path').datum(data).attr('fill', 'none').attr('stroke', '#f59e0b').attr('stroke-width', 1.5).attr('d', lineDea);
}

// --- 10. Fibonacci Painter ---
export function drawFibonacci(
    container: SelectionGroup,
    levels: FibLevel[],
    width: number,
    y: ScaleLinear,
    yMin: number,
    yMax: number
) {
    // 1. Draw Extension Background Zones
    // Find the base (0% or 100% depending on trend) and the furthest extension
    const baseLevel = levels.find(l => l.isBase);
    const extensions = levels.filter(l => l.isExtension);
    
    if (baseLevel && extensions.length > 0) {
        // Sort extensions by value
        const sortedExt = [...extensions].sort((a,b) => a.val - b.val);
        const furthestExt = sortedExt[baseLevel.val < sortedExt[0].val ? sortedExt.length - 1 : 0]; // Determine direction
        
        // Define zone from Base to Furthest Extension
        const yBase = y(baseLevel.val);
        const yExt = y(furthestExt.val);
        
        // Calculate bounded rect for display
        const topY = Math.min(yBase, yExt);
        const bottomY = Math.max(yBase, yExt);
        
        // Color based on trend? Extensions usually mean targets. 
        const isUpTarget = furthestExt.val > baseLevel.val;
        const zoneColor = isUpTarget ? '#fee2e2' : '#dcfce7'; 
        
        container.append('rect')
            .attr('x', 0)
            .attr('width', width)
            .attr('y', topY)
            .attr('height', Math.max(1, bottomY - topY))
            .attr('fill', zoneColor)
            .attr('opacity', 0.2); 
    }

    // 2. Draw Lines & Text
    levels.forEach(fib => {
       // Only draw if within visible range (loosely)
       if (fib.val >= yMin * 0.5 && fib.val <= yMax * 1.5) { // Allow some overflow drawing
         const yPos = y(fib.val);
         
         container.append('line')
            .attr('x1', 0).attr('x2', width)
            .attr('y1', yPos).attr('y2', yPos)
            .attr('stroke', fib.color)
            .attr('stroke-width', fib.dash === '5,3' ? 1.5 : 1)
            .attr('stroke-dasharray', fib.dash)
            .attr('opacity', 0.8);
            
         const text = `${fib.label}: ${fib.val.toFixed(3)}`;
         container.append('text')
            .attr('x', width - 5)
            .attr('y', yPos - 3)
            .attr('text-anchor', 'end')
            .attr('font-size', '10px')
            .attr('fill', fib.color)
            .attr('font-weight', 'bold')
            .text(text);
       }
    });
}
