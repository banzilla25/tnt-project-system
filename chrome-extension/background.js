chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'IMPORT_ALL') {
    const queue = request.payload;
    
    // Convert to spreadsheet row format
    const rows = queue.map(c => ({
      id: Math.random().toString(36).substring(2, 9),
      username: c.username,
      followers: String(c.followers || ''),
      level: c.level ? String(c.level).replace(/\D/g, '') : '',
      audience_age: c.audience_age || '',
      gmv_30d: String(c.gmv_30d || ''),
      niche: c.niche || '',
      whatsapp: c.no_whatsapp || '',
      mcn: c.mcn || '',
      ratecard: ''
    }));

    // Target domains
    const targetUrl = 'https://campaign.tntkreatif.com/creator-pool/import';
    
    // Find existing tab
    chrome.tabs.query({ url: ["*://campaign.tntkreatif.com/*", "*://localhost/*"] }, (tabs) => {
      if (tabs.length > 0) {
        // Use the first found tab
        const tab = tabs[0];
        
        // Focus the tab and window
        chrome.tabs.update(tab.id, { active: true });
        chrome.windows.update(tab.windowId, { focused: true });

        // Inject script immediately
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (dataToInject) => {
            const existing = JSON.parse(localStorage.getItem('tnt_import_draft_global') || '[]');
            // keep existing rows that have username
            const validExisting = existing.filter(r => r && r.username && r.username.trim() !== '');
            const merged = [...validExisting, ...dataToInject];
            
            localStorage.setItem('tnt_import_draft_global', JSON.stringify(merged));
            // Navigate/Reload to the import page so React picks up the new state
            window.location.href = '/creator-pool/import';
          },
          args: [rows]
        }, () => {
          sendResponse({ success: true });
        });
      } else {
        // Create new tab
        chrome.tabs.create({ url: targetUrl }, (tab) => {
          chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
            if (info.status === 'complete' && tabId === tab.id) {
              chrome.tabs.onUpdated.removeListener(listener);
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (dataToInject) => {
                  localStorage.setItem('tnt_import_draft_global', JSON.stringify(dataToInject));
                  window.location.reload();
                },
                args: [rows]
              });
            }
          });
          sendResponse({ success: true });
        });
      }
    });

    return true; // async response
  }
});
