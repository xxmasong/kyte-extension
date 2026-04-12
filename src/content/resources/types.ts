// Resource definitions: declarative descriptions of each Kyte API resource we
// can extract. Adding a new resource is a matter of dropping a file in this
// folder and registering it in `index.ts` — extractors and the inject patch
// stay untouched.

export type ResourceName = 'transactions' | 'orders' | 'customers' | 'products';

export type ResourceConfig = {
  name: ResourceName;
  urlMatcher: RegExp;
  pageUrl: string;
  // Optional: required query params on the captured URL. Used to distinguish
  // resources that share the same endpoint (e.g. transactions vs orders both
  // hit /sale? but with different `status` values).
  requiredParams?: Record<string, string>;
  itemsKey?: string;
  idKey?: string;
  paginationParam?: string;
};
