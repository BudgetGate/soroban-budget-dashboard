import type { Snapshot, SnapshotFunction } from './api';

export type MetricKey = 'cpu_instructions' | 'read_bytes' | 'write_bytes' | 'read_entries' | 'write_entries';

export const METRIC_KEYS: MetricKey[] = ['cpu_instructions', 'read_bytes', 'write_bytes', 'read_entries', 'write_entries'];

export type ChartPoint = { commit: string } & Record<MetricKey, number | null>;

function valueOf(fn: SnapshotFunction, key: MetricKey): number | null {
  const value = fn[key];
  return typeof value === 'number' ? value : null;
}

// A metric's value for one snapshot: the selected function's value, or the sum
// over all functions when selectedFunction is 'all'. null means unknown: the
// function is missing from the snapshot, or a value was not reported. A sum is
// never taken over a partial set of values.
export function metricValue(snapshot: Snapshot, selectedFunction: string, key: MetricKey): number | null {
  if (selectedFunction !== 'all') {
    const fn = snapshot.functions.find(f => f.name === selectedFunction);
    return fn ? valueOf(fn, key) : null;
  }
  if (snapshot.functions.length === 0) return null;
  let total = 0;
  for (const fn of snapshot.functions) {
    const value = valueOf(fn, key);
    if (value === null) return null;
    total += value;
  }
  return total;
}

export function toChartPoints(snapshots: Snapshot[], selectedFunction: string): ChartPoint[] {
  return snapshots.map(snapshot => {
    const point: ChartPoint = {
      commit: snapshot.commit_sha.substring(0, 7),
      cpu_instructions: null,
      read_bytes: null,
      write_bytes: null,
      read_entries: null,
      write_entries: null,
    };
    for (const key of METRIC_KEYS) {
      point[key] = metricValue(snapshot, selectedFunction, key);
    }
    return point;
  });
}
