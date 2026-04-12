import type { ResourceConfig } from './types';
import { ApiListRoute, PageRoute } from '../routes';

export const transactions: ResourceConfig = {
  name: 'transactions',
  urlMatcher: ApiListRoute.Transactions,
  pageUrl: PageRoute.Transactions,
  requiredParams: { status: 'closed' },
  itemsKey: '_sales',
  idKey: '_id',
};
