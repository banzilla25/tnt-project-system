const fs = require('fs');
const filePath = 'src/app/creator-pool/[id]/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace variant attribute on span/button regardless of quotes or brackets
content = content.replace(/<(span|button)([^>]*?)\s+variant=(?:\"[^\"]*\"|\{[^\}]*\})([^>]*?)>/g, '<$1$2$3>');

fs.writeFileSync(filePath, content);
console.log('Fixed variant attrs');
