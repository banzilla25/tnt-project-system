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
  tier: string;
  username: string;
  followers: string;
  no_whatsapp: string;
  ratecard: string;
  qty_vt: string;
  qty_live: string;
  content_type: string;
  level: string;
  audience_age: string;
  gmv_30d: string;
  approval: string;
  sample_progress: string;
  notes_manager: string;
  notes_pic: string;
};

export type ParsedCampaignCreatorRow = {
  tier: string | null;
  username: string;
  followers: number | null;
  no_whatsapp: string | null;
  ratecard: number | null;
  qty_vt?: number;
  qty_live?: number;
  content_type: string | null;
  level: number | null;
  audience_age: string | null;
  gmv_30d: number | null;
  approval: 'pending' | 'approved' | 'alternate' | 'not_approved';
  sample_progress: string | null;
  notes_manager: string | null;
  notes_pic: string | null;
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
    let content_type = mapping.content_type ? (row[mapping.content_type] || '').toString().trim() || null : null;
    if (content_type) {
      const ctLower = content_type.toLowerCase();
      const hasVideo = ctLower.includes('video') || ctLower.includes('vt');
      const hasLive = ctLower.includes('live');
      if (hasVideo && hasLive) {
        content_type = 'Video & Live';
      } else if (hasLive) {
        content_type = 'Live';
      } else if (hasVideo) {
        content_type = 'Video';
      } else {
        // Fallback to title case if it's something unexpected
        content_type = content_type.charAt(0).toUpperCase() + content_type.slice(1).toLowerCase();
      }
    }

    const qty_vt = mapping.qty_vt ? parseInt(row[mapping.qty_vt]) || 1 : undefined;
    const qty_live = mapping.qty_live ? parseInt(row[mapping.qty_live]) || 0 : undefined;

    const parseNum = (val: any) => {
      if (!val) return null;
      if (typeof val === 'number') return val;
      const str = val.toString().replace(/[^0-9]/g, '');
      return str ? parseInt(str) : null;
    };

    const tier = mapping.tier ? (row[mapping.tier] || '').toString().trim() || null : null;
    const followers = mapping.followers ? parseNum(row[mapping.followers]) : null;
    const no_whatsapp = mapping.no_whatsapp ? (row[mapping.no_whatsapp] || '').toString().trim() || null : null;
    const ratecard = mapping.ratecard ? parseNum(row[mapping.ratecard]) : null;
    const level = mapping.level ? parseNum(row[mapping.level]) : null;
    const audience_age = mapping.audience_age ? (row[mapping.audience_age] || '').toString().trim() || null : null;
    const gmv_30d = mapping.gmv_30d ? parseNum(row[mapping.gmv_30d]) : null;

    validData.push({
      tier,
      username,
      followers,
      no_whatsapp,
      ratecard,
      qty_vt,
      qty_live,
      content_type,
      level,
      audience_age,
      gmv_30d,
      approval,
      sample_progress,
      notes_manager,
      notes_pic,
      raw_row: row
    });
  });

  return { validData, errors };
};

export const downloadCampaignSyncTemplate = () => {
  const BOM = '\uFEFF';
  const csvContent = BOM + 'Tier,Username,Followers,No. Whatsapp,Ratecard,Qty Video,qty Live,Type,Level,Audiens Age,GMV 30 days,Approval,Sample Progress\n' +
    'Nano,johndoe,15000,081234567890,500000,1,0,Video,3,18-24,10000000,Approve,Dikirim\n' +
    'Micro,janedoe,55000,,,2,1,Video & Live,4,25-34,25000000,Pending,Belum';

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'Template_Sync_Campaign_Listing.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
