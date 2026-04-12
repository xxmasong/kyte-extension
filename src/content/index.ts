// Isolated-world content script. Bridges extension messages to the main-world
// inject script via window.postMessage.

const TAG = '[kyte-content]';

const pageRequest = <T>(
  type: string,
  payload: Record<string, unknown> = {},
  timeoutMs = 120_000,
): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error(`page request "${type}" timed out`));
    }, timeoutMs);

    const handler = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.source !== 'kyte-inject') return;

      if (type === 'EXTRACT') {
        if (data.type === 'EXTRACT_RESULT') {
          clearTimeout(timer);
          window.removeEventListener('message', handler);
          resolve(data.items as T);
        } else if (data.type === 'EXTRACT_ERROR') {
          clearTimeout(timer);
          window.removeEventListener('message', handler);
          reject(new Error(data.error));
        }
      } else if (type === 'STATUS' && data.type === 'STATUS_RESULT') {
        clearTimeout(timer);
        window.removeEventListener('message', handler);
        resolve(data as T);
      }
    };

    window.addEventListener('message', handler);
    window.postMessage({ source: 'kyte-content', type, ...payload }, '*');
  });

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'KYTE_EXTRACT') {
    pageRequest<unknown[]>('EXTRACT', {
      resource: msg.resource ?? 'sales',
      method: msg.method ?? 'captured',
      filter: msg.filter ?? '',
    })
      .then((items) => sendResponse({ ok: true, items }))
      .catch((e: Error) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (msg?.type === 'KYTE_STATUS') {
    pageRequest<{ hasRequest: boolean; capturedCount: number }>(
      'STATUS',
      { resource: msg.resource ?? 'sales' },
      2_000,
    )
      .then((s) => sendResponse({ ok: true, ...s }))
      .catch(() => sendResponse({ ok: false, hasRequest: false, capturedCount: 0 }));
    return true;
  }
  return false;
});

console.log(TAG, 'loaded on', location.href);
