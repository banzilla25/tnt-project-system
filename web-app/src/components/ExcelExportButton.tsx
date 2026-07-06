import React from 'react';
import { saveAs } from 'file-saver';
import { generateExcelBuffer } from '@/lib/reporting';

interface Props {
  campaignId: string;
}

const ExcelExportButton: React.FC<Props> = ({ campaignId }) => {
  const handleExport = async () => {
    try {
      const buffer = await generateExcelBuffer(campaignId);
      const blob = new Blob([buffer as any], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(blob, `campaign_${campaignId}_report.xlsx`);
    } catch (err) {
      console.error('Export gagal:', err);
      alert('Gagal mengekspor laporan.');
    }
  };

  return (
    <button
      onClick={handleExport}
      className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition"
    >
      Export ke Excel
    </button>
  );
};

export default ExcelExportButton;
