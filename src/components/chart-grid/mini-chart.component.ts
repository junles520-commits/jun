import { Component, Input, ElementRef, ViewChild, OnChanges, SimpleChanges, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ETFAnalysis, KlinePoint } from '../../services/models';
import * as d3Raw from 'd3';
const d3 = d3Raw as any;
import { drawBaseLayer, drawSupRes, drawTrendChannel, drawVolumeProfile, drawResonanceSignal, drawMASlope, drawSubCharts, drawFibonacci, calculateLR, FibLevel, drawStrategyMarkers, drawDonchianChannel } from '../detail/chart-painters';

@Component({
  selector: 'app-mini-chart',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[300px]">
      <div class="p-2 border-b border-gray-100 flex justify-between items-center bg-gray-50">
        <a [routerLink]="['/detail', etf.code]" class="font-bold text-slate-800 hover:text-blue-600 truncate text-sm">
          {{ etf.name }} <span class="text-xs text-gray-500 font-normal">{{ etf.code }}</span>
        </a>
        <div class="flex items-center gap-2 text-xs">
          <span [class.text-red-500]="etf.changePercent7d > 0" [class.text-green-500]="etf.changePercent7d < 0">
            {{ etf.changePercent7d > 0 ? '+' : '' }}{{ etf.changePercent7d | number:'1.2-2' }}%
          </span>
          <span class="font-mono font-bold">{{ etf.currentPrice | number:'1.3-3' }}</span>
        </div>
      </div>
      <div #chartContainer class="flex-grow w-full relative"></div>
    </div>
  `
})
export class MiniChartComponent implements OnChanges, AfterViewInit {
  @Input({ required: true }) etf!: ETFAnalysis;
  @Input() strategy: string = 'NONE';
  @ViewChild('chartContainer') chartContainer!: ElementRef;

  private isInitialized = false;

  ngAfterViewInit() {
    this.isInitialized = true;
    this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (this.isInitialized && (changes['etf'] || changes['strategy'])) {
      this.renderChart();
    }
  }

  private renderChart() {
    if (!this.chartContainer || !this.etf || !this.etf.history || this.etf.history.length === 0) return;

    const element = this.chartContainer.nativeElement;
    d3.select(element).selectAll('*').remove();

    const rect = element.getBoundingClientRect();
    const width = rect.width || 300;
    const height = rect.height || 250;
    const margin = { top: 10, right: 40, bottom: 20, left: 10 };

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(element).append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Use last 60 points for mini chart
    const history = this.etf.history.slice(-60);

    const x = d3.scaleBand()
      .domain(history.map(d => d.date))
      .range([0, innerWidth])
      .padding(0.2);

    const yMin = d3.min(history, (d: KlinePoint) => d.low) as number;
    const yMax = d3.max(history, (d: KlinePoint) => d.high) as number;
    const yPadding = (yMax - yMin) * 0.1;

    const y = d3.scaleLinear()
      .domain([yMin - yPadding, yMax + yPadding])
      .range([innerHeight, 0]);

    // Draw Base Layer
    drawBaseLayer(svg, history, x, y, innerWidth, {
        showMA5: true,
        showMA20: true,
        showMA60: false
    });

    // Draw Selected Strategy
    switch (this.strategy) {
      case 'SUP_RES':
        drawSupRes(svg, history, x, y, innerWidth, svg);
        break;
      case 'TREND_CHANNEL':
        drawTrendChannel(svg, history, x, y, innerWidth);
        break;
      case 'FIBONACCI':
        const high = Math.max(...history.map(k => k.high));
        const low = Math.min(...history.map(k => k.low));
        const diff = high - low;
        const levels: FibLevel[] = [];
        if (this.etf.trend === 'DOWN') {
            levels.push({ val: low, label: '0%', color: '#22c55e', dash: 'solid', isBase: true });
            levels.push({ val: high, label: '100%', color: '#ef4444', dash: 'solid' });
            levels.push({ val: low + diff * 0.382, label: '38.2%', color: '#f97316', dash: '5,3' });
            levels.push({ val: low + diff * 0.5, label: '50.0%', color: '#94a3b8', dash: '3,3' });
            levels.push({ val: low + diff * 0.618, label: '61.8%', color: '#ef4444', dash: '5,3' });
            levels.push({ val: low - diff * 0.382, label: '138.2%', color: '#22c55e', dash: '2,2', isExtension: true });
        } else {
            levels.push({ val: high, label: '0%', color: '#ef4444', dash: 'solid', isBase: true });
            levels.push({ val: low, label: '100%', color: '#22c55e', dash: 'solid' });
            levels.push({ val: high - diff * 0.382, label: '38.2%', color: '#f97316', dash: '5,3' });
            levels.push({ val: high - diff * 0.5, label: '50.0%', color: '#94a3b8', dash: '3,3' });
            levels.push({ val: high - diff * 0.618, label: '61.8%', color: '#22c55e', dash: '5,3' });
            levels.push({ val: high + diff * 0.382, label: '138.2%', color: '#ef4444', dash: '2,2', isExtension: true });
        }
        drawFibonacci(svg, levels, innerWidth, y, yMin, yMax);
        break;
      case 'DONCHIAN':
        drawDonchianChannel(svg, history, x, y, innerWidth);
        break;
      case 'RESONANCE':
        if (this.etf.boxSignal) drawResonanceSignal(svg, this.etf.boxSignal, x, y, innerWidth);
        break;
      case 'MA_SLOPE':
        drawMASlope(svg, history, x, y);
        break;
      case 'STRATEGY_MARKERS':
        drawStrategyMarkers(svg, history, x, y, innerWidth);
        break;
      case 'VOLUME_PROFILE':
        drawVolumeProfile(svg, history, x, y, innerWidth);
        break;
    }
  }
}
