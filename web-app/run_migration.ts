import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const sql = fs.readFileSync('C:\\Users\\Hibban\\.gemini\\antigravity\\brain\\31d6ba9e-fe21-4801-b2b9-ae6085a3b8cd\\db_migration_phase16.sql', 'utf8');
  const { data, error } = await supabase.rpc('run_sql', { query: sql });
  if (error) {
    console.error("Failed to run sql query:", error.message);
  } else {
    console.log("Migration successful.");
  }
}
run();
