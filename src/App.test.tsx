import type { ComponentProps } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';
import * as api from './api';
import type { Snapshot, SnapshotFunction, SnapshotHistory } from './api';

// Mock the API fetch module
vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api');
  return {
    ...actual,
    fetchSnapshotHistory: vi.fn(),
    githubFetchInfo: vi.fn(() => null),
  };
});

// Counts chart renders, to check that typing in the data source box leaves the charts alone.
// ResponsiveContainer is counted because jsdom has no layout: it measures 0x0 and never renders
// the LineChart inside it.
const chartRenders = vi.hoisted(() => ({ count: 0 }));
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  const CountedResponsiveContainer = (props: ComponentProps<typeof actual.ResponsiveContainer>) => {
    chartRenders.count++;
    return <actual.ResponsiveContainer {...props} />;
  };
  return { ...actual, ResponsiveContainer: CountedResponsiveContainer };
});

// Recharts' ResponsiveContainer needs ResizeObserver, which jsdom does not provide.
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const fetchHistory = vi.mocked(api.fetchSnapshotHistory);

function fn(name: string, cpu: number): SnapshotFunction {
  return {
    name,
    fixture_id: `${name}_fixture`,
    cpu_instructions: cpu,
    memory_bytes: 0,
    read_bytes: 0,
    write_bytes: 0,
    pct_of_network_cap: 0,
  };
}

function snapshot(commit: string, functions: SnapshotFunction[]): Snapshot {
  return {
    schema_version: '1.0',
    network: 'testnet',
    generated_at: '2026-08-01T12:00:00Z',
    commit_sha: commit,
    functions,
  };
}

describe('Dashboard App UI Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    // An unresolved promise keeps the page in its loading state.
    fetchHistory.mockReturnValue(new Promise(() => {}));
    render(<App />);
    expect(screen.getByText(/Establishing connection/i)).toBeInTheDocument();
  });

  it('displays an error message when data fetching fails', async () => {
    const errorMsg = 'Failed to fetch history: Not Found';
    fetchHistory.mockRejectedValue(new Error(errorMsg));

    render(<App />);

    expect(await screen.findByText('CRITICAL SYSTEM ERROR')).toBeInTheDocument();
    expect(screen.getByText(errorMsg)).toBeInTheDocument();
  });

  it('shows a rate-limited state with the retry time', async () => {
    const retryAt = new Date(Date.UTC(2026, 9, 27, 13, 0, 0));
    fetchHistory.mockRejectedValue(new api.RateLimitError('The data source is rate-limiting requests (HTTP 403).', retryAt));

    render(<App />);

    expect(await screen.findByText('RATE_LIMITED')).toBeInTheDocument();
    expect(screen.getByText('The data source is rate-limiting requests (HTTP 403).')).toBeInTheDocument();
    expect(screen.getByText(`Try again after ${retryAt.toLocaleString()}.`)).toBeInTheDocument();
    expect(screen.queryByText('CRITICAL SYSTEM ERROR')).not.toBeInTheDocument();
  });

  it('shows the empty state when the history has no snapshots', async () => {
    fetchHistory.mockResolvedValue({ snapshots: [] });

    render(<App />);

    expect(await screen.findByText('NO_DATA_STREAM')).toBeInTheDocument();
  });

  it('renders the loaded history and its function filter', async () => {
    const history: SnapshotHistory = {
      snapshots: [snapshot('abc1234', [fn('mint', 100), fn('burn', 200)])],
    };
    fetchHistory.mockResolvedValue(history);

    render(<App />);

    expect(await screen.findByText('RESOURCE_TELEMETRY')).toBeInTheDocument();
    expect(screen.getByText('SYS.REGRESSION_STATE')).toBeInTheDocument();
    expect(screen.getByText('Clear')).toBeInTheDocument();
    expect(screen.getByText('SYS.LATEST_COMMIT').parentElement?.parentElement).toHaveTextContent('abc1234');

    const select = screen.getByLabelText(/FILTER_VECTOR/i);
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /ALL_VECTORS \(AGGREGATE\)/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /mint/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /burn/ })).toBeInTheDocument();

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('labels the built-in history as sample data, with no demo button or sync badge', async () => {
    fetchHistory.mockResolvedValue({ snapshots: [snapshot('abc1234', [fn('mint', 100)])] });

    render(<App />);

    const note = await screen.findByRole('note', { name: 'Sample data' });
    expect(note).toHaveTextContent('not measurements of any contract');
    expect(fetchHistory).toHaveBeenCalledWith('');
    expect(screen.queryByText(/RUN DEMO BUDGET TEST/)).not.toBeInTheDocument();
    expect(screen.queryByText(/TESTNET_SYNC_ACTIVE/)).not.toBeInTheDocument();
  });

  it('drops the sample data label once a data source URL is applied', async () => {
    fetchHistory.mockResolvedValue({ snapshots: [snapshot('abc1234', [fn('mint', 100)])] });

    render(<App />);
    await screen.findByRole('note', { name: 'Sample data' });

    fireEvent.change(screen.getByPlaceholderText('DATASOURCE_URL'), { target: { value: 'https://example.test/history.json' } });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh Data' }));

    await screen.findByText('RESOURCE_TELEMETRY');
    expect(fetchHistory).toHaveBeenLastCalledWith('https://example.test/history.json');
    expect(screen.queryByRole('note', { name: 'Sample data' })).not.toBeInTheDocument();
  });

  // In a production build, re-rendering the charts on every keystroke crashed the page after
  // about 30 characters (React error #185). Typing must not re-render them at all.
  it('does not re-render the charts while a data source URL is typed', async () => {
    fetchHistory.mockResolvedValue({ snapshots: [snapshot('abc1234', [fn('mint', 100)])] });

    render(<App />);
    await screen.findByText('RESOURCE_TELEMETRY');
    const rendersBefore = chartRenders.count;
    expect(rendersBefore).toBeGreaterThan(0);

    const input = screen.getByPlaceholderText('DATASOURCE_URL') as HTMLInputElement;
    for (const ch of 'https://raw.githubusercontent.com/o/r/budgetgate-history/history.json') {
      fireEvent.change(input, { target: { value: input.value + ch } });
    }

    expect(input.value).toBe('https://raw.githubusercontent.com/o/r/budgetgate-history/history.json');
    expect(chartRenders.count).toBe(rendersBefore);
  });

  it('charts CPU, ledger bytes and footprint entries, and says when entries were not reported', async () => {
    // fn() builds schema 1.0 functions, which have no entry counts.
    fetchHistory.mockResolvedValue({ snapshots: [snapshot('abc1234', [fn('mint', 100)])] });

    render(<App />);

    expect(await screen.findByRole('region', { name: 'CPU instructions' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Ledger bytes' })).toBeInTheDocument();
    const entries = screen.getByRole('region', { name: 'Footprint entries' });
    expect(entries).toHaveTextContent('Not reported in these snapshots.');
    expect(screen.queryByText(/MEMORY_BYTES/)).not.toBeInTheDocument();
  });

  it.each([
    { name: 'flags a CPU increase above 10% between the last two snapshots', cpu: 111, status: 'Regression Detected' },
    { name: 'stays clear for a CPU increase of 10% or less', cpu: 110, status: 'Clear' },
  ])('$name', async ({ cpu, status }) => {
    const history: SnapshotHistory = {
      snapshots: [
        snapshot('aaaaaaa', [fn('mint', 100)]),
        snapshot('bbbbbbb', [fn('mint', cpu)]),
      ],
    };
    fetchHistory.mockResolvedValue(history);

    render(<App />);

    expect(await screen.findByText(status)).toBeInTheDocument();
  });

  describe('refresh and fetch time', () => {
    function applyUrl(url: string) {
      fireEvent.change(screen.getByPlaceholderText('DATASOURCE_URL'), { target: { value: url } });
      fireEvent.click(screen.getByRole('button', { name: 'Refresh Data' }));
    }

    it('reloads when the same URL is applied again', async () => {
      fetchHistory.mockResolvedValue({ snapshots: [snapshot('abc1234', [fn('mint', 100)])] });
      render(<App />);
      await screen.findByText('RESOURCE_TELEMETRY');

      applyUrl('https://example.test/history.json');
      await screen.findByText('RESOURCE_TELEMETRY');
      applyUrl('https://example.test/history.json');
      await screen.findByText('RESOURCE_TELEMETRY');

      expect(fetchHistory.mock.calls.map(c => c[0])).toEqual(['', 'https://example.test/history.json', 'https://example.test/history.json']);
    });

    it('says when a github:// history was fetched and until when it is reused', async () => {
      const fetchedAt = new Date(2026, 9, 29, 12, 0, 0);
      const freshUntil = new Date(2026, 9, 29, 12, 1, 0);
      vi.mocked(api.githubFetchInfo).mockReturnValue({ fetchedAt, freshUntil });
      fetchHistory.mockResolvedValue({ snapshots: [snapshot('abc1234', [fn('mint', 100)])] });
      render(<App />);
      await screen.findByText('RESOURCE_TELEMETRY');
      expect(screen.queryByRole('status', { name: 'Fetch time' })).not.toBeInTheDocument();

      applyUrl('github://o/r/budgetgate-history/history.json');

      const status = await screen.findByRole('status', { name: 'Fetch time' });
      expect(status).toHaveTextContent(`Fetched from GitHub at ${fetchedAt.toLocaleTimeString()}.`);
      expect(status).toHaveTextContent(`Refreshing before ${freshUntil.toLocaleTimeString()} reuses this copy`);
      expect(api.githubFetchInfo).toHaveBeenCalledWith('github://o/r/budgetgate-history/history.json');
    });
  });

  describe('trend alerts', () => {
    it('flags a function whose CPU crept up over three commits and opens its history', async () => {
      fetchHistory.mockResolvedValue({
        snapshots: [
          snapshot('c000001', [fn('mint', 1000), fn('burn', 500)]),
          snapshot('c000002', [fn('mint', 1040), fn('burn', 500)]),
          snapshot('c000003', [fn('mint', 1080), fn('burn', 500)]),
          snapshot('c000004', [fn('mint', 1142), fn('burn', 500)]),
        ],
      });
      render(<App />);

      const alerts = await screen.findByRole('region', { name: 'Trend alerts' });
      expect(alerts).toHaveTextContent('CPU instructions rose in each of the last 3 measurements, +14.2% in total (no single step above 10%)');
      expect(alerts).toHaveTextContent('1,000 (c000001) → 1,040 (c000002) → 1,080 (c000003) → 1,142 (c000004)');
      expect(alerts).not.toHaveTextContent('burn');
      // The single-commit card does not see this: no step is above 10%.
      expect(screen.getByText('Clear')).toBeInTheDocument();

      fireEvent.click(within(alerts).getByRole('button', { name: 'Show history of mint' }));
      expect(screen.getByRole('region', { name: 'History of mint' })).toBeInTheDocument();
    });

    it('flags a share of network cap projected to reach 80%', async () => {
      const capped = (commit: string, pct: number) => snapshot(commit, [{ ...fn('mint', 1000), pct_of_network_cap: pct }]);
      fetchHistory.mockResolvedValue({
        snapshots: [capped('c1', 22), capped('c2', 27), capped('c3', 31), capped('c4', 36), capped('c5', 41)],
      });
      render(<App />);

      const alerts = await screen.findByRole('region', { name: 'Trend alerts' });
      expect(alerts).toHaveTextContent('Share of network cap 41%: projected to reach 80% in about 9 commits (+4.7 points per commit)');
      expect(alerts).toHaveTextContent('Last 5: 22%, 27%, 31%, 36%, 41%');
      expect(alerts).not.toHaveTextContent('The cap rule needs');
    });

    it('says when nothing is trending and when the cap rule has too little data', async () => {
      fetchHistory.mockResolvedValue({ snapshots: [snapshot('abc1234', [fn('mint', 100)])] });
      render(<App />);

      const alerts = await screen.findByRole('region', { name: 'Trend alerts' });
      expect(alerts).toHaveTextContent('No function is trending toward a cap or creeping up.');
      expect(alerts).toHaveTextContent('The cap rule needs 5 measurements with a network-cap figure, which no function has here.');
    });
  });

  describe('per-function drill-down', () => {
    const history: SnapshotHistory = {
      snapshots: [
        snapshot('aaaaaaa1', [fn('mint', 100), fn('old', 70)]),
        snapshot('bbbbbbb2', [fn('mint', 150), fn('burn', 200)]),
      ],
    };

    it('lists every function with its latest measurement and change', async () => {
      fetchHistory.mockResolvedValue(history);
      render(<App />);

      const table = await screen.findByRole('region', { name: 'Functions' });
      const rows = within(table).getAllByRole('row').slice(1);
      expect(rows.map(r => within(r).getByRole('rowheader').textContent)).toEqual(['mint', 'burn', 'old']);
      expect(rows[0]).toHaveTextContent('150+50%');
      expect(rows[1]).toHaveTextContent('200');
      expect(rows[2]).toHaveTextContent('aaaaaaanot in latest snapshot');
      // Schema 1.0 snapshots have no entry counts and no network-cap figure.
      expect(rows[0]).toHaveTextContent('not reported');
      expect(rows[0]).toHaveTextContent('not recorded');
    });

    it('opens a function history from the table and returns to all functions', async () => {
      fetchHistory.mockResolvedValue(history);
      render(<App />);

      fireEvent.click(await screen.findByRole('button', { name: 'Show history of old' }));

      const detail = screen.getByRole('region', { name: 'History of old' });
      const rows = within(detail).getAllByRole('row').slice(1);
      expect(rows.map(r => within(r).getByRole('rowheader').textContent)).toEqual(['bbbbbbb', 'aaaaaaa']);
      expect(rows[0]).toHaveTextContent('Not in this snapshot');
      expect(rows[1]).toHaveTextContent('70');
      expect(screen.getByLabelText(/FILTER_VECTOR/i)).toHaveValue('old');
      expect(screen.queryByRole('region', { name: 'Functions' })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'All functions' }));
      expect(screen.getByRole('region', { name: 'Functions' })).toBeInTheDocument();
      expect(screen.getByLabelText(/FILTER_VECTOR/i)).toHaveValue('all');
    });

    it('shows the history when a function is picked in the filter', async () => {
      fetchHistory.mockResolvedValue(history);
      render(<App />);

      fireEvent.change(await screen.findByLabelText(/FILTER_VECTOR/i), { target: { value: 'mint' } });

      const rows = within(screen.getByRole('region', { name: 'History of mint' })).getAllByRole('row').slice(1);
      expect(rows[0]).toHaveTextContent('150+50%');
      expect(rows[1]).toHaveTextContent('100');
      expect(rows[1]).not.toHaveTextContent('%');
    });

    it('says when a snapshot has no commit SHA', async () => {
      fetchHistory.mockResolvedValue({ snapshots: [snapshot('', [fn('mint', 100)])] });
      render(<App />);

      const row = within(await screen.findByRole('region', { name: 'Functions' })).getAllByRole('row')[1];
      expect(row).toHaveTextContent('mintnot recorded');
    });
  });
});
