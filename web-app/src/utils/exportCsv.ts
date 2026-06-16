/**
 * Utilities for exporting data to CSV format
 */

export function exportToCSV(data: any[], filename: string) {
  if (!data || !data.length) {
    alert("Tidak ada data untuk di-export");
    return;
  }

  // Get all unique keys from data
  const headers = Array.from(new Set(data.flatMap(Object.keys)));

  // Escape CSV value helper
  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    // If string contains comma, newline, or quotes, wrap in quotes and escape internal quotes
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Build CSV string
  const csvRows = [];
  
  // 1. Header row
  csvRows.push(headers.map(escapeCsv).join(','));
  
  // 2. Data rows
  for (const row of data) {
    const values = headers.map(header => escapeCsv(row[header]));
    csvRows.push(values.join(','));
  }

  const csvString = csvRows.join('\n');
  
  // Create Blob and trigger download
  const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' }); // \uFEFF is BOM for Excel UTF-8 compatibility
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
