import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import ApiIcon from '@mui/icons-material/Api';
import { resources } from '../content/resources';

const KYTE_URL_RE = /^https:\/\/web\.kyteapp\.com\//;

type Status = 'idle' | 'checking' | 'extracting' | 'reloading' | 'done' | 'error';
type Resource = 'transactions' | 'orders' | 'customers' | 'products';

const RESOURCES: { value: Resource; label: string }[] = [
  { value: 'transactions', label: 'Transactions' },
  { value: 'orders', label: 'Orders' },
  { value: 'customers', label: 'Customers' },
  { value: 'products', label: 'Products' },
];

const validateFilter = (raw: string): string | null => {
  if (!raw.trim()) return null;
  try {
    new URLSearchParams(raw.replace(/^\?/, ''));
    return null;
  } catch (e) {
    return (e as Error).message;
  }
};

export default function App() {
  const [tab, setTab] = useState<chrome.tabs.Tab | null>(null);
  const [resource, setResource] = useState<Resource>('transactions');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string>('');
  const [hasCapture, setHasCapture] = useState<boolean>(false);
  const [filter, setFilter] = useState<string>('');

  const onKyteSite = !!tab?.url && KYTE_URL_RE.test(tab.url);
  const filterError = validateFilter(filter);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (cancelled) return;
      setTab(t ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tab?.id || !onKyteSite) {
        setHasCapture(false);
        return;
      }
      try {
        const res = await chrome.tabs.sendMessage(tab.id, {
          type: 'KYTE_STATUS',
          resource,
        });
        if (!cancelled) setHasCapture(!!res?.hasRequest);
      } catch {
        if (!cancelled) setHasCapture(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, onKyteSite, resource]);

  const waitForTabComplete = (tabId: number, timeoutMs = 30_000) =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error('Tab load timeout'));
      }, timeoutMs);
      const listener = (id: number, info: chrome.tabs.TabChangeInfo) => {
        if (id === tabId && info.status === 'complete') {
          clearTimeout(timer);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });

  const waitForCapture = async (tabId: number, timeoutMs = 20_000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await chrome.tabs.sendMessage(tabId, {
          type: 'KYTE_STATUS',
          resource,
        });
        if (res?.hasRequest) return true;
      } catch {
        // not ready
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    return false;
  };

  const stripUrl = (u: string) => u.split('#')[0].split('?')[0].replace(/\/+$/, '');

  const classifyUrl = (
    current: string | undefined,
  ): { resource: Resource; context: 'list' | 'detail' } | null => {
    if (!current) return null;
    const c = stripUrl(current);
    for (const r of RESOURCES) {
      const t = stripUrl(resources[r.value].pageUrl);
      if (c === t) return { resource: r.value, context: 'list' };
      if (c.startsWith(t + '/')) return { resource: r.value, context: 'detail' };
    }
    return null;
  };

  const ensureOnPage = async (tabId: number) => {
    const current = classifyUrl(tab?.url);
    if (current?.resource === resource) return;
    const target = resources[resource].pageUrl;
    setStatus('reloading');
    setMessage(`Navigating to ${target}...`);
    await chrome.tabs.update(tabId, { url: target });
    await waitForTabComplete(tabId);
    const ok = await waitForCapture(tabId);
    if (!ok) throw new Error(`Timed out waiting for ${resource} API request.`);
  };

  const ensureCaptured = async (tabId: number) => {
    let statusRes: { ok: boolean; hasRequest?: boolean } | null = null;
    try {
      statusRes = await chrome.tabs.sendMessage(tabId, {
        type: 'KYTE_STATUS',
        resource,
      });
    } catch {
      statusRes = null;
    }
    if (!statusRes?.hasRequest) {
      setStatus('reloading');
      setMessage(`Reloading page to capture ${resource} API request...`);
      await chrome.tabs.reload(tabId);
      await waitForTabComplete(tabId);
      const ok = await waitForCapture(tabId);
      if (!ok) throw new Error(`Timed out waiting for ${resource} API request.`);
    }
  };

  const downloadItems = async (items: unknown[], suffix: string) => {
    const dlRes = await chrome.runtime.sendMessage({
      type: 'KYTE_DOWNLOAD_JSON',
      filename: `kyte-${resource}-${suffix}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
      payload: {
        resource,
        extractedAt: new Date().toISOString(),
        count: items.length,
        items,
      },
    });
    if (!dlRes?.ok) throw new Error(dlRes?.error || 'Download failed');
  };

  const runExtract = async (method: 'captured' | 'api') => {
    if (!tab?.id) return;
    if (method === 'api' && filterError) {
      setStatus('error');
      setMessage(`Invalid filter: ${filterError}`);
      return;
    }
    setStatus('checking');
    setMessage('');
    try {
      const current = classifyUrl(tab?.url);
      if (current?.resource === resource && current.context === 'detail') {
        throw new Error(`Detail-page extraction for ${resource} is not implemented yet.`);
      }
      await ensureOnPage(tab.id);
      if (method === 'captured') {
        await ensureCaptured(tab.id);
      }
      setStatus('extracting');
      setMessage(method === 'api' ? 'Calling API...' : 'Collecting captured responses...');
      const res = await chrome.tabs.sendMessage(tab.id, {
        type: 'KYTE_EXTRACT',
        resource,
        method,
        filter: method === 'api' ? filter : undefined,
      });
      if (!res?.ok) throw new Error(res?.error || 'Extraction failed');
      const items = res.items as unknown[];
      setMessage(`Got ${items.length} ${resource}. Saving...`);
      await downloadItems(items, method);
      setStatus('done');
      setMessage(`Downloaded ${items.length} ${resource}.`);
    } catch (e) {
      setStatus('error');
      setMessage((e as Error).message);
    }
  };

  const busy = status === 'checking' || status === 'extracting' || status === 'reloading';

  return (
    <Box sx={{ p: 2, width: 360 }}>
      <Stack spacing={2}>
        <Typography variant="h6">Kyte Extractor</Typography>

        {!onKyteSite && (
          <Alert severity="warning">
            Open <code>web.kyteapp.com</code> to use this.
          </Alert>
        )}

        <TextField
          select
          label="Resource"
          size="small"
          value={resource}
          onChange={(e) => setResource(e.target.value as Resource)}
          disabled={busy}
        >
          {RESOURCES.map((r) => (
            <MenuItem key={r.value} value={r.value}>
              {r.label}
            </MenuItem>
          ))}
        </TextField>

        {onKyteSite && hasCapture && status === 'idle' && (
          <Alert severity="success">{resource} request captured. Ready.</Alert>
        )}

        <Button
          variant="outlined"
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
          onClick={() => runExtract('captured')}
          disabled={!onKyteSite || busy}
        >
          {busy ? 'Working...' : 'Extract observed (captured)'}
        </Button>

        <Divider>API call</Divider>

        <TextField
          label="Filter (raw query string)"
          placeholder="status=closed&payment=cash"
          size="small"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          error={!!filterError}
          helperText={filterError ?? 'Optional. Overrides params on the captured URL.'}
          disabled={busy}
          multiline
          maxRows={3}
        />

        <Button
          variant="contained"
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <ApiIcon />}
          onClick={() => runExtract('api')}
          disabled={!onKyteSite || busy || !!filterError}
        >
          {busy ? 'Working...' : 'Extract ALL (paginated)'}
        </Button>

        {message && (
          <Alert severity={status === 'error' ? 'error' : status === 'done' ? 'success' : 'info'}>
            {message}
          </Alert>
        )}
      </Stack>
    </Box>
  );
}
