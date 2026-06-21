const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  const { data, error } = await supabase.from('creators').insert({
    username: 'bellall1304',
    link_account: 'https://www.tiktok.com/@bellall1304',
    tipe_kreator: 'Reguler'
  }).select().single();

  if (error) {
    console.error("INSERT ERROR:", JSON.stringify(error, null, 2));
  } else {
    console.log("INSERT SUCCESS:", data);
  }
}

testInsert();
