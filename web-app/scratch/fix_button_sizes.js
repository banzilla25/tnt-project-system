const fs = require('fs');
const filePath = 'src/app/creator-pool/[id]/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace native button with size="icon" or size="sm"
content = content.replace(/<button([^>]*?)\s+size=\"[^\"]*\"([^>]*?)>/g, '<button$1$2>');

fs.writeFileSync(filePath, content);
console.log('Fixed button size attr');
