const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.eolisqycvpkzdzzaugkk:L!1687Hn87G4@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres'
});
async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT pg_get_viewdef('campaign_creators_performance', true) as viewdef;
  `);
  console.log(res.rows[0].viewdef);
  await client.end();
}
run().catch(console.error);
