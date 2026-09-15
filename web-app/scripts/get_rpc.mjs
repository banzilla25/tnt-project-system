import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://eolisqycvpkzdzzaugkk.supabase.co";
const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvbGlzcXljdnBremR6emF1Z2trIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTAyMzY4NiwiZXhwIjoyMDk2NTk5Njg2fQ.mTSiu6O3XVbPrKDHiWIT0a4V38jrY3mRrBhaAnMyBuk";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const { data, error } = await supabase.rpc('execute_sql', {
    sql_query: "SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'get_campaign_performance';"
  });

  if (error) {
    console.log("Execute SQL not found, maybe I can just execute raw sql?");
  } else {
    console.log(data);
  }
}

run();
