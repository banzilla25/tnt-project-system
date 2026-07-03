import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testSalesVt() {
      let salesVtQuery = supabase.from('sales').select('creator_username, content_uid, tanggal, content_type').eq('campaign_id', 44).not('content_uid', 'is', null);
      
      let all = [];
      let from = 0;
      while (true) {
        const { data, error } = await salesVtQuery.range(from, from + 999);
        if (error) {
            console.error("Error at", from, error);
            break;
        }
        if (!data || data.length === 0) break;
        console.log(`Fetched ${data.length} from ${from}`);
        all = all.concat(data);
        if (data.length < 1000) break;
        from += 1000;
      }
      console.log('Total sales:', all.length);
}

testSalesVt();
