import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function main() {
  const { data, error } = await supabase.from('sales').upsert([
    {
      campaign_id: 2, // assuming Qahira is 2, doesn't matter
      creator_username: 'test',
      tanggal: new Date().toISOString(),
      gmv: 0,
      price: 0,
      quantity: 1,
      is_refund: false,
      content_type: 'Video',
      order_id: 'test_order_123',
    }
  ], { onConflict: 'order_id' }).select('id');

  console.log("Error:", error);
  console.log("Data length:", data?.length);
  console.log("Data:", data);
}

main();
