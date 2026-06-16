import Papa from 'papaparse';
import * as xlsx from 'xlsx';

export const parseFileHeaders = async (file: File): Promise<string[]> => {
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

export type CampaignColumnMapping = {
  username: string;
  approval: string;
  notes_manager: string;
  notes_pic: string;
  sample_progress: string;
};

export type ParsedCampaignCreatorRow = {
  username: string;
  approval: 'pending' | 'approved' | 'alternate' | 'not_approved';
  notes_manager: string | null;
  notes_pic: string | null;
  sample_progress: string | null;
  raw_row: any;
};

export type CampaignParseResult = {
  validData: ParsedCampaignCreatorRow[];
  errors: string[];
};

export const parseCampaignSyncFile = async (file: File, mapping: CampaignColumnMapping): Promise<CampaignParseResult> => {
  const validData: ParsedCampaignCreatorRow[] = [];
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

    const approvalRaw = mapping.approval ? (row[mapping.approval] || '').toString().toLowerCase().trim() : '';
    let approval: 'pending' | 'approved' | 'alternate' | 'not_approved' = 'pending';
    
    if (approvalRaw.includes('not') || approvalRaw.includes('reject') || approvalRaw.includes('tolak') || approvalRaw.includes('belum')) {
      approval = 'not_approved';
    } else if (approvalRaw.includes('approve') || approvalRaw.includes('acc') || approvalRaw === 'ok') {
      approval = 'approved';
    } else if (approvalRaw.includes('alternate') || approvalRaw.includes('alt')) {
      approval = 'alternate';
    }

    const notes_manager = mapping.notes_manager ? (row[mapping.notes_manager] || '').toString().trim() || null : null;
    const notes_pic = mapping.notes_pic ? (row[mapping.notes_pic] || '').toString().trim() || null : null;
    const sample_progress = mapping.sample_progress ? (row[mapping.sample_progress] || '').toString().trim() || null : null;

    validData.push({
      username,
      approval,
      notes_manager,
      notes_pic,
      sample_progress,
      raw_row: row
    });
  });

  return { validData, errors };
};

export const downloadCampaignSyncTemplate = () => {
  const BOM = '\uFEFF';
  const csvContent = BOM + 'Username,Approval,Notes Manager,Notes PIC,Sample Progress\n' +
    'johndoe,Approve,Bagus,Lanjut kontak,Dikirim\n' +
    'janedoe,Pending,,,Belum';

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'Template_Sync_Campaign_Listing.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
