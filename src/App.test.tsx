import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
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
  };
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
    expect(screen.getByText('abc1234')).toBeInTheDocument();

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
});
