import Papa from 'papaparse';

export interface ColumnMapping {
  ad_id: string;
  ad_name: string;
  cost: string;
  revenue: string;
  purchases: string;
  impressions: string;
  clicks: string;
}

export interface ParsedAdsRow {
  ad_id: string;
  ad_name: string;
  cost: number;
  revenue: number;
  purchases: number;
  impressions: number;
  clicks: number;
  _original: any;
}

export const downloadAdsSyncTemplate = () => {
  const headers = [
    'Ad ID',
    'Ad name',
    'Cost',
    'Gross revenue (Shop)',
    'Purchases (Shop)',
    'Impressions',
    'Clicks (destination)'
  ];

  const blob = new Blob([headers.join(',')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'Ads_Performance_Template.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const parseFileHeaders = (file: File): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      preview: 1,
      complete: (results) => {
        if (results.meta.fields) {
          resolve(results.meta.fields);
        } else {
          reject(new Error("Gagal membaca header dari file CSV."));
        }
      },
      error: (err) => {
        reject(err);
      }
    });
  });
};

export const parseAdsSyncFile = (file: File, mapping: ColumnMapping): Promise<{ validData: ParsedAdsRow[], errors: string[] }> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        const errors: string[] = [];
        const validData: ParsedAdsRow[] = [];
        
        results.data.forEach((row: any, index: number) => {
          const rowNum = index + 2; // +1 for header, +1 for 0-index
          
          const rawAdId = row[mapping.ad_id]?.trim();
          const rawAdName = row[mapping.ad_name]?.trim();
          const rawCost = row[mapping.cost]?.trim();
          const rawRevenue = row[mapping.revenue]?.trim();
          const rawPurchases = row[mapping.purchases]?.trim();
          const rawImpressions = row[mapping.impressions]?.trim();
          const rawClicks = row[mapping.clicks]?.trim();

          if (!rawAdId || !rawAdName) {
            errors.push(`Baris ${rowNum}: Ad ID atau Ad Name kosong.`);
            return;
          }

          const parseNumber = (val: string | undefined): number => {
            if (!val) return 0;
            const clean = val.replace(/[^0-9.-]+/g, "");
            return parseFloat(clean) || 0;
          };

          validData.push({
            ad_id: rawAdId,
            ad_name: rawAdName,
            cost: parseNumber(rawCost),
            revenue: parseNumber(rawRevenue),
            purchases: parseNumber(rawPurchases),
            impressions: parseNumber(rawImpressions),
            clicks: parseNumber(rawClicks),
            _original: row
          });
        });

        resolve({ validData, errors });
      },
      error: (error) => {
        reject(error);
      }
    });
  });
};
