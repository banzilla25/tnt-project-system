const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkColumns(tableName) {
  const { data, error } = await supabase.from(tableName).select('*').limit(1);
  if (error) {
    console.error(`Error fetching ${tableName}:`, error.message);
  } else {
    console.log(`--- ${tableName} ---`);
    if (data.length > 0) {
      console.log(Object.keys(data[0]).join(', '));
    } else {
      console.log('No rows, cannot infer columns from data[0]. Try querying information_schema if possible.');
    }
  }
}

async function run() {
  await checkColumns('payment_items');
  await checkColumns('campaign_creators');
  await checkColumns('creators');
  await checkColumns('creator_bank_accounts');
  await checkColumns('profiles');
}

run();
