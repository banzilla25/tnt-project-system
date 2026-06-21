const fs = require('fs');
const path = require('path');

const file1 = path.join('src', 'app', 'creator-pool', '[id]', 'page.tsx');
let content1 = fs.readFileSync(file1, 'utf8');

// Replace className="btn btn-soft h-5 w-5..." with p-0 flex items-center justify-center 
content1 = content1.replace(/className=\"btn btn-soft (h-[56] w-[56])([^\"]*)\"/g, 'className=\"btn btn-soft p-0 flex items-center justify-center $1$2\"');

fs.writeFileSync(file1, content1);
console.log('Fixed padding');
