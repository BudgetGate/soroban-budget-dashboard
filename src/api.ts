export interface SnapshotFunction {
  name: string;
  fixture_id: string;
  cpu_instructions: number;
  // null when the RPC did not report memory (core SCHEMA.md 2.0).
  memory_bytes: number | null;
  read_bytes: number;
  write_bytes: number;
  // null or absent in snapshots written before core counted footprint entries.
  read_entries?: number | null;
  write_entries?: number | null;
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

import { Octokit } from '@octokit/rest';

// Versions of core's snapshot schema (soroban-budget-core SCHEMA.md) this
// dashboard can read. Any other version is rejected rather than guessed at.
export const SUPPORTED_SCHEMA_VERSIONS = ['1.0', '2.0'];

export class RateLimitError extends Error {
  // When the data source says requests will be accepted again, if it said.
  readonly retryAt: Date | null;

  constructor(message: string, retryAt: Date | null) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAt = retryAt;
  }
}

type HeaderLookup = (name: string) => string | null;

// GitHub signals a rate limit with 403 or 429: x-ratelimit-remaining is 0 for
// the primary limit (x-ratelimit-reset is the reset time in epoch seconds), and
// a secondary limit says so in the message, sometimes with retry-after seconds.
// Any other 403 is not a rate limit.
export function rateLimitFrom(status: number, header: HeaderLookup, message: string, now = Date.now()): RateLimitError | null {
  if (status !== 403 && status !== 429) return null;
  const text = `The data source is rate-limiting requests (HTTP ${status}).`;
  const reset = Number(header('x-ratelimit-reset'));
  if (header('x-ratelimit-remaining') === '0' && reset > 0) {
    return new RateLimitError(text, new Date(reset * 1000));
  }
  const retryAfter = Number(header('retry-after'));
  if (retryAfter > 0) {
    return new RateLimitError(text, new Date(now + retryAfter * 1000));
  }
  if (status === 429 || /rate limit/i.test(message)) {
    return new RateLimitError(text, null);
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Checks the history's shape and every snapshot's schema_version before any
// field is used.
export function parseHistory(data: unknown): SnapshotHistory {
  if (!isRecord(data) || !Array.isArray(data.snapshots)) {
    throw new Error('The data source is not a snapshot history: expected an object with a "snapshots" array.');
  }
  const supported = SUPPORTED_SCHEMA_VERSIONS.join(', ');
  data.snapshots.forEach((snapshot: unknown, i: number) => {
    if (!isRecord(snapshot)) {
      throw new Error(`Snapshot ${i + 1} is not an object.`);
    }
    const commit = typeof snapshot.commit_sha === 'string' && snapshot.commit_sha !== ''
      ? ` (commit ${snapshot.commit_sha.substring(0, 7)})`
      : '';
    const version = snapshot.schema_version;
    if (typeof version !== 'string' || version === '') {
      throw new Error(`Snapshot ${i + 1}${commit} has no schema_version. Supported versions: ${supported}.`);
    }
    if (!SUPPORTED_SCHEMA_VERSIONS.includes(version)) {
      throw new Error(`Snapshot ${i + 1}${commit} has schema_version "${version}", which this dashboard does not support. Supported versions: ${supported}.`);
    }
    if (!Array.isArray(snapshot.functions)) {
      throw new Error(`Snapshot ${i + 1}${commit} has no "functions" array.`);
    }
  });
  // The checks above cover what the dashboard relies on before reading fields.
  return data as unknown as SnapshotHistory;
}

interface OctokitRequestError {
  status: number;
  message: string;
  response?: { headers: Record<string, string | number | undefined> };
}

function isOctokitRequestError(error: unknown): error is OctokitRequestError {
  return isRecord(error) && typeof error.status === 'number' && typeof error.message === 'string';
}

// A github:// read costs one of the 60 unauthenticated requests per hour, even when GitHub
// answers 304 Not Modified (checked 2026-10-28), so a result is reused for as long as the
// response's Cache-Control max-age says it is fresh (60 s on the Contents API), not asked again.
interface GithubCacheEntry {
  history: SnapshotHistory;
  fetchedAt: number;
  freshUntil: number;
}

const githubCache = new Map<string, GithubCacheEntry>();

// Seconds a response may be reused, from its Cache-Control header; 0 when it may not be.
export function maxAgeSeconds(cacheControl: string | null | undefined): number {
  if (!cacheControl || /no-store|no-cache/i.test(cacheControl)) return 0;
  const match = /(?:^|[,\s])max-age=(\d+)/i.exec(cacheControl);
  return match ? Number(match[1]) : 0;
}

// When a github:// URL was last fetched, and until when that result is reused.
export function githubFetchInfo(dataSourceUrl: string): { fetchedAt: Date; freshUntil: Date } | null {
  const entry = githubCache.get(dataSourceUrl);
  return entry ? { fetchedAt: new Date(entry.fetchedAt), freshUntil: new Date(entry.freshUntil) } : null;
}

export function clearGithubCache(): void {
  githubCache.clear();
}

export async function fetchSnapshotHistory(dataSourceUrl?: string, now: () => number = Date.now): Promise<SnapshotHistory> {
  if (!dataSourceUrl) {
    // Fallback to mock data if no URL is provided
    return new Promise((resolve) => {
      setTimeout(() => resolve(parseHistory(MOCK_HISTORY)), 500);
    });
  }

  // Handle GitHub API integration
  // Expected format: github://owner/repo/branch/path/to/history.json
  if (dataSourceUrl.startsWith('github://')) {
    const parts = dataSourceUrl.replace('github://', '').split('/');
    if (parts.length >= 4) {
      const owner = parts[0];
      const repo = parts[1];
      const ref = parts[2];
      const path = parts.slice(3).join('/');

      const cached = githubCache.get(dataSourceUrl);
      if (cached && now() < cached.freshUntil) return cached.history;

      const octokit = new Octokit();
      let content: string;
      let cacheControl: string | undefined;
      try {
        // The raw media type returns the file itself. The default JSON response leaves `content`
        // empty for files over 1 MB, which a long history of a contract with many functions
        // reaches (checked 2026-10-28).
        const response = await octokit.rest.repos.getContent({
          owner,
          repo,
          path,
          ref,
          mediaType: { format: 'raw' },
        });

        // Octokit types the response as the JSON form; with the raw media type a file arrives
        // as a string, and a directory still arrives as its JSON listing.
        const data: unknown = response.data;
        if (typeof data !== 'string') {
          throw new Error('Not a valid file');
        }
        content = data;
        cacheControl = response.headers['cache-control'];
      } catch (error: unknown) {
        if (isOctokitRequestError(error)) {
          const headers = error.response?.headers ?? {};
          const rateLimit = rateLimitFrom(error.status, name => {
            const value = headers[name];
            return value === undefined ? null : String(value);
          }, error.message);
          if (rateLimit) throw rateLimit;
        }
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`GitHub API fetch failed: ${message}`);
      }
      const history = parseHistory(JSON.parse(content));
      const fetchedAt = now();
      githubCache.set(dataSourceUrl, { history, fetchedAt, freshUntil: fetchedAt + maxAgeSeconds(cacheControl) * 1000 });
      return history;
    } else {
      throw new Error('Invalid github:// URL format. Expected github://owner/repo/branch/path');
    }
  }

  // Standard fetch for normal URLs
  const response = await fetch(dataSourceUrl);
  if (!response.ok) {
    const rateLimit = rateLimitFrom(response.status, name => response.headers.get(name), response.statusText);
    if (rateLimit) throw rateLimit;
    throw new Error(`Failed to fetch history: ${response.statusText}`);
  }
  return parseHistory(await response.json());
}
