const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('D:/Project-Tracking-System/kalodata-outerHTML-body.txt', 'utf8');
const $ = cheerio.load(html);

$('img').each((i, el) => {
    const src = $(el).attr('src');
    if (src && !src.includes('facebook') && !src.includes('google')) {
        console.log("Found img src:", src.substring(0, 80));
    }
});
