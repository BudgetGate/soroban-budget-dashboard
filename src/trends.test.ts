import { describe, it, expect } from 'vitest';
import type { Snapshot, SnapshotFunction } from './api';
import { capRuleApplies, findTrends, slope } from './trends';
import type { CapTrend, CreepTrend } from './trends';

function fn(name: string, overrides: Partial<SnapshotFunction> = {}): SnapshotFunction {
  return {
    name,
    fixture_id: `${name}_fixture`,
    cpu_instructions: 1000,
    memory_bytes: null,
    read_bytes: 0,
    write_bytes: 80,
    read_entries: 3,
    write_entries: 1,
    pct_of_network_cap: 0,
    ...overrides,
  };
}

function history(perCommit: Partial<SnapshotFunction>[], name = 'bump'): Snapshot[] {
  return perCommit.map((overrides, i) => ({
    schema_version: '2.0',
    network: 'testnet',
    generated_at: `2026-10-${String(i + 1).padStart(2, '0')}T12:00:00Z`,
    commit_sha: `c${i}`.padEnd(7, '0'),
    functions: [fn(name, overrides)],
  }));
}

const caps = (...pcts: number[]) => history(pcts.map(p => ({ pct_of_network_cap: p })));
const cpus = (...values: number[]) => history(values.map(v => ({ cpu_instructions: v })));

describe('slope', () => {
  it.each([
    { values: [22, 27, 31, 36, 41], want: 4.7 },
    { values: [5, 5, 5], want: 0 },
    { values: [10, 8, 6], want: -2 },
    { values: [7], want: 0 },
  ])('$values → $want', ({ values, want }) => {
    expect(slope(values)).toBeCloseTo(want, 5);
  });
});

describe('cap projection', () => {
  const capTrends = (snaps: Snapshot[]) => findTrends(snaps).filter((t): t is CapTrend => t.kind === 'cap');

  const cases: { name: string; snaps: Snapshot[]; want: number | null }[] = [
    { name: 'flags a rise projected to reach 80% within 10 commits', snaps: caps(22, 27, 31, 36, 41), want: 9 },
    { name: 'ignores a rise that reaches 80% later than 10 commits', snaps: caps(10, 11, 12, 13, 14), want: null },
    { name: 'flags a function already at 80%', snaps: caps(81, 80, 80, 80, 80), want: 0 },
    { name: 'ignores a flat or falling share', snaps: caps(40, 40, 39, 38, 38), want: null },
    { name: 'needs five measurements', snaps: caps(40, 50, 60, 70), want: null },
    { name: 'ignores a window with a snapshot made before core read caps', snaps: caps(40, 0, 60, 65, 70), want: null },
    { name: 'uses only the last five measurements', snaps: caps(79, 10, 11, 12, 13, 14), want: null },
  ];

  it.each(cases)('$name', ({ snaps, want }) => {
    const found = capTrends(snaps);
    if (want === null) {
      expect(found).toEqual([]);
    } else {
      expect(found).toHaveLength(1);
      expect(found[0].commitsToWarning).toBe(want);
    }
  });

  it('reports the recent shares and the slope', () => {
    expect(capTrends(caps(22, 27, 31, 36, 41))[0]).toMatchObject({ name: 'bump', recent: [22, 27, 31, 36, 41] });
    expect(capTrends(caps(22, 27, 31, 36, 41))[0].slope).toBeCloseTo(4.7, 5);
  });
});

describe('creep', () => {
  const creepTrends = (snaps: Snapshot[]) => findTrends(snaps).filter((t): t is CreepTrend => t.kind === 'creep');

  const cases: { name: string; snaps: Snapshot[]; want: number | null }[] = [
    { name: 'flags three rises totalling 10% or more', snaps: cpus(1000, 1040, 1080, 1142), want: 14.2 },
    { name: 'flags exactly 10%', snaps: cpus(1000, 1030, 1060, 1100), want: 10 },
    { name: 'ignores three rises totalling under 10%', snaps: cpus(1000, 1020, 1040, 1060), want: null },
    { name: 'ignores a dip inside the window', snaps: cpus(1000, 1100, 1090, 1200), want: null },
    { name: 'ignores a flat step', snaps: cpus(1000, 1100, 1100, 1200), want: null },
    { name: 'needs four measurements', snaps: cpus(1000, 1100, 1200), want: null },
    { name: 'looks only at the last four measurements', snaps: cpus(2000, 1000, 1020, 1040, 1060), want: null },
  ];

  it.each(cases)('$name', ({ snaps, want }) => {
    const cpu = creepTrends(snaps).filter(t => t.metric === 'cpu_instructions');
    if (want === null) {
      expect(cpu).toEqual([]);
    } else {
      expect(cpu).toHaveLength(1);
      expect(cpu[0].totalPct).toBeCloseTo(want, 5);
    }
  });

  it('records the values, commits and largest single step', () => {
    const [t] = creepTrends(cpus(1000, 1040, 1080, 1142));
    expect(t.values).toEqual([1000, 1040, 1080, 1142]);
    expect(t.commits).toEqual(['c000000', 'c100000', 'c200000', 'c300000']);
    expect(t.largestStepPct).toBeCloseTo(5.74, 2);
  });

  it('checks every metric and skips unknown values and a start of 0', () => {
    const snaps = history([
      { write_bytes: 80, read_entries: null, read_bytes: 0 },
      { write_bytes: 90, read_entries: 4, read_bytes: 10 },
      { write_bytes: 100, read_entries: 5, read_bytes: 20 },
      { write_bytes: 120, read_entries: 6, read_bytes: 30 },
    ]);
    expect(creepTrends(snaps).map(t => t.metric)).toEqual(['write_bytes']);
  });

  it('counts measurements across snapshots that lack the function', () => {
    const snaps = cpus(1000, 1040, 1080, 1142);
    snaps.splice(2, 0, { ...snaps[0], commit_sha: 'gap0000', functions: [fn('other')] });
    expect(creepTrends(snaps).filter(t => t.name === 'bump')).toHaveLength(1);
  });
});

describe('findTrends', () => {
  it('skips functions that are not in the latest snapshot', () => {
    const snaps = cpus(1000, 1040, 1080, 1142);
    snaps.push({ ...snaps[0], commit_sha: 'last000', functions: [fn('other')] });
    expect(findTrends(snaps)).toEqual([]);
  });

  it('is empty for an empty history', () => {
    expect(findTrends([])).toEqual([]);
  });

  it('leaves out a snapshot that repeats the name and flags the function once', () => {
    const snaps = cpus(1000, 1040, 1080, 1142);
    // A repeat in the middle is skipped like a gap; one in the latest snapshot does not double the alert.
    snaps.splice(2, 0, { ...snaps[0], commit_sha: 'rep0000', functions: [fn('bump', { cpu_instructions: 1 }), fn('bump', { cpu_instructions: 9000 })] });
    snaps.push({ ...snaps[0], commit_sha: 'rep1111', functions: [fn('bump', { cpu_instructions: 1 }), fn('bump', { cpu_instructions: 9000 })] });
    const creep = findTrends(snaps).filter((t): t is CreepTrend => t.kind === 'creep');
    expect(creep).toHaveLength(1);
    expect(creep[0].values).toEqual([1000, 1040, 1080, 1142]);
  });
});

describe('capRuleApplies', () => {
  it.each([
    { name: 'five measurements with cap figures', snaps: caps(1, 2, 3, 4, 5), want: true },
    { name: 'four measurements', snaps: caps(1, 2, 3, 4), want: false },
    { name: 'snapshots made before core read caps', snaps: caps(0, 0, 0, 0, 0), want: false },
    { name: 'an empty history', snaps: [], want: false },
  ])('$name → $want', ({ snaps, want }) => {
    expect(capRuleApplies(snaps)).toBe(want);
  });
});
