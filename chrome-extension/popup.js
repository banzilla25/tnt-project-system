const STORAGE_KEY = 'tnt_scraper_queue';

document.addEventListener('DOMContentLoaded', () => {
  const queueList = document.getElementById('queue-list');
  const queueCount = document.getElementById('queue-count');
  const clearBtn = document.getElementById('clear-all-btn');
  const sendBtn = document.getElementById('send-all-btn');

  function renderQueue(queue) {
    queueCount.innerText = queue.length;
    queueList.innerHTML = '';

    if (queue.length === 0) {
      queueList.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">Antrean kosong</div>';
      sendBtn.disabled = true;
      return;
    }

    sendBtn.disabled = false;

    queue.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'queue-item';
      
      div.innerHTML = `
        <div class="item-info">
          <span class="item-name">${item.name || item.username}</span>
          <span class="item-username">@${item.username}</span>
        </div>
        <button class="item-delete" data-username="${item.username}">❌</button>
      `;
      queueList.appendChild(div);
    });

    // Attach delete handlers
    document.querySelectorAll('.item-delete').forEach(btn => {
      btn.onclick = (e) => {
        const username = e.target.getAttribute('data-username');
        chrome.storage.local.get([STORAGE_KEY], (res) => {
          let q = res[STORAGE_KEY] || [];
          q = q.filter(c => c.username !== username);
          chrome.storage.local.set({ [STORAGE_KEY]: q }, () => {
            renderQueue(q);
          });
        });
      };
    });
  }

  // Load initial
  chrome.storage.local.get([STORAGE_KEY], (res) => {
    renderQueue(res[STORAGE_KEY] || []);
  });

  // Clear All
  clearBtn.onclick = () => {
    if (confirm('Yakin ingin menghapus semua antrean?')) {
      chrome.storage.local.set({ [STORAGE_KEY]: [] }, () => {
        renderQueue([]);
      });
    }
  };

  // Send All
  sendBtn.onclick = () => {
    chrome.storage.local.get([STORAGE_KEY], (res) => {
      const queue = res[STORAGE_KEY] || [];
      if (queue.length > 0) {
        sendBtn.innerText = 'Mengirim...';
        sendBtn.disabled = true;
        
        chrome.runtime.sendMessage({ action: 'IMPORT_ALL', payload: queue }, (response) => {
          if (response && response.success) {
            // Clear queue on success
            chrome.storage.local.set({ [STORAGE_KEY]: [] }, () => {
              window.close(); // Close popup
            });
          }
        });
      }
    });
  };
});
