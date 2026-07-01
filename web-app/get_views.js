const { Client } = require('pg');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/DATABASE_URL="?(.*?)"?\n/);
const url = urlMatch ? urlMatch[1] : env.match(/DATABASE_URL=(.*)/)[1];
const client = new Client({ connectionString: url });
async function check() {
  await client.connect();
  const res = await client.query("SELECT definition FROM pg_views WHERE viewname = 'campaign_sales_summary'");
  console.log("campaign_sales_summary:", res.rows[0].definition);
  const res2 = await client.query("SELECT definition FROM pg_views WHERE viewname = 'vw_campaign_summary'");
  console.log("vw_campaign_summary:", res2.rows[0].definition);
  await client.end();
}
check();
