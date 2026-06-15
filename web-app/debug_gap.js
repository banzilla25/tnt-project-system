const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkGap() {
  const campaignId = 17; // Qahira

  // 1. Get all approved creator usernames
  const { data: ccs } = await supabase.from('campaign_creators').select('creator_id, approval, tier').eq('campaign_id', campaignId);
  const approvedCreatorIds = ccs.filter(cc => cc.approval === 'approved').map(cc => cc.creator_id);
  
  const { data: creators } = await supabase.from('creators').select('id, username').in('id', approvedCreatorIds);
  const approvedUsernames = new Set(creators.map(c => c.username));

  // 2. Get all sales
  const { data: sales } = await supabase.from('sales').select('*').eq('campaign_id', campaignId).eq('is_refund', false);

  // 3. Find missing sales
  let totalGap = 0;
  let gapDetails = {};

  for (const s of sales) {
    if (!approvedUsernames.has(s.creator_username)) {
      totalGap += s.gmv;
      if (!gapDetails[s.creator_username]) {
        gapDetails[s.creator_username] = { gmv: 0, count: 0 };
      }
      gapDetails[s.creator_username].gmv += s.gmv;
      gapDetails[s.creator_username].count++;
    }
  }

  console.log(`Total Gap: Rp ${totalGap}`);
  console.log('Unattributed Usernames:', gapDetails);

  // 4. For those usernames, check their status in campaign_creators
  for (const username in gapDetails) {
    const { data: c } = await supabase.from('creators').select('id').eq('username', username).single();
    if (c) {
      const cc = ccs.find(x => x.creator_id === c.id);
      if (cc) {
        console.log(`Username ${username} is IN campaign_creators with approval='${cc.approval}' and tier='${cc.tier}'`);
      } else {
        console.log(`Username ${username} is NOT in campaign_creators!`);
      }
    } else {
      console.log(`Username ${username} is NOT in creators table!`);
    }
  }
}

checkGap();
