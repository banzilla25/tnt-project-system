const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkVideos() {
  const { data, error } = await supabase.from('videos').select('*').eq('content_uid', '7611413181868592405');
  console.log(data, error);
}

checkVideos();
