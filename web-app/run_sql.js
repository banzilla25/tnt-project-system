require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { Client } = require('pg');

async function run() {
  const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.log("No DATABASE_URL found");
    return;
  }
  const client = new Client({ connectionString });
  await client.connect();
  
  const sql = fs.readFileSync('create_notes_table.sql', 'utf8');
  try {
    await client.query(sql);
    console.log("Table created successfully");
  } catch(e) {
    console.error("Error creating table:", e);
  } finally {
    await client.end();
  }
}
run();
