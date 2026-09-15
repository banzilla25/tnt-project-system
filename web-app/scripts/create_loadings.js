const fs = require('fs');
const path = require('path');

const tabs = ['listing', 'video', 'live', 'livestream', 'performa', 'daily', 'keuangan', 'alamat', 'sku'];
const content = `import TabLoading from "@/components/TabLoading";

export default function Loading() {
  return <TabLoading />;
}
`;

tabs.forEach(tab => {
  const file = path.join(__dirname, 'src', 'app', 'campaigns', '[id]', tab, 'loading.tsx');
  fs.writeFileSync(file, content);
  console.log('Created', file);
});
