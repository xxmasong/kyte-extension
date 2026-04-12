import type { ResourceConfig } from './types';
import { ApiListRoute, PageRoute } from '../routes';

export const customers: ResourceConfig = {
  name: 'customers',
  urlMatcher: ApiListRoute.Customers,
  pageUrl: PageRoute.Customers,
  itemsKey: '_customers',
  idKey: '_id',
  paginationParam: 'skip',
};
