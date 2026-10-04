// API extractor: replays the captured request against the Kyte API using the
// captured headers, applying any filter overrides. Resources that declare a
// `paginationParam` are paged until the API returns a short or empty page.
// Resource-agnostic.

import axios, { type AxiosAdapter, type AxiosResponse } from 'axios';
import type { InjectState, CapturedRequest } from '../state';
import type { ResourceConfig } from '../resources';
import { findItemsArray } from '../shared';

const TAG = '[kyte-extract:api]';

// Hard stop so a misbehaving endpoint can never loop forever.
const MAX_PAGES = 500;

export type ApiOptions = {
  filter?: Record<string, string>;
};

// Custom adapter that routes axios through the stashed origFetch, bypassing
// the @mswjs/interceptors patches. Without this, axios would use XHR and its
// own requests would be captured back into the resource buckets.
const makeAdapter = (origFetch: typeof fetch): AxiosAdapter => async (config) => {
  const res = await origFetch(config.url!, {
    method: config.method?.toUpperCase() ?? 'GET',
    headers: config.headers as unknown as HeadersInit,
  });
  const data = await res.json();
  return {
    data,
    status: res.status,
    statusText: res.statusText,
    headers: Object.fromEntries(res.headers.entries()),
    config,
    request: null,
  } as AxiosResponse;
};

const replay = async (
  req: CapturedRequest,
  origFetch: typeof fetch,
  overrides: Record<string, string>,
): Promise<unknown> => {
  const u = new URL(req.url);
  for (const [k, v] of Object.entries(overrides)) {
    u.searchParams.set(k, v);
  }
  const finalUrl = u.toString();
  console.log(TAG, 'replay', finalUrl);

  const client = axios.create({ adapter: makeAdapter(origFetch) });
  const res = await client.request({
    url: finalUrl,
    method: req.method,
    headers: req.headers,
  });
  return res.data;
};

export const apiExtractor = async (
  state: InjectState,
  resource: ResourceConfig,
  options: ApiOptions = {},
): Promise<unknown[]> => {
  const bucket = state.byResource[resource.name];
  if (!bucket.lastRequest) {
    throw new Error(
      `[${resource.name}] no captured request yet. Visit the page and try again.`,
    );
  }
  const req = bucket.lastRequest;
  const filter = { ...(resource.requiredParams ?? {}), ...(options.filter ?? {}) };

  if (!resource.paginationParam) {
    const raw = await replay(req, state.origFetch, filter);
    const items = findItemsArray(raw, resource);
    console.log(TAG, `[${resource.name}] single call: got ${items.length} items`);
    return items;
  }

  return paginate(req, state.origFetch, resource, filter);
};

// Offset pagination: advance `paginationParam` by the size of each page until
// a page comes back empty or shorter than the first one. Items are de-duplicated
// by `idKey` when the resource declares one, since offset paging can repeat rows
// if records are added while we read.
const paginate = async (
  req: CapturedRequest,
  origFetch: typeof fetch,
  resource: ResourceConfig,
  filter: Record<string, string>,
): Promise<unknown[]> => {
  const param = resource.paginationParam!;
  const startUrl = new URL(req.url);
  let offset = Number(filter[param] ?? startUrl.searchParams.get(param) ?? 0) || 0;

  const all: unknown[] = [];
  const seen = new Set<unknown>();
  let pageSize = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const raw = await replay(req, origFetch, { ...filter, [param]: String(offset) });
    const items = findItemsArray(raw, resource);
    if (page === 0) pageSize = items.length;

    for (const item of items) {
      const id = resource.idKey ? (item as Record<string, unknown>)[resource.idKey] : undefined;
      if (id !== undefined) {
        if (seen.has(id)) continue;
        seen.add(id);
      }
      all.push(item);
    }

    console.log(TAG, `[${resource.name}] page ${page + 1} (${param}=${offset}): ${items.length} items`);
    if (items.length === 0 || items.length < pageSize) break;
    offset += items.length;
  }

  console.log(TAG, `[${resource.name}] paginated: ${all.length} items total`);
  return all;
};
