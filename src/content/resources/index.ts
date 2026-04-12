import type { ResourceConfig, ResourceName } from './types';
import { transactions } from './transactions';
import { orders } from './orders';
import { customers } from './customers';
import { products } from './products';

export type { ResourceConfig, ResourceName } from './types';

export const resources: Record<ResourceName, ResourceConfig> = {
  transactions,
  orders,
  customers,
  products,
};

export const resourceList: ResourceConfig[] = Object.values(resources);

// Find the first resource whose matcher hits a given URL. If a resource
// declares `requiredParams`, every listed param must match exactly.
export const matchResource = (url: string): ResourceConfig | null => {
  for (const r of resourceList) {
    if (!r.urlMatcher.test(url)) continue;
    if (r.requiredParams) {
      const params = new URL(url).searchParams;
      const ok = Object.entries(r.requiredParams).every(
        ([k, v]) => params.get(k) === v,
      );
      if (!ok) continue;
    }
    return r;
  }
  return null;
};
