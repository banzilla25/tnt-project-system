require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

async function run() {
  const pool = new Pool({
    connectionString: process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', 'postgres://postgres:PASSWORD@db.').replace('.supabase.co', '.supabase.co:6543/postgres'), // I can't use this if I don't have the db password.
  });
}
run();
