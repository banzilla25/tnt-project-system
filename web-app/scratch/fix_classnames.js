const fs = require('fs');
const path = 'd:/Project-Tracking-System/web-app/src/app/creator-pool/[id]/page.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(/<button className="btn btn-primary" ([^>]*?) className="w-full"/g, '<button className="btn btn-primary w-full" $1');
code = code.replace(/<button className="btn btn-primary" ([^>]*?) className="w-full flex justify-between"/g, '<button className="btn btn-primary w-full flex justify-between" $1');

code = code.replace(/<span className="badge b-neutral" variant="outline" className="([^"]*)"/g, '<span className="badge b-neutral $1"');
code = code.replace(/<span className="badge b-neutral" className="([^"]*)"/g, '<span className="badge b-neutral $1"');

code = code.replace(/className="p-\[16px\] border-b border-line mb-\[16px\] className="([^"]*)"/g, 'className="p-[16px] border-b border-line mb-[16px] $1"');

fs.writeFileSync(path, code);
console.log('Fixed double classNames in creator-pool/[id]/page.tsx');
