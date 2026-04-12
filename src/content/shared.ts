// Pure helpers shared by extractors. All resource-agnostic.

import type { ResourceConfig } from './resources';

// Find the items array inside a response. If the resource provides an
// explicit `itemsKey`, use it. Otherwise fall back to the heuristic.
export const findItemsArray = (data: unknown, resource?: ResourceConfig): unknown[] => {
  if (resource?.itemsKey && data && typeof data === 'object') {
    const v = (data as Record<string, unknown>)[resource.itemsKey];
    if (Array.isArray(v)) return v;
  }
  return findItemsHeuristic(data);
};

const findItemsHeuristic = (data: unknown): unknown[] => {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, unknown>;
  for (const key of ['_sales', 'sales', 'items', 'data', 'results', 'result', 'list', 'records']) {
    const v = obj[key];
    if (Array.isArray(v)) return v;
  }
  for (const v of Object.values(obj)) {
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') return v;
    if (v && typeof v === 'object') {
      const nested = findItemsHeuristic(v);
      if (nested.length) return nested;
    }
  }
  return [];
};

// Stable identity for an item, for cross-page dedup. Honors resource.idKey if set.
export const itemKey = (item: unknown, resource?: ResourceConfig): string => {
  if (!item || typeof item !== 'object') return JSON.stringify(item);
  const o = item as Record<string, unknown>;
  if (resource?.idKey && o[resource.idKey] != null) return String(o[resource.idKey]);
  return String(o._id ?? o.id ?? o.uuid ?? JSON.stringify(o));
};

// Validate + parse a raw query string into a key/value object.
export const parseFilter = (raw: string): Record<string, string> => {
  if (!raw || !raw.trim()) return {};
  const cleaned = raw.replace(/^\?/, '');
  const params = new URLSearchParams(cleaned);
  const out: Record<string, string> = {};
  params.forEach((v, k) => (out[k] = v));
  return out;
};

