import * as XLSX from 'xlsx';

export interface ColumnMapping {
  ad_id: string;
  ad_name: string;
  cost: string;
  revenue: string;
  purchases: string;
  impressions: string;
  clicks: string;
  product_page_views: string;
  checkouts_initiated: string;
  items_purchased: string;
}

export interface ParsedAdsRow {
  ad_id: string;
  ad_name: string;
  cost: number;
  revenue: number;
  purchases: number;
  impressions: number;
  clicks: number;
  product_page_views: number;
  checkouts_initiated: number;
  items_purchased: number;
  _original: any;
}

export interface EnrichedAdsRow extends ParsedAdsRow {
  prev_cost: number;
  prev_revenue: number;
  prev_purchases: number;
  prev_impressions: number;
  prev_clicks: number;
  prev_product_page_views: number;
  prev_checkouts_initiated: number;
  prev_items_purchased: number;
  
  delta_cost: number;
  delta_revenue: number;
  delta_purchases: number;
  delta_impressions: number;
  delta_clicks: number;
  delta_product_page_views: number;
  delta_checkouts_initiated: number;
  delta_items_purchased: number;
}

export const downloadAdsSyncTemplate = () => {
  const headers = [
    'Ad ID',
    'Ad name',
    'Cost',
    'Gross revenue (Shop)',
    'Purchases (Shop)',
    'Impressions',
    'Clicks (destination)',
    'Product page views (Shop)',
    'Checkouts initiated (Shop)',
    'Items purchased (Shop)'
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

export const parseFileHeaders = async (file: File): Promise<string[]> => {
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    if (jsonData.length > 0 && jsonData[0].length > 0) {
      return jsonData[0].map(h => String(h || '').trim()).filter(h => h !== '');
    }
    throw new Error("Gagal membaca header dari file.");
  } catch (err: any) {
    throw new Error("Format file tidak didukung atau rusak: " + err.message);
  }
};

export const parseAdsSyncFile = async (file: File, mapping: ColumnMapping): Promise<{ validData: ParsedAdsRow[], errors: string[] }> => {
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" }) as any[];
    
    const errors: string[] = [];
    const validData: ParsedAdsRow[] = [];
    
    jsonData.forEach((row, index) => {
      const rowNum = index + 2; 
      
      let rawAdId = String(row[mapping.ad_id] || '')?.trim();
      const rawAdName = String(row[mapping.ad_name] || '')?.trim();

      // Auto-ignore summary row from TikTok Ads
      if (rawAdId === '-' || rawAdName.toLowerCase().startsWith('total of')) {
        return; 
      }

      if (!rawAdName) {
        errors.push(`Baris ${rowNum}: Ad Name wajib diisi.`);
        return;
      }

      // If ad_id is missing, generate a pseudo ID based on Ad Name to prevent duplicates on re-upload
      if (!rawAdId) {
        rawAdId = `auto-${rawAdName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
      }

      const rawCost = String(row[mapping.cost] || '')?.trim();
      const rawRevenue = String(row[mapping.revenue] || '')?.trim();
      const rawPurchases = String(row[mapping.purchases] || '')?.trim();
      const rawImpressions = String(row[mapping.impressions] || '')?.trim();
      const rawClicks = String(row[mapping.clicks] || '')?.trim();
      const rawProductPageViews = String(row[mapping.product_page_views] || '')?.trim();
      const rawCheckoutsInitiated = String(row[mapping.checkouts_initiated] || '')?.trim();
      const rawItemsPurchased = String(row[mapping.items_purchased] || '')?.trim();

      const parseNumber = (val: string | undefined): number => {
        if (!val) return 0;
        const clean = val.replace(/[^0-9.-]+/g, "");
        return parseFloat(clean) || 0;
      };

      const parsedCost = parseNumber(rawCost);
      const parsedRevenue = parseNumber(rawRevenue);
      const parsedPurchases = parseNumber(rawPurchases);
      const parsedImpressions = parseNumber(rawImpressions);
      const parsedClicks = parseNumber(rawClicks);
      const parsedProductPageViews = parseNumber(rawProductPageViews);
      const parsedCheckoutsInitiated = parseNumber(rawCheckoutsInitiated);
      const parsedItemsPurchased = parseNumber(rawItemsPurchased);

      validData.push({
        ad_id: rawAdId,
        ad_name: rawAdName,
        cost: parsedCost,
        revenue: parsedRevenue,
        purchases: parsedPurchases,
        impressions: parsedImpressions,
        clicks: parsedClicks,
        product_page_views: parsedProductPageViews,
        checkouts_initiated: parsedCheckoutsInitiated,
        items_purchased: parsedItemsPurchased,
        _original: row
      });
    });

    // Aggregate identical ad_ids to prevent data loss (e.g. identical Ad Names when Ad ID is missing)
    const aggregatedData = Array.from(
      validData.reduce((acc, row) => {
        if (acc.has(row.ad_id)) {
          const existing = acc.get(row.ad_id)!;
          existing.cost += row.cost;
          existing.revenue += row.revenue;
          existing.purchases += row.purchases;
          existing.impressions += row.impressions;
          existing.clicks += row.clicks;
          existing.product_page_views += row.product_page_views;
          existing.checkouts_initiated += row.checkouts_initiated;
          existing.items_purchased += row.items_purchased;
        } else {
          acc.set(row.ad_id, { ...row });
        }
        return acc;
      }, new Map<string, ParsedAdsRow>()).values()
    );

    return { validData: aggregatedData, errors };
  } catch (error: any) {
    throw new Error("Gagal memproses file: " + error.message);
  }
};
