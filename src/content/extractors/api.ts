// API extractor: replays the captured request once against the Kyte API
// using the captured headers, applying any filter overrides. Resource-agnostic.

import axios, { type AxiosAdapter, type AxiosResponse } from 'axios';
import type { InjectState, CapturedRequest } from '../state';
import type { ResourceConfig } from '../resources';
import { findItemsArray } from '../shared';

const TAG = '[kyte-extract:api]';

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

  const raw = await replay(req, state.origFetch, filter);
  const items = findItemsArray(raw, resource);
  console.log(TAG, `[${resource.name}] single call: got ${items.length} items`);
  return items;
};
