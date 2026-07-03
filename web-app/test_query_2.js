import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testQuery() {
    let allRecapData = [];
    let start = 0;
    const pageSize = 200;
    while (true) {
      const { data, error } = await supabase
        .from('campaign_creators')
        .select(`
          id, approval, approved_at, created_at, added_by, tier, creator_id,
          creators (
            username,
            creator_snapshots ( tier, tanggal_update, id )
          )
        `)
        .eq('campaign_id', 44)
        .range(start, start + pageSize - 1);
        
      if (error) {
        console.error("Error at start", start, ":", error);
        break;
      }
      if (!data || data.length === 0) break;
      
      console.log(`Fetched from ${start} to ${start + pageSize - 1}: got ${data.length} rows`);
      allRecapData = allRecapData.concat(data);
      if (data.length < pageSize) break;
      start += pageSize;
    }
    console.log("Total Fetched:", allRecapData.length);
}

testQuery();
