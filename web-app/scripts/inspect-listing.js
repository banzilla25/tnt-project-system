const xlsx = require('xlsx');

function run() {
  const workbook = xlsx.readFile('../TNT Project Tracking (Internal).xlsx');
  const sheet = workbook.Sheets['DATABASE'];
  if (!sheet) {
    console.log('Sheet DATABASE not found');
    return;
  }
  
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  console.log('Row 1:', data[0]);
  console.log('Row 2:', data[1]);
  console.log('Row 3:', data[2]);
  console.log('Row 4:', data[3]);
}
run();
