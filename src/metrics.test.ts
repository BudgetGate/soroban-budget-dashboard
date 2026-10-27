import { describe, it, expect } from 'vitest';
import type { Snapshot, SnapshotFunction } from './api';
import { metricValue, toChartPoints } from './metrics';
import type { MetricKey } from './metrics';

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
