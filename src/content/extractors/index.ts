// Extractor registry and dispatcher. Adding a new method:
//   1. Implement (state, resource, options) => Promise<unknown[]>
//   2. Register it below.
// Resources are looked up by name and passed in — extractors stay generic.

import type { InjectState } from '../state';
import { resources, type ResourceName } from '../resources';
import { capturedExtractor, type CapturedOptions } from './captured';
import { apiExtractor, type ApiOptions } from './api';

export type ExtractMethod = 'captured' | 'api';

export type ExtractOptionsByMethod = {
  captured: CapturedOptions;
  api: ApiOptions;
};

type Extractor<M extends ExtractMethod> = (
  state: InjectState,
  resource: (typeof resources)[ResourceName],
  options: ExtractOptionsByMethod[M],
) => Promise<unknown[]>;

const registry: { [M in ExtractMethod]: Extractor<M> } = {
  captured: capturedExtractor,
  api: apiExtractor,
};

export const extract = async <M extends ExtractMethod>(
  resourceName: ResourceName,
  method: M,
  state: InjectState,
  options: ExtractOptionsByMethod[M],
): Promise<unknown[]> => {
  const resource = resources[resourceName];
  if (!resource) throw new Error(`unknown resource: ${resourceName}`);
  const fn = registry[method];
  if (!fn) throw new Error(`unknown extractor method: ${method}`);
  return fn(state, resource, options);
};
