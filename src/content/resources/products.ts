import type { ResourceConfig } from './types';
import { ApiListRoute, PageRoute } from '../routes';

export const products: ResourceConfig = {
  name: 'products',
  urlMatcher: ApiListRoute.Products,
  pageUrl: PageRoute.Products,
  itemsKey: '_products',
  idKey: '_id',
  paginationParam: 'skip',
};
