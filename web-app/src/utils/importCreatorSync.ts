import Papa from 'papaparse';
import * as xlsx from 'xlsx';

export const parseFileHeaders = async (file: File): Promise<string[]> => {
  if (file.name.endsWith('.xlsx')) {
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
      preview: 1, // Only read first row to extract headers
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

export const TEMPLATE_HEADERS = [
  'Username',
  'Followers',
  'Tier',
  'Level',
  'Ratecard',
  'Audience Age',
  'GMV 30 Days',
  'No Whatsapp'
];

export const getAutoTier = (followers: number): string => {
  if (followers < 10000) return 'Nano';
  if (followers <= 100000) return 'Micro';
  if (followers <= 1000000) return 'Macro';
  return 'Mega';
};

export type ParsedCreatorRow = {
  username: string;
  followers: number | null;
  tier: string | null;
  level: number | null;
  ratecard: number | null;
  audience_age: string | null;
  gmv_30_days: number | null;
  no_whatsapp: string | null;
  raw_row: any;
};

export type ParseResult = {
  validData: ParsedCreatorRow[];
  errors: string[];
};

export type ColumnMapping = {
  username: string;
  followers: string;
  tier: string;
  level: string;
  ratecard: string;
  audience_age: string;
  gmv: string;
  no_whatsapp: string;
};

export const parseCreatorSyncFile = async (file: File, mapping: ColumnMapping): Promise<ParseResult> => {
  const validData: ParsedCreatorRow[] = [];
  const errors: string[] = [];

  let rowData: any[] = [];

  if (file.name.endsWith('.xlsx')) {
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
    const rowNum = index + 2; // +1 for header, +1 for 0-index
          
          const usernameStr = mapping.username ? (row[mapping.username] || '') : '';
          const username = usernameStr.toString().trim().replace(/^@/, ''); // Remove @ if exists
          
          if (!username) {
            errors.push(`Baris ${rowNum}: Username kosong, baris dilewati.`);
            return;
          }

          // Parse numeric fields
          const followersStr = mapping.followers ? (row[mapping.followers] || '').toString().replace(/[^0-9]/g, '') : '';
          const followers = followersStr ? parseInt(followersStr, 10) : null;

          const levelStr = mapping.level ? (row[mapping.level] || '').toString().replace(/[^0-9]/g, '') : '';
          const level = levelStr ? parseInt(levelStr, 10) : null;

          const rateRaw = mapping.ratecard ? (row[mapping.ratecard] || '').toString().toLowerCase().trim() : '';
          let ratecard: number | null = null;
          if (rateRaw === 'barter' || rateRaw === '0') {
            ratecard = 0;
          } else {
            const rateStr = rateRaw.replace(/[^0-9]/g, '');
            ratecard = rateStr ? parseInt(rateStr, 10) : null;
          }

          const gmvRaw = mapping.gmv ? (row[mapping.gmv] || '').toString().toLowerCase().trim() : '';
          let gmv_30_days: number | null = null;
          if (gmvRaw) {
            let multiplier = 1;
            if (gmvRaw.includes('m') || gmvRaw.includes('milyar') || gmvRaw.includes('miliar')) {
              multiplier = 1000000; // 'm' stands for juta (million) based on user's feedback
            } else if (gmvRaw.includes('jt') || gmvRaw.includes('juta')) {
              multiplier = 1000000;
            } else if (gmvRaw.includes('k') || gmvRaw.includes('rb') || gmvRaw.includes('ribu')) {
              multiplier = 1000;
            }
            
            // Extract numeric part including decimals (e.g., 2.3)
            const match = gmvRaw.match(/[0-9]+(\.[0-9]+)?/);
            if (match) {
              gmv_30_days = Math.floor(parseFloat(match[0]) * multiplier);
            }
          }

          // Whatsapp processing
          let noWa = mapping.no_whatsapp ? (row[mapping.no_whatsapp] || '').toString().trim() : '';
          // basic cleaning, remove non digits, + sign
          noWa = noWa.replace(/[^0-9+]/g, '');
          
          // Auto-fix missing '0' if it starts with '8'
          if (noWa.startsWith('8')) {
            noWa = '0' + noWa;
          } else if (noWa.startsWith('628')) {
            noWa = '08' + noWa.substring(3);
          } else if (noWa.startsWith('+628')) {
            noWa = '08' + noWa.substring(4);
          }

          // Logic for Tier Fallback
          let tier = mapping.tier ? (row[mapping.tier] || '').toString().trim() : '';
          if (followers !== null) {
            tier = getAutoTier(followers); // override tier if followers exists
          }

          validData.push({
            username,
            followers,
    validData.push({
      username,
      followers,
      tier: tier || null,
      level,
      ratecard,
      audience_age: mapping.audience_age ? (row[mapping.audience_age] || '').toString().trim() || null : null,
      gmv_30_days,
      no_whatsapp: noWa || null,
      raw_row: row
    });
  });

  return { validData, errors };
};

export const downloadCreatorSyncTemplate = () => {
  const BOM = '\uFEFF';
  const csvContent = BOM + TEMPLATE_HEADERS.join(',') + '\n' +
    'johndoe,150000,,4,500000,18-24,50000000,081234567890\n' +
    'janedoe,,Micro,2,,25-34,,';

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'Template_Sync_Creator.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
