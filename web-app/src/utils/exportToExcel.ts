import * as XLSX from 'xlsx';

/**
 * Helper function to export JSON data to Excel file
 * @param data Array of objects to be exported
 * @param fileName Name of the downloaded file (without extension)
 */
export function exportToExcel(data: any[], fileName: string) {
  if (!data || data.length === 0) {
    alert("Tidak ada data untuk diekspor.");
    return;
  }

  // Create a new workbook
  const wb = XLSX.utils.book_new();

  // Convert JSON to worksheet
  const ws = XLSX.utils.json_to_sheet(data);

  // Append worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, "Data");

  // Generate Excel file and trigger download
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}
