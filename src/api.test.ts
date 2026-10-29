import { describe, it, expect, vi, afterEach } from 'vitest';
import { clearGithubCache, fetchSnapshotHistory, githubFetchInfo, maxAgeSeconds, parseHistory, rateLimitFrom, RateLimitError } from './api';

const getContent = vi.fn();

vi.mock('@octokit/rest', () => ({
  Octokit: class {
    rest = { repos: { getContent } };
  },
}));

function headers(values: Record<string, string | undefined>) {
  return (name: string) => values[name] ?? null;
}

function snapshot(version: unknown, extra: Record<string, unknown> = {}) {
  return { schema_version: version, network: 'testnet', generated_at: '', commit_sha: 'abcdef0123', functions: [], ...extra };
}

describe('parseHistory', () => {
  it.each([
    { name: 'accepts schema 1.0', data: { snapshots: [snapshot('1.0')] } },
    { name: 'accepts schema 2.0', data: { snapshots: [snapshot('2.0')] } },
    { name: 'accepts an empty history', data: { snapshots: [] } },
  ])('$name', ({ data }) => {
    expect(parseHistory(data)).toBe(data);
  });

  it.each([
    { name: 'rejects a non-object', data: [], error: /expected an object with a "snapshots" array/ },
    { name: 'rejects a missing snapshots array', data: { snapshots: {} }, error: /expected an object with a "snapshots" array/ },
    { name: 'rejects a snapshot that is not an object', data: { snapshots: ['x'] }, error: /^Snapshot 1 is not an object/ },
    { name: 'rejects a missing schema_version', data: { snapshots: [snapshot(undefined)] }, error: /^Snapshot 1 \(commit abcdef0\) has no schema_version\. Supported versions: 1\.0, 2\.0\./ },
    { name: 'rejects a numeric schema_version', data: { snapshots: [snapshot(2)] }, error: /has no schema_version/ },
    { name: 'rejects an unknown schema_version', data: { snapshots: [snapshot('2.0'), snapshot('3.0')] }, error: /^Snapshot 2 \(commit abcdef0\) has schema_version "3\.0", which this dashboard does not support/ },
    { name: 'rejects a missing functions array', data: { snapshots: [snapshot('2.0', { functions: null })] }, error: /has no "functions" array/ },
  ])('$name', ({ data, error }) => {
    expect(() => parseHistory(data)).toThrow(error);
  });
});

describe('rateLimitFrom', () => {
  const now = Date.UTC(2026, 9, 27, 12, 0, 0);

  it.each([
    { name: 'primary limit: 403 with remaining 0 uses the reset time', status: 403, h: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1793102400' }, message: 'API rate limit exceeded', retryAt: new Date(1793102400 * 1000) },
    { name: 'primary limit on 429', status: 429, h: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1793102400' }, message: '', retryAt: new Date(1793102400 * 1000) },
    { name: 'secondary limit with retry-after', status: 403, h: { 'retry-after': '60' }, message: 'You have exceeded a secondary rate limit', retryAt: new Date(now + 60_000) },
    { name: 'secondary limit without retry-after', status: 403, h: {}, message: 'You have exceeded a secondary rate limit', retryAt: null },
    { name: '429 without headers', status: 429, h: {}, message: 'Too Many Requests', retryAt: null },
  ])('$name', ({ status, h, message, retryAt }) => {
    const result = rateLimitFrom(status, headers(h), message, now);
    expect(result).toBeInstanceOf(RateLimitError);
    expect(result?.retryAt).toEqual(retryAt);
    expect(result?.message).toBe(`The data source is rate-limiting requests (HTTP ${status}).`);
  });

  it.each([
    { name: 'a 403 that is not a rate limit', status: 403, h: { 'x-ratelimit-remaining': '42' }, message: 'Resource not accessible' },
    { name: 'a 404', status: 404, h: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1793102400' }, message: 'Not Found' },
  ])('ignores $name', ({ status, h, message }) => {
    expect(rateLimitFrom(status, headers(h), message, now)).toBeNull();
  });
});

describe('fetchSnapshotHistory', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    getContent.mockReset();
    clearGithubCache();
  });

  it('turns a rate-limited fetch into a RateLimitError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', {
      status: 403,
      statusText: 'Forbidden',
      headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1793102400' },
    })));

    const error = await fetchSnapshotHistory('https://example.test/history.json').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RateLimitError);
    expect((error as RateLimitError).retryAt).toEqual(new Date(1793102400 * 1000));
  });

  it('keeps other HTTP errors as plain errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404, statusText: 'Not Found' })));

    await expect(fetchSnapshotHistory('https://example.test/history.json')).rejects.toThrow('Failed to fetch history: Not Found');
  });

  it('rejects a fetched history with an unknown schema_version', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ snapshots: [snapshot('3.0')] }))));

    await expect(fetchSnapshotHistory('https://example.test/history.json')).rejects.toThrow(/schema_version "3\.0"/);
  });

  it('turns a rate-limited GitHub request into a RateLimitError', async () => {
    getContent.mockRejectedValue({
      status: 403,
      message: 'API rate limit exceeded for 203.0.113.1.',
      response: { headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1793102400' } },
    });

    const error = await fetchSnapshotHistory('github://owner/repo/main/history.json').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RateLimitError);
  });

  it('reads and checks a history file from GitHub as raw content', async () => {
    const history = { snapshots: [snapshot('2.0')] };
    getContent.mockResolvedValue({ data: JSON.stringify(history), headers: {} });

    await expect(fetchSnapshotHistory('github://owner/repo/main/history.json')).resolves.toEqual(history);
    expect(getContent).toHaveBeenCalledWith({
      owner: 'owner', repo: 'repo', ref: 'main', path: 'history.json', mediaType: { format: 'raw' },
    });
  });

  // GitHub's JSON form of a file over 1 MB: no content (checked on a 2.4 MB file, 2026-10-28).
  // The raw form is a string, so this shape can only come back for something that is not a file.
  it.each([
    { name: 'a directory listing', data: [{ type: 'file', name: 'history.json' }] },
    { name: 'a JSON file object without content', data: { type: 'file', encoding: 'none', content: '' } },
  ])('rejects $name', async ({ data }) => {
    getContent.mockResolvedValue({ data });

    await expect(fetchSnapshotHistory('github://owner/repo/main/history')).rejects.toThrow('GitHub API fetch failed: Not a valid file');
  });

  describe('reusing GitHub reads', () => {
    const url = 'github://owner/repo/main/history.json';
    const history = { snapshots: [snapshot('2.0')] };
    // The Contents API's own header (checked 2026-10-28).
    const fresh60 = { data: JSON.stringify(history), headers: { 'cache-control': 'public, max-age=60, s-maxage=60' } };

    it('reuses a result for its max-age and fetches again after it', async () => {
      getContent.mockResolvedValue(fresh60);
      const t0 = Date.UTC(2026, 9, 29, 12, 0, 0);

      await fetchSnapshotHistory(url, () => t0);
      await expect(fetchSnapshotHistory(url, () => t0 + 59_999)).resolves.toEqual(history);
      expect(getContent).toHaveBeenCalledTimes(1);
      expect(githubFetchInfo(url)).toEqual({ fetchedAt: new Date(t0), freshUntil: new Date(t0 + 60_000) });

      await fetchSnapshotHistory(url, () => t0 + 60_000);
      expect(getContent).toHaveBeenCalledTimes(2);
      expect(githubFetchInfo(url)?.fetchedAt).toEqual(new Date(t0 + 60_000));
    });

    it('fetches every time when the response has no max-age', async () => {
      getContent.mockResolvedValue({ data: JSON.stringify(history), headers: {} });

      await fetchSnapshotHistory(url, () => 1000);
      await fetchSnapshotHistory(url, () => 1001);
      expect(getContent).toHaveBeenCalledTimes(2);
    });

    it('keeps each URL separately', async () => {
      getContent.mockResolvedValue(fresh60);

      await fetchSnapshotHistory(url, () => 1000);
      await fetchSnapshotHistory('github://owner/repo/main/other.json', () => 1001);
      expect(getContent).toHaveBeenCalledTimes(2);
    });

    it('does not keep a history that fails its checks', async () => {
      getContent.mockResolvedValue({ ...fresh60, data: JSON.stringify({ snapshots: [snapshot('3.0')] }) });

      await expect(fetchSnapshotHistory(url, () => 1000)).rejects.toThrow(/schema_version "3\.0"/);
      expect(githubFetchInfo(url)).toBeNull();
    });
  });
});

describe('maxAgeSeconds', () => {
  it.each([
    { header: 'public, max-age=60, s-maxage=60', want: 60 },
    { header: 'max-age=300', want: 300 },
    { header: 'private, max-age=60', want: 60 },
    { header: 'no-cache', want: 0 },
    { header: 'max-age=60, no-store', want: 0 },
    { header: 's-maxage=60', want: 0 },
    { header: '', want: 0 },
    { header: undefined, want: 0 },
  ])('$header → $want', ({ header, want }) => {
    expect(maxAgeSeconds(header)).toBe(want);
  });
});
