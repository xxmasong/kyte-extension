chrome.runtime.onInstalled.addListener((details) => {
  console.log('[kyte-bg] installed', details.reason);
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'KYTE_DOWNLOAD_JSON') {
    const json = JSON.stringify(msg.payload, null, 2);
    const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
    const filename = msg.filename || `kyte-sales-${Date.now()}.json`;
    chrome.downloads.download(
      { url: dataUrl, filename, saveAs: true },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ ok: true, downloadId });
        }
      },
    );
    return true;
  }
  return false;
});
