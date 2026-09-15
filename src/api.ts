export interface SnapshotFunction {
  name: string;
  fixture_id: string;
  cpu_instructions: number;
  memory_bytes: number;
  read_bytes: number;
  write_bytes: number;
  pct_of_network_cap: number;
}

export interface Snapshot {
  schema_version: string;
  network: string;
  generated_at: string;
  commit_sha: string;
  functions: SnapshotFunction[];
}

export interface SnapshotHistory {
  snapshots: Snapshot[];
}

// Fallback mock history based on the schema
const MOCK_HISTORY: SnapshotHistory = {
  snapshots: [
    {
      schema_version: "1.0",
      network: "testnet",
      generated_at: "2026-08-02T12:00:00Z",
      commit_sha: "a1b2c3d",
      functions: [
        { name: "mint", fixture_id: "test1", cpu_instructions: 1000, memory_bytes: 500, read_bytes: 200, write_bytes: 100, pct_of_network_cap: 0.05 },
        { name: "transfer", fixture_id: "test2", cpu_instructions: 800, memory_bytes: 400, read_bytes: 150, write_bytes: 80, pct_of_network_cap: 0.04 }
      ]
    },
    {
      schema_version: "1.0",
      network: "testnet",
      generated_at: "2026-08-03T12:00:00Z",
      commit_sha: "b2c3d4e",
      functions: [
        { name: "mint", fixture_id: "test1", cpu_instructions: 1050, memory_bytes: 500, read_bytes: 200, write_bytes: 100, pct_of_network_cap: 0.05 },
        { name: "transfer", fixture_id: "test2", cpu_instructions: 800, memory_bytes: 400, read_bytes: 150, write_bytes: 80, pct_of_network_cap: 0.04 }
      ]
    },
    {
      schema_version: "1.0",
      network: "testnet",
      generated_at: "2026-08-04T12:00:00Z",
      commit_sha: "c3d4e5f",
      functions: [
        { name: "mint", fixture_id: "test1", cpu_instructions: 1100, memory_bytes: 550, read_bytes: 210, write_bytes: 100, pct_of_network_cap: 0.06 },
        { name: "transfer", fixture_id: "test2", cpu_instructions: 820, memory_bytes: 410, read_bytes: 150, write_bytes: 80, pct_of_network_cap: 0.04 }
      ]
    },
    {
      schema_version: "1.0",
      network: "testnet",
      generated_at: "2026-08-05T12:00:00Z",
      commit_sha: "d4e5f6g",
      functions: [
        { name: "mint", fixture_id: "test1", cpu_instructions: 1600, memory_bytes: 600, read_bytes: 210, write_bytes: 120, pct_of_network_cap: 0.08 },
        { name: "transfer", fixture_id: "test2", cpu_instructions: 1200, memory_bytes: 500, read_bytes: 200, write_bytes: 100, pct_of_network_cap: 0.06 }
      ]
    },
    {
      schema_version: "1.0",
      network: "testnet",
      generated_at: "2026-08-06T12:00:00Z",
      commit_sha: "e5f6g7h",
      functions: [
        { name: "mint", fixture_id: "test1", cpu_instructions: 1200, memory_bytes: 550, read_bytes: 200, write_bytes: 100, pct_of_network_cap: 0.06 },
        { name: "transfer", fixture_id: "test2", cpu_instructions: 820, memory_bytes: 410, read_bytes: 150, write_bytes: 80, pct_of_network_cap: 0.04 }
      ]
    }
  ]
};

export async function fetchSnapshotHistory(dataSourceUrl?: string): Promise<SnapshotHistory> {
  if (!dataSourceUrl) {
    // Fallback to mock data if no URL is provided
    return new Promise((resolve) => {
      setTimeout(() => resolve(MOCK_HISTORY), 500);
    });
  }

  const response = await fetch(dataSourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch history: ${response.statusText}`);
  }
  return response.json();
}
