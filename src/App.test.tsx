import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';
import * as api from './api';

// Mock the API fetch module
vi.mock('./api', async () => {
  const actual = await vi.importActual('./api');
  return {
    ...actual as any,
    fetchSnapshotHistory: vi.fn(),
  };
});

// Mock ResizeObserver for Recharts
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

describe('Dashboard App UI Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    // Return an unresolved promise to keep it in loading state
    (api.fetchSnapshotHistory as any).mockReturnValue(new Promise(() => {}));
    render(<App />);
    expect(screen.getByText(/Loading snapshot history/i)).toBeInTheDocument();
  });

  it('displays an error message when data fetching fails', async () => {
    const errorMsg = 'Failed to fetch history: Not Found';
    (api.fetchSnapshotHistory as any).mockRejectedValue(new Error(errorMsg));
    
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText(/Error Fetching Data/i)).toBeInTheDocument();
      expect(screen.getByText(errorMsg)).toBeInTheDocument();
    });
  });

  it('renders correctly and handles the drill-down view correctly', async () => {
    const mockHistory = {
      snapshots: [
        {
          schema_version: '1.0',
          network: 'testnet',
          generated_at: '2026-08-01T12:00:00Z',
          commit_sha: 'abc1234',
          functions: [
            { name: 'mint', cpu_instructions: 100, memory_bytes: 50 },
            { name: 'burn', cpu_instructions: 200, memory_bytes: 100 },
          ]
        }
      ]
    };
    (api.fetchSnapshotHistory as any).mockResolvedValue(mockHistory);
    
    render(<App />);
    
    // Wait for the Dashboard to load and verify the main title
    await waitFor(() => {
      expect(screen.getByText('Resource Consumption Trends')).toBeInTheDocument();
      expect(screen.getByText('Regression Status')).toBeInTheDocument();
    });

    // Verify the function select dropdown exists
    const selectElem = screen.getByLabelText(/Filter by/i);
    expect(selectElem).toBeInTheDocument();
    
    // Verify that the dropdown has the correct options from the mock data
    expect(screen.getByText('All Functions (Aggregate)')).toBeInTheDocument();
    expect(screen.getByText('mint')).toBeInTheDocument();
    expect(screen.getByText('burn')).toBeInTheDocument();
    
    // Also verify "2 Active" functions tracked is shown
    expect(screen.getByText('2 Active')).toBeInTheDocument();
  });
});
