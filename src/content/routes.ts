// Centralized registry of every route the extension knows about.
// Page routes (what the user sees in the browser) and API routes
// (what inject.ts matches against captured requests) live here so
// they can be audited in one place.

export enum PageRoute {
  Transactions = 'https://web.kyteapp.com/sales',
  Orders = 'https://web.kyteapp.com/orders',
  Customers = 'https://web.kyteapp.com/customers',
  Products = 'https://web.kyteapp.com/products',
}

// Detail page templates. `:id` is a placeholder — substitute before use.
export enum DetailPageRoute {
  Transaction = 'https://web.kyteapp.com/sales/:id',
  Order = 'https://web.kyteapp.com/orders/:id',
  Customer = 'https://web.kyteapp.com/customers/:id',
  Product = 'https://web.kyteapp.com/products/:id',
}

// API matchers for list endpoints. Regex can't live in a TS enum,
// so this is a const object with the same access ergonomics.
export const ApiListRoute = {
  Transactions: /kyte-api-gateway\.azure-api\.net\/api\/kyte-web\/sale\?/,
  Orders: /kyte-api-gateway\.azure-api\.net\/api\/kyte-web\/sale\?/,
  Customers: /kyte-api-gateway\.azure-api\.net\/api\/kyte-web\/customer\/[^/]+\/list/,
  Products: /kyte-api-gateway\.azure-api\.net\/api\/kyte-web\/products\//,
} as const;

// Detail endpoints — to be filled in when detail extraction is implemented.
// Each resource may have multiple API calls per detail page.
export const ApiDetailRoute = {
  Transaction: [] as RegExp[],
  Order: [] as RegExp[],
  Customer: [] as RegExp[],
  Product: [] as RegExp[],
} as const;
