const fs = require('fs');
const path = 'd:/Project-Tracking-System/web-app/src/app/creator-pool/[id]/page.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(/<button className="btn btn-soft" size="icon" className="([^"]*)"/g, '<button className="btn btn-soft $1" size="icon"');

code = code.replace(/<button className="btn btn-outline" size="icon"><ArrowLeft className="w-4 h-4" \/><\/button>/g, '<button className="btn btn-outline" size="icon"><ArrowLeft className="w-4 h-4" /><\/button>');

fs.writeFileSync(path, code);
console.log('Fixed button double classNames');
