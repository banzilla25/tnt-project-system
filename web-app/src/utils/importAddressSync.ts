import Papa from 'papaparse';
import * as xlsx from 'xlsx';

export type AddressColumnMapping = {
  username: string;
  nama_penerima: string;
  nama_jalan: string;
  kecamatan: string;
  kabupaten_kota: string;
  provinsi: string;
  kode_pos: string;
  resi: string;
  proses: string;
};

export type ParsedAddressRow = {
  username: string;
  nama_penerima: string | null;
  nama_jalan: string | null;
  kecamatan: string | null;
  kabupaten_kota: string | null;
  provinsi: string | null;
  kode_pos: string | null;
  resi: string | null;
  proses: string | null;
  raw_row: any;
};

export type AddressParseResult = {
  validData: ParsedAddressRow[];
  errors: string[];
};

export const parseAddressSyncFile = async (file: File, mapping: AddressColumnMapping): Promise<AddressParseResult> => {
  const validData: ParsedAddressRow[] = [];
  const errors: string[] = [];

  let rowData: any[] = [];

  if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = xlsx.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    rowData = xlsx.utils.sheet_to_json(worksheet, { defval: null });
  } else {
    // Parse CSV
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
    const username = usernameStr.toString().trim().replace(/^@/, '');
    
    if (!username) {
      errors.push(`Baris ${rowNum}: Username kosong, baris dilewati.`);
      return;
    }

    const nama_penerima = mapping.nama_penerima ? (row[mapping.nama_penerima] || '').toString().trim() || null : null;
    const nama_jalan = mapping.nama_jalan ? (row[mapping.nama_jalan] || '').toString().trim() || null : null;
    const kecamatan = mapping.kecamatan ? (row[mapping.kecamatan] || '').toString().trim() || null : null;
    const kabupaten_kota = mapping.kabupaten_kota ? (row[mapping.kabupaten_kota] || '').toString().trim() || null : null;
    const provinsi = mapping.provinsi ? (row[mapping.provinsi] || '').toString().trim() || null : null;
    const kode_pos = mapping.kode_pos ? (row[mapping.kode_pos] || '').toString().trim() || null : null;
    const resi = mapping.resi ? (row[mapping.resi] || '').toString().trim() || null : null;
    
    // Status mapping logic
    const prosesRaw = mapping.proses ? (row[mapping.proses] || '').toString().toLowerCase().trim() : '';
    let proses: string = 'Diproses'; // Default
    if (prosesRaw.includes('kirim') || prosesRaw.includes('jalan')) {
      proses = 'Dikirim';
    } else if (prosesRaw.includes('terima') || prosesRaw.includes('sampai') || prosesRaw.includes('done')) {
      proses = 'Diterima';
    } else if (prosesRaw.includes('proses') || prosesRaw.includes('packing')) {
      proses = 'Diproses';
    } else if (prosesRaw) {
      proses = (row[mapping.proses] || '').toString().trim(); // If unknown status, just pass it or default to Diproses
    }

    validData.push({
      username,
      nama_penerima,
      nama_jalan,
      kecamatan,
      kabupaten_kota,
      provinsi,
      kode_pos,
      resi,
      proses,
      raw_row: row
    });
  });

  return { validData, errors };
};

export const downloadAddressSyncTemplate = () => {
  const BOM = '\uFEFF';
  const csvContent = BOM + 'Username,Nama Penerima,Alamat Lengkap,Kecamatan,Kota/Kabupaten,Provinsi,Kode Pos,Resi,Status\n' +
    'johndoe,John Doe,Jl. Merdeka No 1,Gambir,Jakarta Pusat,DKI Jakarta,10110,JP12345678,Dikirim\n' +
    'janedoe,Jane Doe,Jl. Sudirman 2,,,,,,,Diproses';

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'Template_Sync_Alamat.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
