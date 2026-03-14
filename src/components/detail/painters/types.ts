
export type SelectionGroup = any;
export type ScaleBand = any;
export type ScaleLinear = any;

export interface FibLevel {
  val: number;
  label: string;
  color: string;
  dash: string;
  isExtension?: boolean;
  isBase?: boolean;
  bgClass?: string;
  textClass?: string;
  borderClass?: string;
}

export function calculateLR(points: {x: number, y: number}[]) {
    const n = points.length;
    if (n < 2) return { slope: 0, intercept: 0 };
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    points.forEach(p => { sumX += p.x; sumY += p.y; sumXY += p.x * p.y; sumXX += p.x * p.x; });
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    return { slope, intercept };
}
