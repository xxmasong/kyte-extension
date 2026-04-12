import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

export default defineManifest({
  manifest_version: 3,
  name: 'Kyte Extension',
  version: pkg.version,
  description: 'Extract Kyte sales data to JSON',
  icons: {
    16: 'icons/kyte-16.png',
    32: 'icons/kyte-32.png',
    48: 'icons/kyte-48.png',
    128: 'icons/kyte-128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'Kyte Extractor',
    default_icon: {
      16: 'icons/kyte-16.png',
      32: 'icons/kyte-32.png',
      48: 'icons/kyte-48.png',
    },
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['https://web.kyteapp.com/*'],
      js: ['src/content/inject.ts'],
      run_at: 'document_start',
      all_frames: false,
      world: 'MAIN',
    },
    {
      matches: ['https://web.kyteapp.com/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_start',
      all_frames: false,
    },
  ],
  host_permissions: [
    'https://web.kyteapp.com/*',
    'https://kyte-api-gateway.azure-api.net/*',
  ],
  permissions: ['storage', 'activeTab', 'tabs', 'downloads', 'scripting'],
});
