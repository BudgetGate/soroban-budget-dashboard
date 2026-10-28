import { describe, it, expect } from 'vitest';
import type { Snapshot, SnapshotFunction } from './api';
import { functionHistory, functionSummaries, metricValue, toChartPoints } from './metrics';
import type { FunctionRow, MetricKey } from './metrics';

function fn(name: string, overrides: Partial<SnapshotFunction> = {}): SnapshotFunction {
  return {
    name,
    fixture_id: `${name}_fixture`,
    cpu_instructions: 100,
    memory_bytes: null,
    read_bytes: 40,
    write_bytes: 20,
    read_entries: 3,
    write_entries: 1,
    pct_of_network_cap: 0,
    ...overrides,
  };
}

function snapshot(functions: SnapshotFunction[]): Snapshot {
  return {
    schema_version: '2.0',
    network: 'testnet',
    generated_at: '2026-10-27T12:00:00Z',
    commit_sha: 'abcdef0123',
    functions,
  };
}

describe('metricValue', () => {
  const cases: { name: string; snap: Snapshot; selected: string; key: MetricKey; want: number | null }[] = [
    { name: 'sums all functions', snap: snapshot([fn('mint'), fn('burn', { cpu_instructions: 250 })]), selected: 'all', key: 'cpu_instructions', want: 350 },
    { name: 'sums entry counts', snap: snapshot([fn('mint'), fn('burn', { read_entries: 6 })]), selected: 'all', key: 'read_entries', want: 9 },
    { name: 'returns the selected function', snap: snapshot([fn('mint'), fn('burn', { write_bytes: 380 })]), selected: 'burn', key: 'write_bytes', want: 380 },
    { name: 'is null when the selected function is missing', snap: snapshot([fn('mint')]), selected: 'burn', key: 'cpu_instructions', want: null },
    { name: 'is null for a snapshot with no functions', snap: snapshot([]), selected: 'all', key: 'cpu_instructions', want: null },
    { name: 'is null when an entry count is null', snap: snapshot([fn('mint', { write_entries: null })]), selected: 'mint', key: 'write_entries', want: null },
    { name: 'is null when an entry count is absent (schema 1.0)', snap: snapshot([fn('mint', { read_entries: undefined })]), selected: 'mint', key: 'read_entries', want: null },
    { name: 'does not sum a partial set', snap: snapshot([fn('mint'), fn('burn', { read_entries: null })]), selected: 'all', key: 'read_entries', want: null },
    { name: 'keeps a real zero', snap: snapshot([fn('mint', { write_bytes: 0 })]), selected: 'mint', key: 'write_bytes', want: 0 },
  ];

  it.each(cases)('$name', ({ snap, selected, key, want }) => {
    expect(metricValue(snap, selected, key)).toBe(want);
  });
});

describe('toChartPoints', () => {
  it('builds one point per snapshot with a short commit label', () => {
    const points = toChartPoints([snapshot([fn('mint')])], 'all');
    expect(points).toEqual([
      { commit: 'abcdef0', cpu_instructions: 100, read_bytes: 40, write_bytes: 20, read_entries: 3, write_entries: 1 },
    ]);
  });
});

function snapshotAt(commit: string, functions: SnapshotFunction[]): Snapshot {
  return { ...snapshot(functions), commit_sha: commit };
}

describe('functionHistory', () => {
  it('gives one row per snapshot with values and changes since the previous measurement', () => {
    const rows = functionHistory([
      snapshotAt('aaaaaaa111', [fn('bump', { cpu_instructions: 291573, write_bytes: 80, read_entries: 3, write_entries: 1, pct_of_network_cap: 0.75 })]),
      snapshotAt('bbbbbbb222', [fn('bump', { cpu_instructions: 449005, write_bytes: 380, read_entries: 6, write_entries: 4, pct_of_network_cap: 1.5 })]),
    ], 'bump');

    expect(rows.map(r => r.commit)).toEqual(['aaaaaaa', 'bbbbbbb']);
    expect(rows[0].changePct.cpu_instructions).toBeNull();
    expect(rows[1].values.cpu_instructions).toBe(449005);
    expect(rows[1].changePct.cpu_instructions).toBeCloseTo(53.99, 2);
    expect(rows[1].changePct.write_bytes).toBe(375);
    expect(rows[1].changePct.read_entries).toBe(100);
    expect(rows[1].changePct.read_bytes).toBe(0);
    expect(rows[1].pctOfNetworkCap).toBe(1.5);
  });

  const cases: { name: string; snaps: Snapshot[]; want: Partial<FunctionRow>[] }[] = [
    {
      name: 'marks snapshots without the function and compares across the gap',
      snaps: [snapshot([fn('mint', { cpu_instructions: 100 })]), snapshot([fn('burn')]), snapshot([fn('mint', { cpu_instructions: 150 })])],
      want: [{ present: true }, { present: false, pctOfNetworkCap: null }, { present: true }],
    },
    {
      name: 'treats a pct_of_network_cap of 0 as not recorded',
      snaps: [snapshot([fn('mint', { pct_of_network_cap: 0 })])],
      want: [{ present: true, pctOfNetworkCap: null }],
    },
  ];

  it.each(cases)('$name', ({ snaps, want }) => {
    const rows = functionHistory(snaps, 'mint');
    expect(rows).toHaveLength(want.length);
    rows.forEach((row, i) => expect(row).toMatchObject(want[i]));
  });

  it('compares across a gap to the last snapshot that had the function', () => {
    const rows = functionHistory([
      snapshot([fn('mint', { cpu_instructions: 100 })]),
      snapshot([]),
      snapshot([fn('mint', { cpu_instructions: 150 })]),
    ], 'mint');
    expect(rows[1].values.cpu_instructions).toBeNull();
    expect(rows[2].changePct.cpu_instructions).toBe(50);
  });

  it('has no change from 0 and none for an unknown value', () => {
    const rows = functionHistory([
      snapshot([fn('mint', { write_bytes: 0, read_entries: undefined })]),
      snapshot([fn('mint', { write_bytes: 80, read_entries: 3 })]),
    ], 'mint');
    expect(rows[1].changePct.write_bytes).toBeNull();
    expect(rows[1].changePct.read_entries).toBeNull();
  });
});

describe('functionSummaries', () => {
  it('lists latest-snapshot functions first, then removed ones with their last measurement', () => {
    const summaries = functionSummaries([
      snapshotAt('aaaaaaa111', [fn('mint'), fn('old', { cpu_instructions: 70 })]),
      snapshotAt('bbbbbbb222', [fn('burn'), fn('mint', { cpu_instructions: 120 })]),
    ]);
    expect(summaries.map(s => [s.name, s.inLatestSnapshot, s.latest.commit, s.latest.values.cpu_instructions])).toEqual([
      ['burn', true, 'bbbbbbb', 100],
      ['mint', true, 'bbbbbbb', 120],
      ['old', false, 'aaaaaaa', 70],
    ]);
    expect(summaries[1].latest.changePct.cpu_instructions).toBe(20);
  });

  it('is empty for an empty history', () => {
    expect(functionSummaries([])).toEqual([]);
  });
});
