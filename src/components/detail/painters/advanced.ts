
import * as d3Raw from 'd3';
const d3 = d3Raw as any;
import { KlinePoint, BoxSignal } from '../../../services/models';
import { SelectionGroup, ScaleBand, ScaleLinear, calculateLR } from './types';

// --- 5. Donchian Channel (Turtle) Painter ---
export function drawDonchianChannel(
    container: SelectionGroup,
    data: KlinePoint[],
    x: ScaleBand,
    y: ScaleLinear,
    width: number
) {
    const validData = data.filter(d => d.donchian);
    if (validData.length === 0) return;

    // Area between Upper and Lower
    const areaGen = d3.area()
        .x((d: any) => x(d.date)! + x.bandwidth() / 2)
        .y0((d: any) => y(d.donchian.lower))
        .y1((d: any) => y(d.donchian.upper));

    container.append('path')
        .datum(validData)
        .attr('fill', '#3b82f6') // Blue
        .attr('opacity', 0.05)
        .attr('d', areaGen);

    // Upper Line
    const upperGen = d3.line()
        .x((d: any) => x(d.date)! + x.bandwidth() / 2)
        .y((d: any) => y(d.donchian.upper));
    
    container.append('path')
        .datum(validData)
        .attr('fill', 'none')
        .attr('stroke', '#3b82f6')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,4')
        .attr('d', upperGen);

    // Lower Line
    const lowerGen = d3.line()
        .x((d: any) => x(d.date)! + x.bandwidth() / 2)
        .y((d: any) => y(d.donchian.lower));
    
    container.append('path')
        .datum(validData)
        .attr('fill', 'none')
        .attr('stroke', '#ef4444')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,4')
        .attr('d', lowerGen);

    // Mid Line
    const midGen = d3.line()
        .x((d: any) => x(d.date)! + x.bandwidth() / 2)
        .y((d: any) => y(d.donchian.mid));
    
    container.append('path')
        .datum(validData)
        .attr('fill', 'none')
        .attr('stroke', '#94a3b8')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '2,2')
        .attr('d', midGen);

    // Lower 10 Line (Exit)
    const lower10Gen = d3.line()
        .x((d: any) => x(d.date)! + x.bandwidth() / 2)
        .y((d: any) => y(d.donchian.lower10));
    
    container.append('path')
        .datum(validData)
        .attr('fill', 'none')
        .attr('stroke', '#f97316') // Orange
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '2,2')
        .attr('d', lower10Gen);

    // Calculate Extended Indicators: ATR(20), MA20, MA200, High55, Low20
    const dataExt = validData.map((d, i) => {
        let tr = d.high - d.low;
        if (i > 0) {
            const prevClose = validData[i-1].close;
            tr = Math.max(tr, Math.abs(d.high - prevClose), Math.abs(d.low - prevClose));
        }
        return { ...d, tr, atr: 0, ma20: 0, ma200: 0, high55: 0, low20: 0 };
    });

    for (let i = 0; i < dataExt.length; i++) {
        // ATR(20)
        if (i >= 19) {
            let sumTR = 0;
            for (let j = i - 19; j <= i; j++) sumTR += dataExt[j].tr;
            dataExt[i].atr = sumTR / 20;
        } else if (i > 0) {
            let sumTR = 0;
            for (let j = 0; j <= i; j++) sumTR += dataExt[j].tr;
            dataExt[i].atr = sumTR / (i + 1);
        } else {
            dataExt[i].atr = dataExt[i].tr;
        }

        // MA20
        if (i >= 19) {
            let sum = 0;
            for (let j = i - 19; j <= i; j++) sum += dataExt[j].close;
            dataExt[i].ma20 = sum / 20;
        }

        // MA200
        if (i >= 199) {
            let sum = 0;
            for (let j = i - 199; j <= i; j++) sum += dataExt[j].close;
            dataExt[i].ma200 = sum / 200;
        } else {
            let sum = 0;
            for (let j = 0; j <= i; j++) sum += dataExt[j].close;
            dataExt[i].ma200 = sum / (i + 1);
        }

        // High55
        if (i >= 54) {
            let max = -Infinity;
            for (let j = i - 54; j <= i; j++) max = Math.max(max, dataExt[j].high);
            dataExt[i].high55 = max;
        } else {
            let max = -Infinity;
            for (let j = 0; j <= i; j++) max = Math.max(max, dataExt[j].high);
            dataExt[i].high55 = max;
        }

        // Low20
        if (i >= 19) {
            let min = Infinity;
            for (let j = i - 19; j <= i; j++) min = Math.min(min, dataExt[j].low);
            dataExt[i].low20 = min;
        } else {
            let min = Infinity;
            for (let j = 0; j <= i; j++) min = Math.min(min, dataExt[j].low);
            dataExt[i].low20 = min;
        }
    }

    // Draw Signals
    let position: {
        system: 1 | 2,
        entryPrice: number,
        lastEntryPrice: number,
        units: number,
        N: number,
        reduced: boolean
    } | null = null;

    let lastSystem1TradeProfit = 0;

    const drawIcon = (px: number, py: number, icon: string, color: string, label: string, labelPos: 'top' | 'bottom' = 'top') => {
        const g = container.append('g').attr('transform', `translate(${px}, ${py})`);
        g.append('text')
            .text(icon)
            .attr('font-size', '14px')
            .attr('text-anchor', 'middle');
        g.append('text')
            .text(label)
            .attr('y', labelPos === 'top' ? -12 : 16)
            .attr('fill', color)
            .attr('font-size', '9px')
            .attr('text-anchor', 'middle')
            .attr('font-weight', 'bold');
    };

    dataExt.forEach((d, i) => {
        if (i === 0) return;
        const prev = dataExt[i-1];
        const px = x(d.date)! + x.bandwidth() / 2;
        const currentN = prev.atr || d.atr;

        if (!position) {
            // Observation & Entry Phase
            // Filter: Only consider long if Price > MA200
            if (d.close > prev.ma200) {
                const useSystem2 = lastSystem1TradeProfit > 0;

                if (!useSystem2) {
                    // System 1 (20-day breakout)
                    if (d.close > prev.donchian!.upper) {
                        drawIcon(px, y(d.low) + 15, '🚀', '#ef4444', 'S1建仓', 'bottom');
                        position = { system: 1, entryPrice: d.close, lastEntryPrice: d.close, units: 1, N: currentN, reduced: false };
                    } else if (d.close > prev.donchian!.upper - 0.5 * currentN) {
                        const prevPrev = i > 1 ? dataExt[i-2] : null;
                        if (!prevPrev || !(prev.close > prevPrev.donchian!.upper - 0.5 * currentN)) {
                            drawIcon(px, y(d.high) - 15, '👁️', '#a855f7', '观察', 'top');
                        }
                    }
                } else {
                    // System 2 (55-day breakout)
                    if (d.close > prev.high55) {
                        drawIcon(px, y(d.low) + 15, '🚀', '#ef4444', 'S2建仓', 'bottom');
                        position = { system: 2, entryPrice: d.close, lastEntryPrice: d.close, units: 1, N: currentN, reduced: false };
                    } else if (d.close > prev.high55 - 0.5 * currentN) {
                        const prevPrev = i > 1 ? dataExt[i-2] : null;
                        if (!prevPrev || !(prev.close > prevPrev.high55 - 0.5 * currentN)) {
                            drawIcon(px, y(d.high) - 15, '👁️', '#a855f7', '观察', 'top');
                        }
                    }
                }
            }
        } else {
            // In Position Phase
            const stopLossPrice = position.lastEntryPrice - 2 * position.N;

            // 1. Stop Loss (Iron Rule: Last Entry - 2N)
            if (d.close < stopLossPrice) {
                drawIcon(px, y(d.high) - 15, '🛡️', '#22c55e', '止损', 'top');
                if (position.system === 1) {
                    lastSystem1TradeProfit = d.close - position.entryPrice;
                }
                position = null;
            }
            // 2. System Exit (S1: 10-day low, S2: 20-day low)
            else if (position.system === 1 && d.close < prev.donchian!.lower10) {
                drawIcon(px, y(d.high) - 15, '❌', '#22c55e', 'S1清仓', 'top');
                lastSystem1TradeProfit = d.close - position.entryPrice;
                position = null;
            }
            else if (position.system === 2 && d.close < prev.low20) {
                drawIcon(px, y(d.high) - 15, '❌', '#22c55e', 'S2清仓', 'top');
                position = null;
            }
            // 3. Take Profit (Deviation > 5N from MA20)
            else if (!position.reduced && (d.close - prev.ma20) > 5 * position.N) {
                drawIcon(px, y(d.high) - 15, '🎯', '#f59e0b', '减仓止盈', 'top');
                position.reduced = true;
            }
            // 4. Add Position (Every +0.5N, Max 4 Units)
            else if (position.units < 4 && d.close > position.lastEntryPrice + 0.5 * position.N) {
                drawIcon(px, y(d.low) + 15, '➕', '#3b82f6', '加仓', 'bottom');
                position.lastEntryPrice = d.close;
                position.units += 1;
            }
        }
    });
}
export function drawVolumeProfile(
    container: SelectionGroup,
    data: KlinePoint[],
    x: ScaleBand,
    y: ScaleLinear,
    width: number
) {
    const yMin = y.domain()[0];
    const yMax = y.domain()[1];
    const binCount = 50;
    const binSize = (yMax - yMin) / binCount;
    const bins = new Array(binCount).fill(0);
    let maxVolBin = 0;
    let maxVolIdx = 0;

    data.forEach(d => {
        const idx = Math.floor((d.close - yMin) / binSize);
        if (idx >= 0 && idx < binCount) {
            bins[idx] += d.volume;
            if (bins[idx] > maxVolBin) {
                maxVolBin = bins[idx];
                maxVolIdx = idx;
            }
        }
    });

    const pocPrice = yMin + (maxVolIdx + 0.5) * binSize;
    const maxBarWidth = width * 0.2; 
    const vpGroup = container.append('g').attr('transform', `translate(${width}, 0)`);
    
    bins.forEach((vol, i) => {
        const barW = (vol / maxVolBin) * maxBarWidth;
        const barY = y(yMin + (i+1)*binSize);
        const barH = Math.abs(y(yMin + i*binSize) - barY);
        
        vpGroup.append('rect')
            .attr('x', -barW)
            .attr('y', barY)
            .attr('width', barW)
            .attr('height', barH)
            .attr('fill', i === maxVolIdx ? '#eab308' : '#64748b') 
            .attr('opacity', i === maxVolIdx ? 0.4 : 0.1);
    });

    container.append('line')
        .attr('x1', 0).attr('x2', width)
        .attr('y1', y(pocPrice)).attr('y2', y(pocPrice))
        .attr('stroke', '#eab308').attr('stroke-width', 1.5).attr('stroke-dasharray', '4,2');
    
    container.append('text')
        .attr('x', width - 5).attr('y', y(pocPrice) - 4)
        .text('POC (筹码峰)').attr('fill', '#eab308')
        .attr('font-size', '10px').attr('font-weight', 'bold').attr('text-anchor', 'end');

    // ZigZag / Wave Theory
    const zigzag = calculateZigZag(data);

    const lineGen = d3.line()
        .x((d: any) => x(d.date)! + x.bandwidth()/2)
        .y((d: any) => y(d.y));
        
    // Draw Thin Black Lines for Segments
    container.append('path')
        .datum(zigzag)
        .attr('fill', 'none')
        .attr('stroke', '#000000') 
        .attr('stroke-width', 1)
        .attr('opacity', 0.8)
        .attr('d', (d: any) => lineGen(d.map((p: any) => ({x: p.x, y: p.y, date: p.date}))));

    // Draw Wave Labels (1, 2, 3, 4, 5, A, B, C)
    const waveLabels = ['1', '2', '3', '4', '5', 'A', 'B', 'C'];

    if (zigzag.length > 0) {
        zigzag.forEach((p, idx) => {
            const px = x(p.date)! + x.bandwidth()/2;
            const py = y(p.y);
            const label = waveLabels[idx % waveLabels.length];
            
            // Offset logic: HIGH above candle, LOW below candle
            const yOffset = p.type === 'HIGH' ? -15 : 15;

            const g = container.append('g').attr('transform', `translate(${px}, ${py + yOffset})`);
            
            // Purple Hollow Circle
            g.append('circle')
                .attr('r', 7)
                .attr('fill', 'white')
                .attr('stroke', '#a855f7') // Purple
                .attr('stroke-width', 1.5);
            
            // Text inside circle
            g.append('text')
                .text(label)
                .attr('dy', '0.35em')
                .attr('text-anchor', 'middle')
                .attr('fill', '#a855f7')
                .attr('font-size', '9px')
                .attr('font-weight', 'bold');
        });
    }
}

// --- 5. Resonance Signal Painter (Box Strategy) ---
export function drawResonanceSignal(
    container: SelectionGroup,
    signal: BoxSignal,
    x: ScaleBand,
    y: ScaleLinear,
    width: number
) {
    if (!signal || !signal.valid) return;

    const boxStartX = x(signal.boxStartDate);
    const obsX = x(signal.obsDate);
    const entryX = x(signal.date);
    const yHigh = y(signal.boxHigh);
    const yLow = y(signal.boxLow);
    const yPoc = y(signal.poc);
    const lineStart = boxStartX !== undefined ? boxStartX : (entryX !== undefined ? 0 : 0);
    
    if (entryX !== undefined || (boxStartX !== undefined)) {
            container.append('line').attr('x1', lineStart).attr('x2', width).attr('y1', yLow).attr('y2', yLow).attr('stroke', '#334155').attr('stroke-width', 2).attr('stroke-opacity', 0.8);
            container.append('line').attr('x1', lineStart).attr('x2', width).attr('y1', yHigh).attr('y2', yHigh).attr('stroke', '#334155').attr('stroke-width', 2).attr('stroke-opacity', 0.8);
            container.append('line').attr('x1', lineStart).attr('x2', width).attr('y1', yPoc).attr('y2', yPoc).attr('stroke', '#f97316').attr('stroke-width', 1).attr('stroke-dasharray', '4,2');
            if (boxStartX !== undefined) {
            container.append('text').attr('x', boxStartX + 5).attr('y', yPoc - 3).text('POC').attr('fill', '#f97316').attr('font-size', '10px');
            }
    }
    if (obsX !== undefined) {
            container.append('text').attr('x', obsX + x.bandwidth()/2).attr('y', yHigh - 10).text('👁').attr('font-size', '14px').attr('text-anchor', 'middle');
    }
    if (entryX !== undefined) {
        const cx = entryX + x.bandwidth()/2;
        const yEntry = y(signal.entryPrice);
        container.append('text').attr('x', cx).attr('y', yEntry + 15).text('🚩').attr('font-size', '14px').attr('text-anchor', 'middle');
        container.append('text').attr('x', cx).attr('y', yEntry + 28).text('建仓').attr('fill', '#ef4444').attr('font-size', '10px').attr('text-anchor', 'middle').attr('font-weight', 'bold');
    }
    
    const drawTarget = (val: number, label: string, color: string, icon: string) => {
        const yPos = y(val);
        container.append('line').attr('x1', 0).attr('x2', width).attr('y1', yPos).attr('y2', yPos).attr('stroke', color).attr('stroke-width', 1).attr('opacity', 0.8); 
        container.append('text').attr('x', 5).attr('y', yPos - 4).text(icon).attr('font-size', '14px').attr('text-anchor', 'start');
        container.append('text').attr('x', 25).attr('y', yPos - 4).text(`${label} : ${val.toFixed(3)}`).attr('fill', color).attr('font-size', '10px').attr('font-weight', 'bold').attr('text-anchor', 'start');
    };
    drawTarget(signal.tpA, '止盈A', '#ef4444', '🎯');
    drawTarget(signal.tpB, '止盈B', '#ef4444', '💰');
    drawTarget(signal.slA, '止损A', '#22c55e', '🛡');
    drawTarget(signal.slB, '止损B', '#22c55e', '🛑');
}

// --- 7. MA Slope Painter ---
export function drawMASlope(
    container: SelectionGroup,
    data: KlinePoint[],
    x: ScaleBand,
    y: ScaleLinear
) {
    for(let i=1; i<data.length; i++) {
        const d = data[i];
        const prev = data[i-1];
        if (d.ma5 && d.ma10 && d.ma20 && prev.ma5 && prev.ma10 && prev.ma20) {
            const s5 = d.ma5 - prev.ma5;
            const s10 = d.ma10 - prev.ma10;
            const s20 = d.ma20 - prev.ma20;
            if (s5 > 0 && s10 > 0 && s20 > 0 && d.ma5 > d.ma10 && d.ma10 > d.ma20) {
                const xPos = x(d.date)! + x.bandwidth()/2;
                const yLow = y(d.low);
                container.append('text').attr('x', xPos).attr('y', yLow + 25).text('⬆️').attr('fill', '#ec4899').attr('font-size', '10px').attr('text-anchor', 'middle');
            }
        }
    }
}

// --- 11. Strategy Markers Painter (R1-R10) ---
export function drawStrategyMarkers(
    container: SelectionGroup,
    data: KlinePoint[],
    x: ScaleBand,
    y: ScaleLinear,
    width: number
) {
    if (data.length < 30) return;

    // --- Helpers ---
    // USE 2.0 Standard Deviations for Channel Width (Bollinger Logic)
    const getLRChannel = (idx: number, period: number = 20) => {
        if (idx < period - 1) return null;
        const subset = data.slice(idx - period + 1, idx + 1);
        const points = subset.map((d, i) => ({ x: i, y: d.close }));
        const { slope, intercept } = calculateLR(points);
        
        let sumSqDiff = 0;
        subset.forEach((d, i) => {
             const regY = slope * i + intercept;
             sumSqDiff += Math.pow(d.close - regY, 2);
        });
        const stdDev = Math.sqrt(sumSqDiff / period);
        // 2 Sigma for robust breakouts
        const width = 2.0 * stdDev; 

        const currentX = period - 1;
        const mid = slope * currentX + intercept;
        return { top: mid + width, mid: mid, bottom: mid - width, slope: slope / data[idx].close };
    };

    const drawIcon = (i: number, icon: string, color: string, label?: string, yOffset: number = 25) => {
        const d = data[i];
        const xPos = x(d.date);
        if (xPos === undefined) return;

        const cx = xPos + x.bandwidth()/2;
        const cy = y(d.high); 
        const g = container.append('g').attr('transform', `translate(${cx}, ${cy - yOffset})`);
        
        g.append('text')
            .text(icon)
            .attr('font-size', '14px')
            .attr('text-anchor', 'middle');
            
        if (label) {
             g.append('text')
                .text(label)
                .attr('y', -12)
                .attr('fill', color)
                .attr('font-size', '9px')
                .attr('text-anchor', 'middle')
                .attr('font-weight', 'bold');
        }
    };

    // Calculate Major ZigZag to simulate "Previous Wave"
    const zigzag = calculateZigZag(data);
    
    // --- State Machine ---
    let position: { 
        entryIdx: number, 
        entryPrice: number, 
        waveLow: number, // 0% Ref
        waveHigh: number // 100% Ref
    } | null = null;
    
    let entrySignalDay = -1; // Track R1 trigger day

    // Simulation Loop
    for (let i = 20; i < data.length; i++) {
        const d = data[i];
        const prev = data[i-1];
        
        // --- Feature: 30-Day Breakout Marker ---
        if (i > 30) {
            const past30 = data.slice(i-30, i);
            const maxHigh30 = Math.max(...past30.map(p => p.high));
            if (d.close > maxHigh30) {
                // To avoid clutter, only show if it wasn't a breakout yesterday too, or if volume is high
                const volAvg = data.slice(i-5, i).reduce((s,x)=>s+x.volume,0)/5;
                if (d.volume > volAvg * 1.2) {
                     drawIcon(i, '🚀', '#ef4444', '新高', 45);
                }
            }
        }

        const channel = getLRChannel(i, 20);
        if (!channel) continue;

        const volAvg5 = data.slice(i-5, i).reduce((sum, p) => sum + p.volume, 0) / 5;
        const volRatio = d.volume / (volAvg5 || 1);

        // --- I. Observation & Entry (R1) ---
        if (!position) {
            // R1: Observe
            if (d.close > channel.top) {
                drawIcon(i, '👁️', '#a855f7', '观察点');
                
                // Check if valid breakout (Close > Top * 1.005) & Vol
                if (d.close > channel.top * 1.005 && volRatio > 1.5) {
                    drawIcon(i, '🚩', '#ef4444', '信号触发', 40);
                    entrySignalDay = i;
                }
            }

            // R1: Execution (Next Day Confirmation)
            if (entrySignalDay === i - 1) {
                // Confirm: Close < PrevClose (Pullback) OR just strong continuation? 
                // Rule says: if close < prev close -> buy at close.
                // If close > prev close * 1.01 -> Wait.
                if (d.close < prev.close) {
                     drawIcon(i, '🚀', '#ef4444', '建仓点');
                     // Initialize Position
                     const localLow = Math.min(...data.slice(Math.max(0, i-30), i).map(p => p.low));
                     position = {
                         entryIdx: i,
                         entryPrice: d.close,
                         waveLow: localLow,
                         waveHigh: d.high
                     };
                }
            }
        } 
        
        // --- II. Holding Phase ---
        else {
            position.waveHigh = Math.max(position.waveHigh, d.high);
            const range = position.waveHigh - position.waveLow;
            const daysHeld = i - position.entryIdx;
            
            // R2: Add Position (Window 10 days)
            if (daysHeld <= 10) {
                const fib382 = position.waveHigh - range * 0.382;
                const fib50 = position.waveHigh - range * 0.50;
                
                // Add A: Touch 38.2
                if (d.low <= fib382 && d.close > fib382 * 0.99) {
                     // Check overlap to avoid clutter
                     drawIcon(i, '➕', '#3b82f6', '加仓A');
                }
                // Add B: Touch 50
                if (d.low <= fib50 && d.close > fib50 * 0.99) {
                     drawIcon(i, '➕', '#3b82f6', '加仓B');
                }
            }

            // R3/R4 Symmetry Warnings
            // Simplified check: If days held > 20 and no new high
            if (daysHeld > 20 && d.high < position.waveHigh) {
                 if (daysHeld % 5 === 0) drawIcon(i, '⚠️', '#eab308', '警告');
            }

            // R6: Step Take Profit (Retracement from High)
            // Trigger: Close < specific level
            const fib326L = position.waveHigh - range * 0.326;
            const fib618L = position.waveHigh - range * 0.618;
            
            if (d.close < fib326L && prev.close >= fib326L) {
                 drawIcon(i, '🎯', '#ef4444', '止盈A');
            }
            if (d.close < fib618L && prev.close >= fib618L) {
                 drawIcon(i, '🎯', '#eab308', '止盈B');
            }

            // R8: Hard TP (Profit > 30%)
            if ((d.close - position.entryPrice) / position.entryPrice > 0.30) {
                 drawIcon(i, '❌', '#ef4444', '强制止盈');
                 position = null; // Clear
                 continue;
            }

            // R9: Stop Loss (Break Fib Defense relative to Entry)
            // Logic: Price < Entry * (1 - 0.05) approx
            if (d.close < position.entryPrice * 0.95) {
                 drawIcon(i, '🛡️', '#ef4444', '止损');
                 position = null;
                 continue;
            }

            // R10: Meltdown
            if (d.open < position.waveLow * 0.99) {
                 drawIcon(i, '🚫', '#ef4444', '熔断');
                 position = null;
                 continue;
            }
        }
    }
}

// Helper for ZigZag
function calculateZigZag(data: KlinePoint[]) {
    const zigzag: {x: number, y: number, date: string, type: 'HIGH'|'LOW'}[] = [];
    const lookback = Math.max(3, Math.floor(data.length / 20));
    
    for(let i=lookback; i<data.length-lookback; i++) {
            const d = data[i];
            const range = data.slice(i-lookback, i+lookback+1);
            const isHigh = range.every(item => item.high <= d.high);
            const isLow = range.every(item => item.low >= d.low);
            
            if (isHigh) zigzag.push({x: i, y: d.high, date: d.date, type: 'HIGH'});
            else if (isLow) zigzag.push({x: i, y: d.low, date: d.date, type: 'LOW'});
    }
    
    const cleanZigzag: typeof zigzag = [];
    zigzag.forEach(p => {
        if (cleanZigzag.length === 0) { cleanZigzag.push(p); return; }
        const last = cleanZigzag[cleanZigzag.length-1];
        if (last.type !== p.type) {
            cleanZigzag.push(p);
        } else {
            if (p.type === 'HIGH' && p.y > last.y) cleanZigzag[cleanZigzag.length-1] = p;
            if (p.type === 'LOW' && p.y < last.y) cleanZigzag[cleanZigzag.length-1] = p;
        }
    });
    return cleanZigzag;
}
