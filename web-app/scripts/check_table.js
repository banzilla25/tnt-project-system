
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabaseAdmin.from('payment_batches').select('executive_reviewed_by').eq('id', 4);
  console.log('Value:', data);
  
  // let's try to update using the user's ID to see if it fails
  const { data: user } = await supabaseAdmin.auth.admin.listUsers();
  if (user.users.length > 0) {
     const testUserId = user.users[0].id;
     const { error: e } = await supabaseAdmin.from('payment_batches').update({ executive_reviewed_by: testUserId }).eq('id', 4);
     console.log('Update Error with User ID:', e);
  }
}
check();

