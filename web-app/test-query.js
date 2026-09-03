const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('payment_batches').select(`
    *,
    submitter:profiles!submitted_by(nama),
    campaigns(nama),
    payment_items(
      id, nominal, biaya_transfer, final_status, payment_type, campaign_creator_id, metode_pembayaran, nomor_rekening, nama_penerima, notes, ratecard_awal, actual_transfer, executive_note, manager_note,
      campaign_creators(creators(username, nama_asli), profiles:profiles!added_by(nama)),
      creator_bank_accounts(bank_name, account_number, account_holder)
    )
  `).order('created_at', { ascending: false }).limit(2);
  
  if (error) {
    console.error("ERROR:", error);
  } else {
    console.log("Success, got data length:", data.length);
    if(data.length > 0 && data[0].payment_items) {
       console.log("Sample item:", data[0].payment_items[0]);
    }
  }
}

run();
