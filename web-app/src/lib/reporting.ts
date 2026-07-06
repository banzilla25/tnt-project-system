// src/lib/reporting.ts
import { createClient } from '@/utils/supabase/client';
import * as ExcelJS from 'exceljs';
import { exportToExcel } from '@/utils/exportToExcel';

// Helper to fetch all rows with pagination (1000 rows per batch)
async function fetchAll<T>(baseQuery: any): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await baseQuery.range(from, from + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

/**
 * Fetch report data for a given campaign.
 * Returns an object containing:
 * - totalSold: number
 * - topSkus: Array<{ sku: string; gmv: number; thumbnail: string }>
 * - creators, videos, samples, receipts (array of rows for the tabs)
 */
export async function fetchReportData(campaignId: string) {
  const supabase = createClient();

  // Example queries – adapt field names to actual schema
  const [{ data: soldData }, { data: skuData }, creators, videos, samples, receipts] = await Promise.all([
    supabase.from('sales').select('quantity').eq('campaign_id', campaignId),
    supabase
      .from('products')
      .select('sku, gmv, thumbnail')
      .eq('campaign_id', campaignId)
      .order('gmv', { ascending: false })
      .limit(5),
    fetchAll<any>(supabase.from('creators').select('*').eq('campaign_id', campaignId)),
    fetchAll<any>(supabase.from('videos').select('*').eq('campaign_id', campaignId)),
    fetchAll<any>(supabase.from('samples').select('*').eq('campaign_id', campaignId)),
    fetchAll<any>(supabase.from('receipts').select('*').eq('campaign_id', campaignId)),
  ]);

  const totalSold = soldData?.reduce((sum: number, row: any) => sum + (row.quantity ?? 0), 0) ?? 0;
  const topSkus = skuData as any[];

  return {
    totalSold,
    topSkus,
    creators,
    videos,
    samples,
    receipts,
  };
}

/**
 * Generate an Excel workbook buffer for the given campaign.
 * The workbook contains separate sheets: Summary, Creators, Videos, Samples, Receipts.
 */
export async function generateExcelBuffer(campaignId: string): Promise<Buffer> {
  const data = await fetchReportData(campaignId);
  const wb = new ExcelJS.Workbook();

  // Summary sheet
  const summarySheet = wb.addWorksheet('Summary');
  summarySheet.addRow(['Total Items Sold', data.totalSold]);
  summarySheet.addRow([]);
  summarySheet.addRow(['Top 5 SKUs']);
  summarySheet.addRow(['SKU', 'GMV', 'Thumbnail']);
  data.topSkus.forEach((sku: any) => {
    summarySheet.addRow([sku.sku, sku.gmv, sku.thumbnail]);
  });

  // Helper to add generic sheet
  const addSheet = (name: string, rows: any[]) => {
    const sheet = wb.addWorksheet(name);
    if (rows.length === 0) return;
    const columns = Object.keys(rows[0]).map((key) => ({ header: key, key }));
    sheet.columns = columns as any;
    rows.forEach((row) => sheet.addRow(row));
  };

  addSheet('Creators', data.creators);
  addSheet('Videos', data.videos);
  addSheet('Samples', data.samples);
  addSheet('Receipts', data.receipts);

  // Return buffer
  return wb.xlsx.writeBuffer() as any;
}
