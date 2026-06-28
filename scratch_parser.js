const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('kalodata-outerHTML-body.txt', 'utf8');
const dom = new JSDOM(html);
const document = dom.window.document;

function scrapeKalodata() {
  // 1. Username
  let username = '';
  // Usually the username has an @
  const usernameEl = Array.from(document.querySelectorAll('.whitespace-nowrap.text-ellipsis.line-clamp-1')).find(el => el.textContent.trim().startsWith('@'));
  if (usernameEl) {
    username = usernameEl.textContent.trim();
  }

  // 2. Name
  let name = username.replace('@', '');

  // 3. Followers
  let followers = '';
  const followersLabel = Array.from(document.querySelectorAll('div')).find(el => el.textContent.trim() === 'Followers' && el.children.length === 0);
  if (followersLabel) {
    const valueEl = Array.from(document.querySelectorAll('.flex.items-center.gap-\\[8px\\] > div')).find(el => el.textContent.includes('k') || el.textContent.includes('m') || /\d/.test(el.textContent));
    if (valueEl) followers = valueEl.textContent.trim();
  }
  if (!followers) {
    const allDivs = document.querySelectorAll('div');
    for (let el of allDivs) {
       if (el.textContent.match(/^\d+(\.\d+)?[km]$/i)) {
          followers = el.textContent.trim();
          break;
       }
    }
  }

  // 4. GMV
  let gmv_30d = '';
  const revLabels = Array.from(document.querySelectorAll('div')).filter(el => el.textContent.trim() === 'Revenue');
  for (let rev of revLabels) {
    const textNodeWithRp = Array.from(document.querySelectorAll('div, span')).find(el => el.textContent.trim().startsWith('Rp') && el.children.length === 0 && (el.textContent.includes('m') || el.textContent.includes('k') || el.textContent.includes('b')));
    if (textNodeWithRp) {
      gmv_30d = textNodeWithRp.textContent.trim();
      break;
    }
  }

  // 5. MCN
  let mcn = '';
  const allClamps = document.querySelectorAll('.line-clamp-1');
  for (let clamp of allClamps) {
     if (clamp.textContent.includes('Media') || clamp.textContent.includes('Agency') || clamp.textContent.includes('MCN')) {
        mcn = clamp.textContent.trim();
        break;
     }
  }

  // 6. WhatsApp
  let wa = '';
  const waIcon = document.querySelector('.WHATSAPP');
  if (waIcon) {
     const parentRow = waIcon.closest('.flex');
     if (parentRow) {
        const textEl = parentRow.querySelector('.line-clamp-1');
        if (textEl) wa = textEl.textContent.trim();
     }
  }

  // 7. Email
  let email = '';
  const emailIcon = document.querySelector('.EMAIL');
  if (emailIcon) {
     const parentRow = emailIcon.closest('a');
     if (parentRow) {
        email = parentRow.href.replace('mailto:', '').trim();
     }
  }

  // 8. Audience Age
  let audience_age = '';
  const ageLeaves = Array.from(document.querySelectorAll('span, div')).filter(el => el.children.length === 0 && el.textContent.trim().match(/^\d+-\d+$/));
  if (ageLeaves.length > 0) {
     audience_age = ageLeaves[0].textContent.trim();
  }

  // 9. Avatar
  let avatar_url = '';
  const imgs = document.querySelectorAll('img');
  for (let img of imgs) {
     if (img.src && !img.src.includes('facebook') && !img.src.includes('google') && !img.src.includes('analytics')) {
        avatar_url = img.src;
        break;
     }
  }

  let cleanUsername = username.startsWith('@') ? username.substring(1) : username;
  cleanUsername = cleanUsername.split(' ')[0].trim();

  let followersNum = 0;
  if (followers) {
    let fStr = followers.replace(/,/g, '').toLowerCase();
    if (fStr.endsWith('k')) followersNum = parseFloat(fStr) * 1000;
    else if (fStr.endsWith('m')) followersNum = parseFloat(fStr) * 1000000;
    else followersNum = parseFloat(fStr);
  }

  let gmvNum = 0;
  if (gmv_30d) {
    let gStr = gmv_30d.replace(/rp/i, '').replace(/,/g, '').trim().toLowerCase();
    if (gStr.endsWith('k')) gmvNum = parseFloat(gStr) * 1000;
    else if (gStr.endsWith('m')) gmvNum = parseFloat(gStr) * 1000000;
    else if (gStr.endsWith('b')) gmvNum = parseFloat(gStr) * 1000000000;
    else gmvNum = parseFloat(gStr);
  }

  return {
    username: cleanUsername,
    name,
    avatar_url,
    followers: followersNum || 0,
    niche: '', 
    level: '', 
    mcn,
    gmv_30d: gmvNum || 0,
    no_whatsapp: wa,
    whatsapp: wa,
    email,
    audience_age
  };
}

console.log(JSON.stringify(scrapeKalodata(), null, 2));
