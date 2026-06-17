/**
 * Background service worker — handles opening the app tab
 * and injecting the queue data via URL params.
 */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SEND_TO_APP') {
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(msg.data))));
    const url = `http://localhost:5173/bulk-input?import=${encoded}`;

    // Check if app tab already open
    chrome.tabs.query({ url: 'http://localhost:5173/*' }, (tabs) => {
      if (tabs.length > 0) {
        const tab = tabs[0];
        chrome.tabs.update(tab.id, { active: true, url });
      } else {
        chrome.tabs.create({ url });
      }
    });

    sendResponse({ ok: true });
  }

  if (msg.type === 'INJECT_CONTENT') {
    chrome.scripting.executeScript({
      target: { tabId: msg.tabId },
      files: ['content.js'],
    }).then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
  }

  if (msg.type === 'SAVE_DATA') {
    chrome.storage.session.set({ currentProfile: msg.data }).then(() => {
        sendResponse({ ok: true });
    });
  }

  return true; // keep message channel open for async
});
