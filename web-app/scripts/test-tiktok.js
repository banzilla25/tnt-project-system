async function test() {
  const shortUrl = 'https://vt.tiktok.com/ZSmUeJ6KQ/';
  const response = await fetch(shortUrl, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  const html = await response.text();
  console.log('Expanded URL:', response.url);
  
  // Try to find author unique id in HTML
  const authorMatch = html.match(/"uniqueId":"([^"]+)"/);
  if (authorMatch) {
    console.log('Username found:', authorMatch[1]);
  } else {
    console.log('Username not found in HTML');
  }
}
test();
