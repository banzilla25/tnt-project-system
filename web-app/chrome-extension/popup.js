/**
 * TNT Creator Scraper — Popup Script
 * Manages the queue of staged TikTok creators and
 * sends them to the TNT Creator Database app.
 */

const APP_URL     = 'http://localhost:5173/bulk-input';
const STORAGE_KEY = 'tnt_scraper_queue';

// ── Tier logic (mirrors db.js) ────────────────────────────────────
function getTier(followers) {
  const f = parseInt(followers);
  if (isNaN(f) || f < 1000)    return null;
  if (f <= 10_000)   return 'Nano';
  if (f <= 100_000)  return 'Micro';
  if (f <= 1_000_000) return 'Macro';
  return 'Mega';
}

function formatFollowers(n) {
  if (!n) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

// ── State ─────────────────────────────────────────────────────────
let currentProfile = null;   // data from current TikTok tab
let queue          = [];      // staged queue (persisted)
let appDatabase    = [];      // creators already in local DB (loaded from app's localStorage)

// ── Load persisted queue ──────────────────────────────────────────
chrome.storage.local.get([STORAGE_KEY], (res) => {
  queue = res[STORAGE_KEY] || [];
  init();
});

// ── Initialize ────────────────────────────────────────────────────
async function init() {
  await loadCurrentTab();
  await loadAppDatabase();
  render();
}

// ── Get current tab profile ───────────────────────────────────────
async function loadCurrentTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      const isTikTok = tab?.url?.includes('tiktok.com/@');
      const isPartner = tab?.url?.includes('partner.tiktokshop.com/affiliate-cmp/creator/detail');

      if (!tab || !tab.url || (!isTikTok && !isPartner)) {
        currentProfile = null;
        resolve();
        return;
      }

      // 1. Try to get data from session storage first
      chrome.storage.session.get(['currentProfile'], (res) => {
        if (res.currentProfile && res.currentProfile.url === tab.url) {
          currentProfile = res.currentProfile;
          resolve();
        } else {
          // 2. Data not found or mismatched URL — force re-inject content script
          console.log('[TNT Scraper] Data mismatch or not found, re-injecting content.js');
          if (tab.id) {
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js'],
            }).then(() => {
              // Wait a bit for script to run and save to storage
              setTimeout(() => {
                chrome.storage.session.get(['currentProfile'], (r) => {
                  if (r.currentProfile && r.currentProfile.url === tab.url) {
                    currentProfile = r.currentProfile;
                  }
                  render();
                  resolve();
                });
              }, 1000);
            }).catch((err) => {
              console.error('[TNT Scraper] Failed to inject content script:', err);
              resolve();
            });
          } else {
            resolve();
          }
        }
      });
    });
  });
}

// ── Load app's localStorage data (via injected script) ────────────
async function loadAppDatabase() {
  return new Promise((resolve) => {
    chrome.tabs.query({ url: 'http://localhost:5173/*' }, (tabs) => {
      if (!tabs || tabs.length === 0) { resolve(); return; }

      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => {
          try {
            const raw = localStorage.getItem('tnt_creators');
            return raw ? JSON.parse(raw) : [];
          } catch { return []; }
        },
      }).then((results) => {
        if (results && results[0] && results[0].result) {
          appDatabase = results[0].result;
        }
        resolve();
      }).catch(() => resolve());
    });
  });
}

// ── Save queue to storage ─────────────────────────────────────────
function saveQueue() {
  chrome.storage.local.set({ [STORAGE_KEY]: queue });
}

// ── Check if username already in app's DB ─────────────────────────
function isInDatabase(username) {
  return appDatabase.some(c =>
    c.username.toLowerCase() === username.toLowerCase()
  );
}

// ── Check if username already in queue ────────────────────────────
function isInQueue(username) {
  return queue.some(q => q.username.toLowerCase() === username.toLowerCase());
}

// ── Render ────────────────────────────────────────────────────────
function render() {
  renderCurrentCard();
  renderQueueList();
  renderFooter();
  document.getElementById('queue-count').textContent =
    `${queue.length} queued`;
}

function renderCurrentCard() {
  const section = document.getElementById('current-section');

  if (!currentProfile) {
    section.innerHTML = `
      <div style="margin:10px 12px 0;background:#16161f;border:1px solid rgba(255,255,255,0.08);
        border-radius:10px;padding:12px 14px;">
        <div style="font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
          color:#555570;margin-bottom:6px;">Current Tab</div>
        <div class="no-profile">
          ⚠️ Open a TikTok creator profile page to detect data.
        </div>
      </div>`;
    return;
  }

  const { username, followers_count, source, mcn, level, categories } = currentProfile;
  const tier      = getTier(followers_count);
  const tierClass = tier ? `tier-${tier.toLowerCase()}` : 'tier-under';
  const tierLabel = tier || '< 1K';
  const alreadyInDB    = isInDatabase(username);
  const alreadyInQueue = isInQueue(username);

  let statusHtml = '';
  if (alreadyInQueue) {
    statusHtml = `<div class="status-msg warning" style="margin:6px 0 0">⚠ Already in queue</div>`;
  } else if (alreadyInDB) {
    statusHtml = `<div class="status-msg warning" style="margin:6px 0 0">📂 Already in database — will trigger reconcile</div>`;
  }

  section.innerHTML = `
    <div style="margin:10px 12px 0;background:#1e1e2d;border:1px solid rgba(255,255,255,0.08);
      border-radius:10px;padding:12px 14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div style="font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#555570;">
          Detected: ${source || 'Unknown'}
        </div>
        ${mcn ? `<div style="font-size:9px;background:rgba(16,185,129,0.1);color:#10b981;padding:1px 6px;border-radius:4px;font-weight:600;">${mcn}</div>` : ''}
      </div>
      <div class="profile-row">
        <div class="profile-avatar">${username[0].toUpperCase()}</div>
        <div class="profile-info">
          <div style="display:flex;align-items:center;gap:6px;">
            <div class="profile-username">@${username}</div>
            ${level ? `<span style="font-size:10px;background:#3b82f6;color:white;padding:1px 5px;border-radius:4px;font-weight:700;">${level}</span>` : ''}
          </div>
          ${categories ? `<div class="profile-nickname" style="font-size:10px;color:#888;">${categories}</div>` : ''}
          <div class="profile-stats">
            <div class="stat-pill">
              <strong>${followers_count !== null ? formatFollowers(followers_count) : '—'}</strong>
              <span>followers</span>
            </div>
            <span class="tier-pill ${tierClass}">${tierLabel}</span>
          </div>
        </div>
        <button
          class="btn-add"
          id="btn-add-current"
          ${alreadyInQueue ? 'disabled' : ''}
          title="${alreadyInQueue ? 'Already in queue' : 'Add to queue'}"
        >
          ${alreadyInQueue ? '✓ Added' : '+ Queue'}
        </button>
      </div>
      ${statusHtml}
    </div>`;

  document.getElementById('btn-add-current').addEventListener('click', addCurrentToQueue);
}

function renderQueueList() {
  const list = document.getElementById('queue-list');

  if (queue.length === 0) {
    list.innerHTML = `
      <div class="empty-queue">
        <span class="emoji">👀</span>
        Open a TikTok profile and click<br/><strong>+ Queue</strong> to start collecting.
      </div>`;
    return;
  }

  list.innerHTML = queue.map((item, i) => {
    const tier      = getTier(item.followers_count);
    const tierClass = tier ? `tier-${tier.toLowerCase()}` : 'tier-under';
    const tierLabel = tier || '< 1K';
    const inDB      = isInDatabase(item.username);
    const rejected  = !tier;
    const itemClass = rejected ? 'rejected' : inDB ? 'duplicate' : '';
    const dotClass  = rejected ? 'dot-rejected' : inDB ? 'dot-duplicate' : 'dot-new';
    const dotTitle  = rejected ? 'Under 1K — will be blocked' : inDB ? 'Already in DB — will reconcile' : 'New creator';

    return `
      <div class="queue-item ${itemClass}" data-idx="${i}">
        <div class="q-num">${i + 1}</div>
        <div class="q-info">
          <div class="q-username">@${item.username}</div>
          <div class="q-meta">
            ${item.followers_count !== null ? formatFollowers(item.followers_count) : '—'} followers ·
            <span class="tier-pill ${tierClass}" style="font-size:9px;padding:1px 5px;">${tierLabel}</span>
            ${item.level ? ` · <span style="color:#3b82f6">${item.level}</span>` : ''}
            ${item.mcn ? ` · <span style="color:#10b981">${item.mcn}</span>` : ''}
            ${inDB ? ' · <span style="color:#f59e0b">In DB</span>' : ''}
            ${rejected ? ' · <span style="color:#ef4444">Under 1K</span>' : ''}
          </div>
        </div>
        <div class="q-status">
          <div class="status-dot ${dotClass}" title="${dotTitle}"></div>
          <button class="q-del" data-idx="${i}" title="Remove from queue">×</button>
        </div>
      </div>`;
  }).join('');

  // Bind remove buttons
  list.querySelectorAll('.q-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-idx'));
      queue.splice(idx, 1);
      saveQueue();
      render();
    });
  });
}

function renderFooter() {
  const stats    = document.getElementById('footer-stats');
  const sendBtn  = document.getElementById('btn-send');
  const newCount = queue.filter(q => getTier(q.followers_count) && !isInDatabase(q.username)).length;
  const dupCount = queue.filter(q => getTier(q.followers_count) && isInDatabase(q.username)).length;
  const badCount = queue.filter(q => !getTier(q.followers_count)).length;

  if (queue.length === 0) {
    stats.textContent = 'Queue is empty';
    sendBtn.disabled = true;
  } else {
    stats.innerHTML =
      `<strong style="color:#f0f0f8">${queue.length}</strong> total · ` +
      `<span style="color:#10b981">${newCount} new</span>` +
      (dupCount > 0 ? ` · <span style="color:#f59e0b">${dupCount} dup</span>` : '') +
      (badCount > 0 ? ` · <span style="color:#ef4444">${badCount} skip</span>` : '');
    sendBtn.disabled = false;
  }
}

// ── Actions ───────────────────────────────────────────────────────
function addCurrentToQueue() {
  if (!currentProfile) return;
  const { username, followers_count, url, mcn, source, level, categories } = currentProfile;

  if (isInQueue(username)) {
    showStatus('Already in queue', 'warning');
    return;
  }

  queue.push({ 
    username, 
    followers_count, 
    url, 
    mcn, 
    source, 
    level, 
    categories,
    addedAt: Date.now() 
  });
  saveQueue();
  showStatus(`@${username} added to queue`, 'success');
  render();
}

function showStatus(msg, type) {
  const el = document.getElementById('status-msg');
  el.innerHTML = `<div class="status-msg ${type}">${msg}</div>`;
  setTimeout(() => { el.innerHTML = ''; }, 2500);
}

// ── Clear All ─────────────────────────────────────────────────────
document.getElementById('clear-queue').addEventListener('click', () => {
  if (queue.length === 0) return;
  if (!confirm(`Clear all ${queue.length} queued creator(s)?`)) return;
  queue = [];
  saveQueue();
  render();
});

// ── Refresh current tab data ──────────────────────────────────────
document.getElementById('btn-refresh').addEventListener('click', async () => {
  await loadCurrentTab();
  await loadAppDatabase();
  render();
  showStatus('Refreshed ✓', 'success');
});

// ── Send All to App ───────────────────────────────────────────────
document.getElementById('btn-send').addEventListener('click', () => {
  const validQueue = queue.filter(q => q.followers_count === null || getTier(q.followers_count) !== null || true);
  // Send everything — app's sync will handle gatekeeper rejection

  const payload = validQueue.map(item => ({
    username:        item.username,
    followers_count: item.followers_count || '',
    whatsapp_no:     '',
    niches:          [],
    can_barter:      false,
    ratecard_price:  '',
    shipping_address:'',
    notes:           (item.level ? `Level: ${item.level}` : '') + 
                     (item.categories ? ` | Cat: ${item.categories}` : '') + 
                     (item.mcn ? ` | MCN: ${item.mcn}` : ''),
  }));

  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  const url     = `${APP_URL}?import=${encoded}`;

  chrome.tabs.query({ url: 'http://localhost:5173/*' }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.update(tabs[0].id, { active: true, url });
    } else {
      chrome.tabs.create({ url });
    }
  });

  // Clear queue after sending
  queue = [];
  saveQueue();
  showStatus(`Sent ${payload.length} creators to app!`, 'success');
  setTimeout(() => render(), 500);
});
