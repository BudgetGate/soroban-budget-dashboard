import type { Snapshot } from './api';
import { functionHistory, METRIC_KEYS } from './metrics';
import type { FunctionRow, MetricKey } from './metrics';

// Trend rules (maintainer's decision, 2026-10-28). The thresholds match core's flag defaults:
// --cap-warning-pct 80 and --max-delta-pct 10. They are fixed here; the page states them.
export const CAP_WARNING_PCT = 80;
export const CAP_WINDOW = 5;
export const CAP_HORIZON_COMMITS = 10;
export const CREEP_RISES = 3;
export const CREEP_TOTAL_PCT = 10;

// A function's share of its network cap is projected to reach CAP_WARNING_PCT within
// CAP_HORIZON_COMMITS commits, at the slope of a least-squares line through its last
// CAP_WINDOW measurements, or has already reached it.
export interface CapTrend {
  kind: 'cap';
  name: string;
  // pct_of_network_cap of the last CAP_WINDOW measurements, oldest first.
  recent: number[];
  // Percentage points per commit, from the fitted line.
  slope: number;
  // Commits until CAP_WARNING_PCT at that slope; 0 when already reached.
  commitsToWarning: number;
}

// A metric rose in each of the function's last CREEP_RISES measurements and by at least
// CREEP_TOTAL_PCT in total.
export interface CreepTrend {
  kind: 'creep';
  name: string;
  metric: MetricKey;
  // The CREEP_RISES + 1 values, oldest first, and the commits they came from.
  values: number[];
  commits: string[];
  totalPct: number;
  largestStepPct: number;
}

export type Trend = CapTrend | CreepTrend;

export function slope(values: number[]): number {
  const n = values.length;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  values.forEach((y, x) => {
    num += (x - meanX) * (y - meanY);
    den += (x - meanX) ** 2;
  });
  return den === 0 ? 0 : num / den;
}

function capTrend(name: string, measured: FunctionRow[]): CapTrend | null {
  const window = measured.slice(-CAP_WINDOW);
  if (window.length < CAP_WINDOW) return null;
  // A window that mixes snapshots with and without a cap figure is not a trend.
  if (window.some(r => r.pctOfNetworkCap === null)) return null;
  const recent = window.map(r => r.pctOfNetworkCap as number);
  const latest = recent[recent.length - 1];
  const s = slope(recent);
  if (latest >= CAP_WARNING_PCT) return { kind: 'cap', name, recent, slope: s, commitsToWarning: 0 };
  if (s <= 0) return null;
  const commitsToWarning = Math.ceil((CAP_WARNING_PCT - latest) / s);
  return commitsToWarning <= CAP_HORIZON_COMMITS ? { kind: 'cap', name, recent, slope: s, commitsToWarning } : null;
}

function creepTrends(name: string, measured: FunctionRow[]): CreepTrend[] {
  const window = measured.slice(-(CREEP_RISES + 1));
  if (window.length < CREEP_RISES + 1) return [];
  const trends: CreepTrend[] = [];
  for (const metric of METRIC_KEYS) {
    const values = window.map(r => r.values[metric]);
    if (values.some(v => v === null)) continue;
    const v = values as number[];
    if (v[0] <= 0 || !v.every((x, i) => i === 0 || x > v[i - 1])) continue;
    const totalPct = ((v[v.length - 1] - v[0]) / v[0]) * 100;
    if (totalPct < CREEP_TOTAL_PCT) continue;
    const largestStepPct = Math.max(...v.slice(1).map((x, i) => ((x - v[i]) / v[i]) * 100));
    trends.push({ kind: 'creep', name, metric, values: v, commits: window.map(r => r.commit), totalPct, largestStepPct });
  }
  return trends;
}

// Trends for every function in the latest snapshot. Measurements are the snapshots that
// contain the function; a function removed from the latest snapshot is not flagged.
export function findTrends(snapshots: Snapshot[]): Trend[] {
  if (snapshots.length === 0) return [];
  const trends: Trend[] = [];
  // Once per name: an older snapshot can repeat one (see uniqueFunction).
  const names = new Set(snapshots[snapshots.length - 1].functions.map(fn => fn.name));
  for (const name of names) {
    const measured = functionHistory(snapshots, name).filter(r => r.present);
    const cap = capTrend(name, measured);
    if (cap) trends.push(cap);
    trends.push(...creepTrends(name, measured));
  }
  return trends;
}

// Whether any function has the CAP_WINDOW measurements with a cap figure that the cap rule needs.
export function capRuleApplies(snapshots: Snapshot[]): boolean {
  if (snapshots.length === 0) return false;
  return snapshots[snapshots.length - 1].functions.some(fn => {
    const window = functionHistory(snapshots, fn.name).filter(r => r.present).slice(-CAP_WINDOW);
    return window.length === CAP_WINDOW && window.every(r => r.pctOfNetworkCap !== null);
  });
}
