require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('execute_sql', {
    sql_query: "ALTER TABLE payment_items ADD COLUMN IF NOT EXISTS actual_transfer NUMERIC;"
  });

  if (error) {
    console.log("RPC failed, trying raw query if possible or we might need postgres access...");
    console.error(error.message);
  } else {
    console.log("Column added successfully!");
  }
}

run();
