import * as XLSX from 'xlsx';

export interface ErrorLogItem {
  username?: string;
  baris_excel?: number;
  data_mentah?: any;
  pesan_error: string;
}

/**
 * Mengekspor daftar error menjadi file Excel (.xlsx)
 * @param data Array of error log items
 * @param filename Nama file (tanpa ekstensi .xlsx)
 */
export const exportErrorLogToExcel = (data: ErrorLogItem[], filename: string) => {
  if (!data || data.length === 0) return;

  // Flatten the data for better Excel representation
  const flattenedData = data.map((item, index) => {
    const row: any = {
      'No': index + 1,
      'Username': item.username || '-',
      'Pesan Error': item.pesan_error,
      'Baris Excel': item.baris_excel || '-'
    };

    // Include raw data if it's an object to provide context
    if (item.data_mentah && typeof item.data_mentah === 'object') {
      Object.keys(item.data_mentah).forEach(key => {
        row[`Data Mentah: ${key}`] = item.data_mentah[key];
      });
    } else if (item.data_mentah) {
      row['Data Mentah'] = String(item.data_mentah);
    }

    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(flattenedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Error Log');

  XLSX.writeFile(workbook, `${filename}_${new Date().getTime()}.xlsx`);
};
