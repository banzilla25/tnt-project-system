const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { error: batchError } = await supabase.from('payment_batches')
    .update({
      status: 'pending_executive',
      finance_reviewed_by: 'b2877144-16dd-4dbe-800b-de215d7eea28', // some dummy UUID
      finance_reviewed_at: new Date().toISOString()
    })
    .in('id', [1])
    .eq('status', 'pending_finance');

  console.log("Batch Error:", batchError);
}

test();
