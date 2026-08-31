require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('payment_batches').select(`
    *,
    submitter:profiles!submitted_by(nama),
    manager:profiles!manager_reviewed_by(nama),
    finance:profiles!finance_reviewed_by(nama),
    executive:profiles!executive_reviewed_by(nama),
    payer:profiles!paid_by(nama),
    sender_account:sender_accounts(nama),
    campaigns(nama),
    payment_items(
      *,
      campaign_creators(
        id, tier, price, qty_vt, creators(id, username, nama_asli), profiles:profiles!added_by(nama)
      ),
      creator_bank_accounts(bank_name, account_number, account_holder)
    )
  `).limit(1);

  if (error) {
    console.error("ERROR:", error.message);
  } else {
    console.log("SUCCESS, found", data.length, "batches.");
  }
}

test();
