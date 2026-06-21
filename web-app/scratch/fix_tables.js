const fs = require('fs');
const path = 'd:/Project-Tracking-System/web-app/src/app/creator-pool/[id]/page.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(/<Table className="text-sm">/g, '<div className="tbl-wrap"><table className="w-full text-sm">');
code = code.replace(/<TableHeader className="bg-indigo-50\/50">/g, '<thead className="border-b border-line bg-indigo-50/50">');
code = code.replace(/<th className="py-\[12px\] px-\[16px\] text-left font-semibold text-text-soft" className="([^"]*)"/g, '<th className="py-[12px] px-[16px] text-left font-semibold text-text-soft $1"');
code = code.replace(/<td className="py-\[12px\] px-\[16px\]" className="([^"]*)"/g, '<td className="py-[12px] px-[16px] $1"');

fs.writeFileSync(path, code);
console.log('Fixed remaining Table in creator-pool/[id]/page.tsx');
