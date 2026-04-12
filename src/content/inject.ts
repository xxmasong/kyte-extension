// Main-world entry point. Uses @mswjs/interceptors to observe every fetch +
// XHR request the Kyte app makes, routes matches into per-resource buckets,
// then dispatches extraction requests from the isolated content script.

import { BatchInterceptor } from '@mswjs/interceptors';
import { FetchInterceptor } from '@mswjs/interceptors/fetch';
import { XMLHttpRequestInterceptor } from '@mswjs/interceptors/XMLHttpRequest';
import { createState, type InjectState, type CapturedRequest } from './state';
import { parseFilter } from './shared';
import { matchResource, resources, type ResourceConfig, type ResourceName } from './resources';
import { extract, type ExtractMethod } from './extractors';

(() => {
  const TAG = '[kyte-inject]';

  if ((window as unknown as { __kyteHooked?: boolean }).__kyteHooked) return;
  (window as unknown as { __kyteHooked?: boolean }).__kyteHooked = true;

  const state: InjectState = createState(Object.keys(resources) as ResourceName[]);

  const recordCapture = (
    resource: ResourceConfig,
    req: CapturedRequest,
    data: unknown,
  ) => {
    const bucket = state.byResource[resource.name];
    bucket.lastRequest = req;
    bucket.lastResponse = data;
    bucket.captured.push(data);
    console.log(TAG, `[${resource.name}] captured`, { url: req.url, data });
  };

  const headersToObject = (h: Headers): Record<string, string> => {
    const out: Record<string, string> = {};
    h.forEach((v, k) => (out[k] = v));
    return out;
  };

  const interceptor = new BatchInterceptor({
    name: 'kyte-interceptor',
    interceptors: [new FetchInterceptor(), new XMLHttpRequestInterceptor()],
  });

  interceptor.on('response', async ({ request, response }) => {
    const resource = matchResource(request.url);
    if (!resource) return;
    try {
      const data = await response.clone().json();
      recordCapture(
        resource,
        {
          url: request.url,
          method: request.method.toUpperCase(),
          headers: headersToObject(request.headers),
          transport: 'fetch',
        },
        data,
      );
    } catch (e) {
      console.warn(TAG, `[${resource.name}] failed to parse response`, e);
    }
  });

  interceptor.apply();

  // ---- message bridge ----
  type ExtractMessage = {
    source: 'kyte-content';
    type: 'EXTRACT';
    resource: ResourceName;
    method: ExtractMethod;
    filter?: string;
  };

  type StatusMessage = {
    source: 'kyte-content';
    type: 'STATUS';
    resource: ResourceName;
  };

  const handleExtract = async (msg: ExtractMessage) => {
    try {
      const options =
        msg.method === 'api' ? { filter: parseFilter(msg.filter ?? '') } : {};
      const items = await extract(msg.resource, msg.method, state, options as never);
      const safe = JSON.parse(JSON.stringify(items));
      window.postMessage(
        { source: 'kyte-inject', type: 'EXTRACT_RESULT', items: safe },
        '*',
      );
    } catch (e) {
      console.warn(TAG, 'EXTRACT failed', e);
      window.postMessage(
        { source: 'kyte-inject', type: 'EXTRACT_ERROR', error: (e as Error).message },
        '*',
      );
    }
  };

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data as ExtractMessage | StatusMessage | undefined;
    if (!data || data.source !== 'kyte-content') return;

    if (data.type === 'EXTRACT') {
      handleExtract(data);
    } else if (data.type === 'STATUS') {
      const bucket = state.byResource[data.resource];
      window.postMessage(
        {
          source: 'kyte-inject',
          type: 'STATUS_RESULT',
          resource: data.resource,
          hasRequest: !!bucket?.lastRequest,
          capturedCount: bucket?.captured.length ?? 0,
        },
        '*',
      );
    }
  });
})();
