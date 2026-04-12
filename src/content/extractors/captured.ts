// Captured extractor: drains responses observed by the network patches
// during normal page use. Resource-agnostic.

import type { InjectState } from '../state';
import type { ResourceConfig } from '../resources';
import { findItemsArray } from '../shared';

const TAG = '[kyte-extract:captured]';

export type CapturedOptions = Record<string, never>;

export const capturedExtractor = async (
  state: InjectState,
  resource: ResourceConfig,
  _options: CapturedOptions = {},
): Promise<unknown[]> => {
  const bucket = state.byResource[resource.name];
  console.log(TAG, `[${resource.name}] start. captured.length =`, bucket.captured.length);
  const all: unknown[] = [];
  for (const resp of bucket.captured) {
    const items = findItemsArray(resp, resource);
    console.log(TAG, `[${resource.name}] response yielded`, items.length, 'items');
    all.push(...items);
  }
  console.log(TAG, `[${resource.name}] total:`, all.length);
  return all;
};
