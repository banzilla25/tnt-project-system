import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('execute_sql', {
    query: `
      ALTER TABLE campaigns
      ADD COLUMN target_creator_nano INTEGER DEFAULT 0,
      ADD COLUMN target_creator_micro INTEGER DEFAULT 0,
      ADD COLUMN target_creator_macro INTEGER DEFAULT 0,
      ADD COLUMN target_creator_mega INTEGER DEFAULT 0;
    `
  });
  
  if (error) {
    console.log("RPC execute_sql failed. Trying direct query if possible, or we may need a different approach.");
    console.error(error);
  } else {
    console.log("Success:", data);
  }
}

run();
