/**
 * TNT Creator Scraper — Content Script
 */

(function initScraper() {
  console.log('%c[TNT Scraper] LOADED & READY', 'background: #222; color: #bada55; font-size: 14px');

  function parseCount(text) {
    if (!text) return null;
    const clean = text.replace(/,/g, '').trim();
    // Match 118.4K, 1,000, 1M, etc.
    const numPart = clean.match(/(\d+\.?\d*)\s*([KkMmBb]?)/);
    if (!numPart) return null;

    const value = parseFloat(numPart[1]);
    const multiplier = numPart[2].toLowerCase();
    if (multiplier === 'k') return Math.round(value * 1_000);
    if (multiplier === 'm') return Math.round(value * 1_000_000);
    if (multiplier === 'b') return Math.round(value * 1_000_000_000);
    return Math.round(value);
  }

  function extractPartnerCenter() {
    const currentUrl = window.location.href;
    
    // PRIORITAS 1: Gunakan Hash yang Anda berikan di awal (ini paling akurat kalau ketemu)
    const usernameEl = document.querySelector('[data-e2e="b7f56c3b-f013-3448"]');
    const followersEl = document.querySelector('[data-e2e="7aed0dd7-48ba-6932"]') || document.querySelector('[data-e2e="49c18139-df74-589a"]');
    const mcnEl = document.querySelector('[data-e2e="85040a36-fb50-9f7c"]');
    const levelEl = document.querySelector('.arco-tag-content') || document.querySelector('[data-e2e*="190b477a"]');

    let username = usernameEl?.textContent?.trim() || '';
    let followersText = followersEl?.textContent?.trim() || '';
    let mcn = mcnEl?.textContent?.trim() || '';
    let level = '';

    // Cari Level di dalam elemen levelEl
    if (levelEl && levelEl.textContent.includes('LVL')) {
      level = levelEl.textContent.match(/LVL\s*\d+/i)?.[0] || '';
    }

    // PRIORITAS 2: Jika Hash gagal, baru cari berdasarkan label (TAPI hanya di area profil)
    if (!username || !followersText) {
      const profileHeader = document.querySelector('.flex-col');
      if (profileHeader) {
        const spans = profileHeader.querySelectorAll('span, div');
        spans.forEach(el => {
          const text = el.textContent.trim();
          if (!username && el.classList.contains('text-head-l')) username = text;
          if (text.includes('Followers')) followersText = el.parentElement?.textContent.replace('Followers', '').trim();
          if (text.includes('MCN')) mcn = el.parentElement?.textContent.replace('MCN', '').trim();
          if (!level && /LVL\s*\d+/i.test(text)) level = text.match(/LVL\s*\d+/i)[0];
        });
      }
    }

    if (!username && !followersText) return null;

    const data = {
      username: username || '',
      followers_count: parseCount(followersText),
      mcn: mcn || '',
      level: level || '',
      url: currentUrl,
      source: 'Partner Center'
    };
    console.log('[TNT Scraper] SUCCESS! Detected:', data);
    return data;
  }

  function saveData() {
    const currentUrl = window.location.href;
    let data = null;

    if (currentUrl.includes('partner.tiktokshop.com')) {
      data = extractPartnerCenter();
    } else if (currentUrl.includes('tiktok.com/@')) {
      const pathParts = window.location.pathname.split('/');
      const rawUser = pathParts[1] || '';
      const user = rawUser.startsWith('@') ? rawUser.slice(1) : rawUser;
      if (user) data = { username: user, url: currentUrl, source: 'TikTok Profile' };
    }

    if (data && data.username) {
      data.scrapedAt = Date.now();
      
      // Kirim ke Background Script (Gudang Data Pusat)
      // Ini aman dari blokir storage karena pesan dikirim ke asisten ekstensi
      chrome.runtime.sendMessage({ type: 'SAVE_DATA', data }, (response) => {
        // Log saja untuk debug
        if (chrome.runtime.lastError) {
          console.warn('[TNT Scraper] Message failed (likely context invalidated, please refresh)');
        } else {
          console.log('[TNT Scraper] Data sent to Background Storage');
        }
      });
    }
    return data;
  }

  // Initial
  saveData();
  
  // Observe changes
  const observer = new MutationObserver(() => saveData());
  observer.observe(document.body, { childList: true, subtree: true });
})();

