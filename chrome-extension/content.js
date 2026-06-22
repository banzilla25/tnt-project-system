// scraper helper functions
function getStatValue(labelText) {
  const elements = Array.from(document.querySelectorAll('*')).filter(el => {
    // strict match for leaf nodes or elements where the only text is the label
    return el.children.length <= 1 && el.textContent.trim() === labelText;
  });

  for (let labelEl of elements) {
    // 1. Next sibling
    if (labelEl.nextElementSibling) {
      const text = (labelEl.nextElementSibling.textContent || '').trim();
      if (text) return text;
    }
    // 2. Parent's next sibling (often labels are wrapped in divs)
    if (labelEl.parentElement && labelEl.parentElement.nextElementSibling) {
      const text = (labelEl.parentElement.nextElementSibling.textContent || '').trim();
      if (text) return text;
    }
  }
  return '';
}

function scrapeData() {
  // 1. Username (usually prominent text starting with @ or plain username)
  // Look for text-head-l which is used for the username
  const usernameEl = document.querySelector('span.text-head-l');
  const username = usernameEl ? usernameEl.innerText.trim() : '';

  // 2. Name
  // The name is usually right below the username in an overflow span
  let name = '';
  if (usernameEl) {
    const parentContainer = usernameEl.closest('.flex-col');
    if (parentContainer) {
       const nameEl = parentContainer.querySelector('span.text-overflow-single');
       if (nameEl) name = nameEl.innerText.trim();
    }
  }

  // 3. Followers, Categories, MCN
  const followers = getStatValue('Followers');
  const rawCategories = getStatValue('Categories');
  // Ambil hanya kategori pertama sebelum koma (contoh: "Beauty & Personal Care, +2" -> "Beauty & Personal Care")
  const categories = rawCategories ? rawCategories.split(',')[0].trim() : '';
  const mcn = getStatValue('MCN');

  // 4. Level
  const lvlSpan = Array.from(document.querySelectorAll('span')).find(s => s.innerText.trim().startsWith('LVL '));
  const level = lvlSpan ? lvlSpan.innerText.trim() : '';

  // 5. GMV / Revenue
  const gmv = getStatValue('Revenue');

  // 6. Contact Info (From modal if open)
  const wa = getStatValue('Whatsapp:');
  const email = getStatValue('Email:');

  // 7. Avatar URL
  const avatarEl = document.querySelector('.m4b-avatar-image img');
  const avatar_url = avatarEl ? avatarEl.src : '';

  // 8. Audience Age
  let audience_age = '';
  try {
    const leaves = Array.from(document.querySelectorAll('*')).filter(el => el.children.length === 0);
    const ageElements = leaves.filter(el => {
       const t = el.textContent.trim().replace(/\s/g, '');
       return ['18-24', '25-34', '35-44', '45-54', '55+'].includes(t);
    });
    
    if (ageElements.length >= 5) {
       // Ambil 5 rentang umur pertama
       const top5 = ageElements.slice(0, 5);
       
       // Cari elemen induk bersama (Lowest Common Ancestor) dari kelima elemen umur ini
       let ancestor = top5[0].parentElement;
       while (ancestor && ancestor !== document.body) {
          const containsAll = top5.every(el => ancestor.contains(el));
          if (containsAll) break;
          ancestor = ancestor.parentElement;
       }
       
       if (ancestor) {
          // Naik 3 level ke atas untuk memastikan kolom persentase ikut terbungkus
          let safeAncestor = ancestor;
          for(let i=0; i<3; i++) {
             if (safeAncestor.parentElement && safeAncestor.parentElement !== document.body) {
                safeAncestor = safeAncestor.parentElement;
             }
          }
          
          // Ambil semua teks dari dalam bungkus besar tersebut
          const ancLeaves = Array.from(safeAncestor.querySelectorAll('*')).filter(el => el.children.length === 0);
          const ageList = [];
          const percentList = [];
          
          for (const el of ancLeaves) {
              const t = el.textContent.trim();
              if (!t) continue;
              const cleanT = t.replace(/\s/g, '');
              if (['18-24', '25-34', '35-44', '45-54', '55+'].includes(cleanT)) {
                 ageList.push(cleanT);
              } else if (t.endsWith('%')) {
                 const val = parseFloat(t);
                 if (!isNaN(val)) percentList.push(val);
              }
          }
          
          // Jodohkan umur dengan persentase berdasarkan urutan kemunculannya
          let maxP = -1;
          let bestA = '';
          const limit = Math.min(ageList.length, percentList.length);
          for (let i = 0; i < limit; i++) {
             if (percentList[i] > maxP) {
                maxP = percentList[i];
                bestA = ageList[i];
             }
          }
          if (bestA) {
             audience_age = bestA;
          }
       }
    }
  } catch(e) {
     console.error('Age Parsing Error:', e);
  }

  // Parse numbers with Indonesian/English suffixes (K, M, RB, JT, M, B)
  function parseValue(valStr) {
    if (!valStr) return 0;
    let multiplier = 1;
    let cleanStr = valStr.toUpperCase().replace(/,/g, '.').replace(/[^0-9.KMRBJT]/g, '');
    
    if (cleanStr.includes('RB') || cleanStr.includes('K')) multiplier = 1000;
    if (cleanStr.includes('JT') || cleanStr.includes('M')) multiplier = 1000000;
    if (cleanStr.includes('B')) multiplier = 1000000000;
    
    cleanStr = cleanStr.replace(/[A-Z]/g, '');
    return (parseFloat(cleanStr) || 0) * multiplier;
  }

  const followersNum = parseValue(followers);
  const gmvNum = parseValue(gmv);

  // Clean username (remove @)
  const cleanUsername = username.replace('@', '');

  return {
    username: cleanUsername,
    name,
    avatar_url,
    followers: followersNum || 0,
    niche: categories,
    level,
    mcn,
    gmv_30d: gmvNum || 0,
    no_whatsapp: wa,
    email,
    audience_age
  };
}

// Storage key
const STORAGE_KEY = 'tnt_scraper_queue';

// UI Injection
async function injectButton() {
  if (document.getElementById('tnt-import-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'tnt-import-btn';
  
  // Basic styling
  Object.assign(btn.style, {
    position: 'fixed',
    bottom: '30px',
    right: '30px',
    backgroundColor: '#0ba449',
    color: '#ffffff',
    border: 'none',
    padding: '12px 20px',
    borderRadius: '50px',
    fontSize: '15px',
    fontWeight: 'bold',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(11,164,73,0.3)',
    zIndex: '999999',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  });

  // Create Preview Box
  const previewBox = document.createElement('div');
  previewBox.id = 'tnt-preview-box';
  Object.assign(previewBox.style, {
    position: 'fixed',
    bottom: '80px',
    right: '30px',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    color: '#333',
    border: '1px solid #e5e7eb',
    padding: '12px 16px',
    borderRadius: '12px',
    fontSize: '12px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
    zIndex: '999999',
    width: '280px',
    pointerEvents: 'none', // click through
    transition: 'opacity 0.3s ease',
    opacity: '0'
  });
  document.body.appendChild(previewBox);

  // Live updater for preview box
  const updatePreview = () => {
    const data = scrapeData();
    if (!data.username) {
      previewBox.style.opacity = '0';
    } else {
      previewBox.style.opacity = '1';
      previewBox.innerHTML = `
        <div style="font-weight:bold; margin-bottom:8px; display:flex; align-items:center; gap:8px;">
          ${data.avatar_url ? `<img src="${data.avatar_url}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;">` : ''}
          <span style="font-size:14px; color:#0ba449;">Sedot Data Aktif</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span style="color:#666">Kreator:</span>
          <strong>${data.name || '-'}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span style="color:#666">Username:</span>
          <strong>@${data.username}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span style="color:#666">Followers:</span>
          <strong>${(data.followers/1000).toFixed(1)}K</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span style="color:#666">GMV:</span> 
          <strong style="color:#0ba449;">Rp ${data.gmv_30d.toLocaleString()}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span style="color:#666">Niche:</span>
          <strong style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:150px;">${data.niche || '-'}</strong>
        </div>
      `;
    }
  };

  const previewInterval = setInterval(updatePreview, 1000);

  // Get current queue length
  const updateButtonText = () => {
    chrome.storage.local.get([STORAGE_KEY], (res) => {
      const queue = res[STORAGE_KEY] || [];
      btn.innerHTML = `🛒 Masukkan Antrean (${queue.length})`;
    });
  };

  updateButtonText();

  // Listen for storage changes from popup
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes[STORAGE_KEY]) {
      const queue = changes[STORAGE_KEY].newValue || [];
      btn.innerHTML = `🛒 Masukkan Antrean (${queue.length})`;
    }
  });

  btn.onmouseover = () => {
    btn.style.transform = 'translateY(-2px)';
    btn.style.boxShadow = '0 6px 16px rgba(11,164,73,0.4)';
  };
  btn.onmouseleave = () => {
    btn.style.transform = 'translateY(0)';
    btn.style.boxShadow = '0 4px 12px rgba(11,164,73,0.3)';
  };

  btn.onclick = () => {
    const data = scrapeData();
    if (!data.username) return alert('Data belum siap atau Username tidak ditemukan!');

    // Add to storage
    chrome.storage.local.get([STORAGE_KEY], (res) => {
      let queue = res[STORAGE_KEY] || [];
      
      const existingIndex = queue.findIndex(c => c.username === data.username);
      let isSame = false;

      if (existingIndex !== -1) {
        const old = queue[existingIndex];
        // Check if there's any new data (like WhatsApp or Email that wasn't there before)
        isSame = (old.no_whatsapp === data.no_whatsapp) && (old.email === data.email) && (old.followers === data.followers) && (old.audience_age === data.audience_age);
        
        // Overwrite with the latest scraped data
        queue[existingIndex] = data;
      } else {
        queue.push(data);
      }

      chrome.storage.local.set({ [STORAGE_KEY]: queue }, () => {
        if (existingIndex !== -1 && isSame) {
          btn.innerHTML = `✅ Sudah di Antrean`;
        } else if (existingIndex !== -1 && !isSame) {
          btn.innerHTML = `✅ Data Diperbarui!`;
        } else {
          btn.innerHTML = `✅ Tersimpan (${queue.length})`;
        }
        
        btn.style.backgroundColor = '#2563eb'; // blue
        setTimeout(() => {
          btn.style.backgroundColor = '#0ba449';
          updateButtonText();
        }, 1500);
      });
    });
  };

  document.body.appendChild(btn);
}

// Watch for DOM changes to inject button
const observer = new MutationObserver(() => {
  // Only inject if we are on a creator detail page
  if (window.location.href.includes('/creator/detail')) {
    injectButton();
  } else {
    const btn = document.getElementById('tnt-import-btn');
    const preview = document.getElementById('tnt-preview-box');
    if (btn) btn.remove();
    if (preview) preview.remove();
  }
});

observer.observe(document.body, { childList: true, subtree: true });
