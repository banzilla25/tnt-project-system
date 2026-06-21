const fs = require('fs');
const path = 'd:/Project-Tracking-System/web-app/src/app/creator-pool/[id]/page.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(/import \{ Card, CardContent, CardHeader, CardTitle \} from "\@\/components\/ui\/Card";/g, '');
code = code.replace(/import \{ Badge \} from "\@\/components\/ui\/Badge";/g, '');
code = code.replace(/import \{ Button \} from "\@\/components\/ui\/Button";/g, '');
code = code.replace(/import \{ Table, TableBody, TableCell, TableHead, TableHeader, TableRow \} from "\@\/components\/ui\/Table";/g, '');

code = code.replace(/<Card>/g, '<div className="ccard">');
code = code.replace(/<\/Card>/g, '</div>');
code = code.replace(/<CardContent/g, '<div');
code = code.replace(/<\/CardContent>/g, '</div>');
code = code.replace(/<CardHeader>/g, '<div className="p-[16px] border-b border-line mb-[16px]">');
code = code.replace(/<CardHeader /g, '<div className="p-[16px] border-b border-line mb-[16px] ');
code = code.replace(/<\/CardHeader>/g, '</div>');
code = code.replace(/<CardTitle>/g, '<h3 className="font-bold text-[16px]">');
code = code.replace(/<\/CardTitle>/g, '</h3>');

code = code.replace(/<Button variant="outline"/g, '<button className="btn btn-outline"');
code = code.replace(/<Button variant="ghost"/g, '<button className="btn btn-soft"');
code = code.replace(/<Button/g, '<button className="btn btn-primary"');
code = code.replace(/<\/Button>/g, '</button>');

code = code.replace(/<Badge className="bg-gradient-to-r from-blue-600 to-indigo-600 shadow-sm">/g, '<span className="badge b-sales">');
code = code.replace(/<Badge variant="outline">/g, '<span className="badge b-neutral">');
code = code.replace(/<Badge variant="secondary">/g, '<span className="badge b-pending">');
code = code.replace(/<Badge/g, '<span className="badge b-neutral"');
code = code.replace(/<\/Badge>/g, '</span>');

code = code.replace(/<Table>/g, '<div className="tbl-wrap"><table className="w-full">');
code = code.replace(/<\/Table>/g, '</table></div>');
code = code.replace(/<TableHeader>/g, '<thead className="border-b border-line bg-slate-50">');
code = code.replace(/<TableHeader className="bg-slate-50">/g, '<thead className="border-b border-line bg-slate-50">');
code = code.replace(/<\/TableHeader>/g, '</thead>');
code = code.replace(/<TableBody>/g, '<tbody>');
code = code.replace(/<\/TableBody>/g, '</tbody>');
code = code.replace(/<TableRow>/g, '<tr className="border-b border-line hover:bg-slate-50/50">');
code = code.replace(/<TableRow /g, '<tr className="border-b border-line hover:bg-slate-50/50" ');
code = code.replace(/<\/TableRow>/g, '</tr>');
code = code.replace(/<TableHead>/g, '<th className="py-[12px] px-[16px] text-left font-semibold text-text-soft">');
code = code.replace(/<TableHead /g, '<th className="py-[12px] px-[16px] text-left font-semibold text-text-soft" ');
code = code.replace(/<\/TableHead>/g, '</th>');
code = code.replace(/<TableCell>/g, '<td className="py-[12px] px-[16px]">');
code = code.replace(/<TableCell /g, '<td className="py-[12px] px-[16px]" ');
code = code.replace(/<\/TableCell>/g, '</td>');

fs.writeFileSync(path, code);
console.log('Migrated creator-pool/[id]/page.tsx');
