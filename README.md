# Kyte Extension

A Chrome extension that extracts data from [web.kyteapp.com](https://web.kyteapp.com) and downloads it as JSON. Supports transactions, orders, customers, and products.

## What it does

Kyte is a web-based POS / inventory tool. Its admin UI lists resources (sales, orders, customers, products) but has no bulk-export feature. This extension sits alongside the Kyte web app, observes the authenticated API requests the page makes, and lets you dump them — either the responses that happened to be captured while you browsed, or by replaying the request directly against the Kyte API.

Two extraction modes:

- **Extract observed (captured)** — collects every response the Kyte UI already fetched since the page loaded. Best when you've been clicking around and want to save what's on screen.
- **Extract ALL (paginated)** — replays the most recently captured request against the API, optionally with overridden query parameters (e.g. `status=closed&payment=cash`). Resources with offset pagination (customers, products) are paged until the API returns a short page, with duplicates removed by id. Reuses the page's auth headers so no token plumbing is required.

Output is a timestamped `.json` file saved via the browser's download dialog.

## Supported resources

| Resource     | List page                          | Detail page (reserved)             |
| ------------ | ---------------------------------- | ---------------------------------- |
| Transactions | `web.kyteapp.com/sales`            | `web.kyteapp.com/sales/:id`        |
| Orders       | `web.kyteapp.com/orders`           | `web.kyteapp.com/orders/:id`       |
| Customers    | `web.kyteapp.com/customers`        | `web.kyteapp.com/customers/:id`    |
| Products     | `web.kyteapp.com/products`         | `web.kyteapp.com/products/:id`     |

Detail pages (`/:id`) are recognized but extraction on them is **not yet implemented** — the popup will refuse with a clear error. The plan is to support per-resource detail endpoints (e.g. product detail + stock movement + purchase history) in a future release.

## Install (unpacked)

1. Clone this repo.
2. `npm install`
3. `npm run build` — produces `dist/`.
4. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and point it at `dist/`.
5. Navigate to [web.kyteapp.com](https://web.kyteapp.com), sign in, and click the extension icon.

The version shown in `chrome://extensions` is bumped on every build, so you can tell which build is loaded.

## Usage

1. Open any Kyte page (`/sales`, `/orders`, `/customers`, `/products`).
2. Click the extension icon to open the popup.
3. Pick a resource from the dropdown.
   - If you're already on that resource's page (list or detail), no navigation happens.
   - If you're on a different resource, the extension navigates the tab to the list page and waits for the first API request to fire.
4. Click one of:
   - **Extract observed (captured)** — immediate dump of what's been seen so far.
   - **Extract ALL (paginated)** — replays the captured request. Use the filter field to override query params (raw query-string syntax, e.g. `status=closed&limit=50`).
5. A save dialog appears. The filename is `kyte-<resource>-<method>-<timestamp>.json`.

## Architecture

```
src/
├─ background/
│  └─ index.ts          # Service worker; handles chrome.downloads from the popup.
├─ content/
│  ├─ inject.ts         # MAIN-world script. Installs network interception.
│  ├─ index.ts          # ISOLATED-world content script. Bridges popup <-> inject.
│  ├─ routes.ts         # Centralized page + API route registry.
│  ├─ state.ts          # Per-resource capture buckets.
│  ├─ shared.ts         # Item extraction + identity helpers.
│  ├─ resources/        # One file per resource (urlMatcher, pageUrl, itemsKey...).
│  └─ extractors/
│     ├─ captured.ts    # Drains already-observed responses.
│     └─ api.ts         # Replays request via axios + custom adapter.
└─ popup/
   ├─ App.tsx           # MUI-based UI. Drives navigation + triggers extraction.
   ├─ main.tsx
   └─ index.html
```

### How interception works

[`src/content/inject.ts`](src/content/inject.ts) runs in the page's **main world** at `document_start`. It uses [`@mswjs/interceptors`](https://github.com/mswjs/interceptors) to patch both `fetch` and `XMLHttpRequest` with a single `BatchInterceptor`, listens for `response` events, and routes matching requests into per-resource buckets in [`state.ts`](src/content/state.ts). The matching logic lives in [`resources/index.ts#matchResource`](src/content/resources/index.ts) and uses regex matchers declared per-resource in [`routes.ts`](src/content/routes.ts).

Crucially, the original `window.fetch` is captured **before** the interceptor applies (`state.origFetch`). This lets the API extractor replay requests without re-capturing its own traffic.

### How extraction works

- **Captured mode** ([`extractors/captured.ts`](src/content/extractors/captured.ts)) — walks `state.byResource[name].captured[]`, runs each entry through `findItemsArray` (which honors `itemsKey` if set, else falls back to a heuristic), and returns the flattened list.
- **API mode** ([`extractors/api.ts`](src/content/extractors/api.ts)) — takes the most recent captured request, merges in any filter overrides and the resource's `requiredParams`, and replays via **axios configured with a custom adapter that routes through `state.origFetch`**. This is necessary because axios defaults to XHR, which would be re-captured by the interceptor. The adapter bypasses that cleanly.

### Route registry

[`src/content/routes.ts`](src/content/routes.ts) is the single source of truth for URLs:

- `PageRoute` — enum of list page URLs (`/sales`, `/orders`, etc.)
- `DetailPageRoute` — enum of detail page templates (`/sales/:id`, etc.)
- `ApiListRoute` — const object of regex matchers for list API endpoints.
- `ApiDetailRoute` — const object, reserved for detail-endpoint matchers (empty for now).

Resource files in `src/content/resources/` import from here instead of hardcoding strings or regexes. Adding a new resource means: add entries to `routes.ts`, drop a file in `resources/`, register it in `resources/index.ts`. No changes to extractors or inject needed.

## Build & development

```bash
npm install       # install deps
npm run build     # type-check + vite build -> dist/
npm run dev       # vite dev (popup HMR; content scripts still need reload)
```

Every `npm run build` bumps `package.json` patch version first, so the manifest version displayed in Chrome reflects the loaded build.

### Stack

- **Vite 6** + **@crxjs/vite-plugin** — MV3 extension bundling
- **React 19** + **MUI 6** — popup UI
- **TypeScript 5.7** — strict mode
- **@mswjs/interceptors** — unified fetch/XHR interception in the main world
- **axios** — HTTP client for API replay (with custom fetch adapter)
- **zod** — runtime validation where needed

## Permissions

Declared in [`manifest.config.ts`](manifest.config.ts):

- `storage`, `activeTab`, `tabs`, `downloads`, `scripting`
- Host access: `https://web.kyteapp.com/*`, `https://kyte-api-gateway.azure-api.net/*`

Content scripts only run on `web.kyteapp.com`. The extension never sends data anywhere — extraction is entirely local, and downloads go through the browser's download API.

## Limitations

- **Pagination covers offset (`skip`) endpoints only.** Customers and products page through every record. Transactions and orders still replay the captured request once, because their endpoint has not been mapped to a paging parameter yet.
- **Detail pages are not extractable.** The popup recognizes detail URLs and refuses with "not implemented yet" — the per-resource sub-endpoints (e.g. product + stock movement + purchase history) still need to be wired.
- **No auth token handling of its own.** The extension relies entirely on cookies/headers the Kyte page already has. If you're not signed in, nothing works.
- **Main-world content script.** Because `inject.ts` runs in `world: 'MAIN'`, it can't use `chrome.*` APIs. It communicates with the isolated content script via `window.postMessage`.

## Contributing

Adding a new resource is deliberately boring:

1. Add the list URL to `PageRoute`, detail template to `DetailPageRoute`, and API regex to `ApiListRoute` in [`routes.ts`](src/content/routes.ts).
2. Add the name to the `ResourceName` union in [`resources/types.ts`](src/content/resources/types.ts).
3. Create `resources/<name>.ts` following the existing pattern.
4. Register it in [`resources/index.ts`](src/content/resources/index.ts).
5. Add it to the `RESOURCES` array in [`popup/App.tsx`](src/popup/App.tsx).

No extractor changes needed — they're resource-agnostic.

## License

MIT. Not affiliated with Kyte.
