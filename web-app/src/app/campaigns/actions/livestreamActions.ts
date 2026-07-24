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
  const fetchAll = async (baseQuery: any) => {
    let all: any[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await baseQuery.range(from, from + 999);
      if (error) throw error;
      if (!data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < 1000) break;
      from += 1000;
    }
    return all;
  };

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (!campaign) return null;

  const ccData = await fetchAll(supabase
    .from('campaign_creators')
    .select('*, creators!inner(*)')
    .eq('campaign_id', campaignId)
  );

  const sData = await fetchAll(supabase
    .from('sales')
    .select('*')
    .eq('campaign_id', campaignId)
    .or('content_type.ilike.livestream,content_type.ilike.live')
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
