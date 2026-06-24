import Papa from 'papaparse';
import * as xlsx from 'xlsx';

export type BudgetColumnMapping = {
  username: string;
  ratecard: string;
  pelunasan: string;
  status_bayar: string;
  tgl_pembayaran: string;
};

export type ParsedBudgetRow = {
  username: string;
  ratecard: number | null;
  pelunasan: number | null;
  status_bayar: string;
  tgl_pembayaran: string | null;
  raw_row: any;
};

export type BudgetParseResult = {
  validData: ParsedBudgetRow[];
  errors: string[];
};

export const parseBudgetFileHeaders = async (file: File): Promise<string[]> => {
  if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = xlsx.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    if (data.length > 0) {
      return data[0] as string[];
    }
    throw new Error("File Excel kosong");
  }

  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      preview: 1,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.meta && results.meta.fields) {
          resolve(results.meta.fields);
        } else {
          reject(new Error("Gagal membaca header CSV"));
        }
      },
      error: reject
    });
  });
};

export const parseBudgetSyncFile = async (file: File, mapping: BudgetColumnMapping): Promise<BudgetParseResult> => {
  const validData: ParsedBudgetRow[] = [];
  const errors: string[] = [];

  let rowData: any[] = [];

  if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = xlsx.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    rowData = xlsx.utils.sheet_to_json(worksheet, { defval: null });
  } else {
    const csvData = await new Promise<any[]>((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data),
        error: reject
      });
    });
    rowData = csvData;
  }

  rowData.forEach((row: any, index: number) => {
    const rowNum = index + 2;

    const usernameStr = mapping.username ? (row[mapping.username] || '') : '';
    const username = usernameStr.toString().trim().replace(/^@/, '').replace(/\s+/g, '');

    if (!username) {
      errors.push(`Baris ${rowNum}: Username kosong, baris dilewati.`);
      return;
    }

    // Parse ratecard
    const ratecardRaw = mapping.ratecard ? (row[mapping.ratecard] || '').toString().replace(/[^0-9]/g, '') : '';
    const ratecard = ratecardRaw ? parseInt(ratecardRaw) : null;

    // Parse pelunasan
    const pelunasanRaw = mapping.pelunasan ? (row[mapping.pelunasan] || '').toString().replace(/[^0-9]/g, '') : '';
    const pelunasan = pelunasanRaw ? parseInt(pelunasanRaw) : null;

    // Parse status bayar
    const statusRaw = mapping.status_bayar ? (row[mapping.status_bayar] || '').toString().toLowerCase().trim() : '';
    let status_bayar = 'belum';
    if (statusRaw.includes('paid off') || statusRaw.includes('lunas') || statusRaw === 'lunas') {
      status_bayar = 'lunas';
    } else if (statusRaw.includes('half') || statusRaw.includes('sebagian') || statusRaw.includes('partial')) {
      status_bayar = 'sebagian';
    } else if (statusRaw.includes('no payment') || statusRaw.includes('barter') || statusRaw.includes('no_payment')) {
      status_bayar = 'no_payment';
    }

    // Parse tanggal
    let tgl_pembayaran: string | null = null;
    if (mapping.tgl_pembayaran) {
      const tglRaw = row[mapping.tgl_pembayaran];
      if (tglRaw) {
        if (typeof tglRaw === 'number') {
          // Handle Excel serial date
          const utc_days  = Math.floor(tglRaw - 25569);
          const date_info = new Date(utc_days * 86400 * 1000);
          tgl_pembayaran = date_info.toISOString().split('T')[0];
        } else {
          const tglStr = tglRaw.toString().trim();
          // Handle dd/mm/yyyy
          const ddmmyyyy = tglStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
          if (ddmmyyyy) {
            tgl_pembayaran = `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`;
          } else {
            // Try ISO or other parseable format
            const d = new Date(tglStr);
            if (!isNaN(d.getTime())) {
              tgl_pembayaran = d.toISOString().split('T')[0];
            }
          }
        }
      }
    }

    validData.push({
      username,
      ratecard,
      pelunasan,
      status_bayar,
      tgl_pembayaran,
      raw_row: row
    });
  });

  return { validData, errors };
};

export const downloadBudgetSyncTemplate = () => {
  const BOM = '\uFEFF';
  const csvContent = BOM + 'Username,Total Rate Card,Pelunasan,Status Bayar,Tgl Pembayaran\n' +
    'arnilawati,Rp150000,Rp150000,Paid Off,20/02/2026\n' +
    'ekbardiary,Rp500000,Rp500000,Paid Off,06/02/2026\n' +
    'queenhannisss,0,,Not Yet,\n' +
    'dreamm.png,0,,No Payment,';

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'Template_Sync_Budget_Creator.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
