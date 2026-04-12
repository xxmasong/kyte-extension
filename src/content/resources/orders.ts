import type { ResourceConfig } from './types';
import { ApiListRoute, PageRoute } from '../routes';

export const orders: ResourceConfig = {
  name: 'orders',
  urlMatcher: ApiListRoute.Orders,
  pageUrl: PageRoute.Orders,
  requiredParams: { status: 'all' },
  itemsKey: '_sales',
  idKey: '_id',
};
