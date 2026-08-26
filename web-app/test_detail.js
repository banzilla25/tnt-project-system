
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabaseAdmin.from("payment_batches").select(`
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
        id, tier, price, qty_vt, creators(id, username, nama_asli)
      ),
      creator_bank_accounts(bank_name, account_number, account_holder)
    )
  `).eq("id", 4).single();
  console.log("Error:", error);
  console.log("Data exists:", !!data);
}
test();

