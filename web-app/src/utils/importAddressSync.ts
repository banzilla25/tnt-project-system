import Papa from 'papaparse';
import * as xlsx from 'xlsx';

export type AddressColumnMapping = {
  username: string;
  nama_penerima: string;
  nama_jalan: string;
  kecamatan: string;
  kelurahan: string;
  kabupaten_kota: string;
  provinsi: string;
  kode_pos: string;
  resi: string;
  ekspedisi: string;
  proses: string;
  produk: string;
  tanggal_kirim: string;
  notes: string;
};

export type ParsedAddressRow = {
  username: string;
  nama_penerima: string | null;
  nama_jalan: string | null;
  kecamatan: string | null;
  kelurahan: string | null;
  kabupaten_kota: string | null;
  provinsi: string | null;
  kode_pos: string | null;
  resi: string | null;
  ekspedisi: string | null;
  proses: string | null;
  produk: string | null;
  tanggal_kirim: string | null;
  notes: string | null;
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
    const username = usernameStr.toString().trim().replace(/^@/, '').replace(/\s+/g, '');
    
    if (!username) {
      errors.push(`Baris ${rowNum}: Username kosong, baris dilewati.`);
      return;
    }

    const nama_penerima = mapping.nama_penerima ? (row[mapping.nama_penerima] || '').toString().trim() || null : null;
    const nama_jalan = mapping.nama_jalan ? (row[mapping.nama_jalan] || '').toString().trim() || null : null;
    const kecamatan = mapping.kecamatan ? (row[mapping.kecamatan] || '').toString().trim() || null : null;
    const kelurahan = mapping.kelurahan ? (row[mapping.kelurahan] || '').toString().trim() || null : null;
    const kabupaten_kota = mapping.kabupaten_kota ? (row[mapping.kabupaten_kota] || '').toString().trim() || null : null;
    const provinsi = mapping.provinsi ? (row[mapping.provinsi] || '').toString().trim() || null : null;
    const kode_pos = mapping.kode_pos ? (row[mapping.kode_pos] || '').toString().trim() || null : null;
    const resi = mapping.resi ? (row[mapping.resi] || '').toString().trim() || null : null;
    const produk = mapping.produk ? (row[mapping.produk] || '').toString().trim() || null : null;
    const notes = mapping.notes ? (row[mapping.notes] || '').toString().trim() || null : null;
    
    // Convert Excel serial date to ISO string if needed for tanggal_kirim
    let tanggal_kirim = null;
    if (mapping.tanggal_kirim && row[mapping.tanggal_kirim]) {
      let tkRaw = row[mapping.tanggal_kirim];
      if (typeof tkRaw === 'number') {
        const d = new Date(Math.round((tkRaw - 25569) * 86400 * 1000));
        tanggal_kirim = d.toISOString().split('T')[0];
      } else {
        const tkStr = tkRaw.toString().trim();
        if (tkStr) {
           const d = new Date(tkStr);
           if (!isNaN(d.getTime())) {
             tanggal_kirim = d.toISOString().split('T')[0];
           } else {
             tanggal_kirim = tkStr; // fallback to raw string if unrecognized
           }
        }
      }
    }
    
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

    let ekspedisi: string | null = mapping.ekspedisi && row[mapping.ekspedisi] ? String(row[mapping.ekspedisi]).trim() : null;

    validData.push({
      username,
      nama_penerima,
      nama_jalan,
      kecamatan,
      kelurahan,
      kabupaten_kota,
      provinsi,
      kode_pos,
      resi,
      ekspedisi,
      proses,
      produk,
      tanggal_kirim,
      notes,
      raw_row: row
    });
  });

  return { validData, errors };
};

export const downloadAddressSyncTemplate = () => {
  const BOM = '\uFEFF';
  const csvContent = BOM + 'No,Product,Username,No Whatsapp,Nama Penerima,Nama Jalan,Provinsi,Kabupaten/Kota,Kecamatan,Kelurahan,Kode Pos,Proses,Tanggal Kirim,Resi,Ekspedisi,Notes,Status\n' +
    '1,Lipstik,johndoe,08123456789,John Doe,Jl. Merdeka No 1,DKI Jakarta,Jakarta Pusat,Gambir,Gambir,10110,Dikirim,2026-06-25,JP12345678,JNT,Titip di satpam,Approved\n' +
    '2,Bedak,janedoe,08987654321,Jane Doe,Jl. Sudirman 2,,,,,,,Diproses,,,,,,';

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'Template_Sync_Alamat.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
