require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.rpc('execute_sql', { query_text: "SELECT pg_get_viewdef('campaign_creators_performance', true);" })
  .then(res => console.log(res.data?.[0]?.pg_get_viewdef || res));
