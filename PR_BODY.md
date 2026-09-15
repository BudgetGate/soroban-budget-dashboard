## 🚀 Background
The `SPEC.md` dictates that the dashboard must pull its snapshot history "via the GitHub API" rather than relying strictly on unauthenticated GET requests. 

## 🛠️ Problem
The MVP version of `api.ts` used a basic JavaScript `fetch()` command. While this works for public Raw GitHub URLs or Gists, it fails to meet the strict requirement of utilizing the GitHub API to dynamically read file artifacts from repository branches.

## ✨ Solution & Implementation
This PR fully integrates authentic GitHub API data fetching into the Vite application.
- **Octokit Implementation:** Installed `@octokit/rest`.
- **Custom Protocol:** Designed a custom scheme `github://owner/repo/branch/path/to/history.json`.
- **Dynamic Decoding:** When `api.ts` intercepts this custom scheme, it instantiates an `Octokit` client, queries `rest.repos.getContent` for that specific ref and path, and cleanly handles the base64 decoding of the `content` buffer into the typed `SnapshotHistory` JSON.
- **Graceful Fallback:** Standard URLs remain fully supported via the standard `fetch` fallback.

## 📋 Testing
- [x] Verified `api.ts` string parsing logic for the custom `github://` protocol.
- [x] Re-ran Vitest UI test suite (`npm test`) to ensure the Octokit dependency did not break `jsdom` or React Recharts rendering.
