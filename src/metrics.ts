import type { Snapshot, SnapshotFunction } from './api';

export type MetricKey = 'cpu_instructions' | 'read_bytes' | 'write_bytes' | 'read_entries' | 'write_entries';

export const METRIC_KEYS: MetricKey[] = ['cpu_instructions', 'read_bytes', 'write_bytes', 'read_entries', 'write_entries'];

export type ChartPoint = { commit: string } & Record<MetricKey, number | null>;

function valueOf(fn: SnapshotFunction, key: MetricKey): number | null {
  const value = fn[key];
  return typeof value === 'number' ? value : null;
}

// The snapshot's entry for a function, if it has exactly one. Core before v0.2.3 did not reject
// a fixture that repeated a name, so older snapshots can hold two entries for one name; neither
// is that function's measurement, so the function counts as unmeasured there.
export function uniqueFunction(snapshot: Snapshot, name: string): SnapshotFunction | undefined {
  const matches = snapshot.functions.filter(f => f.name === name);
  return matches.length === 1 ? matches[0] : undefined;
}

function isRepeated(snapshot: Snapshot, name: string): boolean {
  return snapshot.functions.filter(f => f.name === name).length > 1;
}

// A metric's value for one snapshot: the selected function's value, or the sum
// over all functions when selectedFunction is 'all'. null means unknown: the
// function is missing from the snapshot or repeated in it, or a value was not
// reported. A sum is never taken over a partial set of values; repeated entries
// are each a real measurement, so the sum includes them.
export function metricValue(snapshot: Snapshot, selectedFunction: string, key: MetricKey): number | null {
  if (selectedFunction !== 'all') {
    const fn = uniqueFunction(snapshot, selectedFunction);
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

// One function's measurement in one snapshot, for the drill-down tables.
export interface FunctionRow {
  commit: string;
  generatedAt: string;
  // false when the snapshot does not contain the function exactly once; values are then all null.
  present: boolean;
  // true when the snapshot contains more than one entry with the function's name.
  repeated: boolean;
  values: Record<MetricKey, number | null>;
  // Percent change of each metric since the function's previous measurement; null when there
  // is none, either value is unknown, or the previous value was 0.
  changePct: Record<MetricKey, number | null>;
  // core's pct_of_network_cap; null when the snapshot predates core reading network caps (0).
  pctOfNetworkCap: number | null;
}

function emptyMetrics(): Record<MetricKey, number | null> {
  return { cpu_instructions: null, read_bytes: null, write_bytes: null, read_entries: null, write_entries: null };
}

// The function's row for every snapshot, oldest first. Changes are taken against the last
// snapshot that contained the function, so a gap in the history does not hide a jump.
export function functionHistory(snapshots: Snapshot[], name: string): FunctionRow[] {
  let previous: Record<MetricKey, number | null> | null = null;
  return snapshots.map(snapshot => {
    const fn = uniqueFunction(snapshot, name);
    const row: FunctionRow = {
      commit: snapshot.commit_sha.substring(0, 7),
      generatedAt: snapshot.generated_at,
      present: fn !== undefined,
      repeated: isRepeated(snapshot, name),
      values: emptyMetrics(),
      changePct: emptyMetrics(),
      pctOfNetworkCap: null,
    };
    if (!fn) return row;
    for (const key of METRIC_KEYS) {
      const value = valueOf(fn, key);
      const before = previous ? previous[key] : null;
      row.values[key] = value;
      row.changePct[key] = value !== null && before !== null && before !== 0 ? ((value - before) / before) * 100 : null;
    }
    row.pctOfNetworkCap = fn.pct_of_network_cap > 0 ? fn.pct_of_network_cap : null;
    previous = row.values;
    return row;
  });
}

// One row per function in the history: its latest measurement, and whether the latest
// snapshot still contains it. Functions in the latest snapshot come first, in its order.
export interface FunctionSummary {
  name: string;
  latest: FunctionRow;
  inLatestSnapshot: boolean;
}

export function functionSummaries(snapshots: Snapshot[]): FunctionSummary[] {
  if (snapshots.length === 0) return [];
  const names: string[] = [];
  for (const snapshot of [...snapshots].reverse()) {
    for (const fn of snapshot.functions) {
      if (!names.includes(fn.name)) names.push(fn.name);
    }
  }
  const latestNames = new Set(snapshots[snapshots.length - 1].functions.map(f => f.name));
  return names.map(name => {
    // A function whose name was repeated in every snapshot that has it shows its latest repeated row.
    const rows = functionHistory(snapshots, name).filter(r => r.present || r.repeated);
    const measured = rows.filter(r => r.present);
    const latest = measured.length > 0 ? measured[measured.length - 1] : rows[rows.length - 1];
    return { name, latest, inLatestSnapshot: latestNames.has(name) };
  });
}
