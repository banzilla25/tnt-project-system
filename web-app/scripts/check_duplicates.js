const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDuplicates() {
  console.log("Fetching all campaign_creators...");
  
  let allData = [];
  let start = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('campaign_creators')
      .select(`
        id,
        campaign_id,
        creator_id,
        approval,
        creators (
          username
        )
      `)
      .range(start, start + pageSize - 1);

    if (error) {
      console.error("Error fetching data:", error);
      return;
    }

    if (!data || data.length === 0) {
      break;
    }
    
    allData = allData.concat(data);
    start += pageSize;
  }

  console.log(`Fetched ${allData.length} records.`);

  // Group by campaign_id and creator_id
  const groupings = {};

  for (const row of allData) {
    const key = `${row.campaign_id}_${row.creator_id}`;
    if (!groupings[key]) {
      groupings[key] = [];
    }
    groupings[key].push({
      id: row.id,
      approval: row.approval,
      username: row.creators?.username
    });
  }

  let foundDups = false;
  for (const [key, rows] of Object.entries(groupings)) {
    if (rows.length > 1) {
      foundDups = true;
      const [campaignId, creatorId] = key.split('_');
      console.log(`\nDUPLICATE FOUND! Campaign ID: ${campaignId}, Creator ID: ${creatorId}, Username: ${rows[0].username}`);
      console.table(rows);
    }
  }

  if (!foundDups) {
    console.log("No duplicates found across all campaigns.");
  }
}

checkDuplicates();
