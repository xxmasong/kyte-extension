// Per-resource state bucket. The inject script's network patches populate
// these via the resource registry; extractors read from them.

import type { ResourceName } from './resources';

export type CapturedRequest = {
  url: string;
  method: string;
  headers: Record<string, string>;
  transport: 'fetch' | 'xhr';
};

export type ResourceState = {
  lastRequest: CapturedRequest | null;
  lastResponse: unknown;
  captured: unknown[];
};

export type InjectState = {
  byResource: Record<ResourceName, ResourceState>;
  origFetch: typeof fetch;
};

const emptyResourceState = (): ResourceState => ({
  lastRequest: null,
  lastResponse: null,
  captured: [],
});

export const createState = (resourceNames: ResourceName[]): InjectState => {
  const byResource = {} as Record<ResourceName, ResourceState>;
  for (const name of resourceNames) byResource[name] = emptyResourceState();
  return {
    byResource,
    origFetch: window.fetch.bind(window),
  };
};
