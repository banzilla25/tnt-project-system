'use server'

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  global: {
    fetch: (url, options) => {
      return fetch(url, { ...options, cache: 'no-store' });
    }
  }
});

export async function getLivestreamData(campaignId: number) {
  const fetchParallel = async (table: string, queryParams: (q: any) => any, selectString: string) => {
    let all: any[] = [];
    const countQuery = queryParams(supabase.from(table).select('id', { count: 'exact', head: true }));
    const { count } = await countQuery;
    
    if (count && count > 0) {
      const promises = [];
      for (let i = 0; i < count; i += 1000) {
        promises.push(
          queryParams(supabase.from(table).select(selectString)).range(i, i + 999)
        );
      }
      const results = await Promise.all(promises);
      results.forEach(res => {
        if (res.data) all = all.concat(res.data);
      });
    }
    return all;
  };

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (!campaign) return null;

  const ccData = await fetchParallel(
    'campaign_creators', 
    (q) => q.eq('campaign_id', campaignId), 
    '*, creators!inner(*)'
  );

  const sData = await fetchParallel(
    'sales', 
    (q) => q.eq('campaign_id', campaignId).or('content_type.ilike.livestream,content_type.ilike.live'), 
    '*'
  );

  const contentUids = sData ? Array.from(new Set(sData.map(s => s.content_uid).filter(Boolean))) : [];
  let metricsData: any[] = [];
  
  if (contentUids.length > 0) {
    const { data: oData } = await supabase
      .from('organic_videos')
      .select('*')
      .in('content_uid', contentUids);
    if (oData) metricsData = oData;
  }

  return {
    campaign,
    creators: ccData || [],
    salesData: sData || [],
    liveMetrics: metricsData
  };
}
