const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Simple Levenshtein distance function for fuzzy matching
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

async function run() {
  console.log('Connecting to Supabase...');
  
  // Test connection first
  const { error: testErr } = await supabase.from('campaigns').select('id').limit(1);
  if (testErr) {
    console.error('Connection failed:', testErr.message);
    return;
  }
  console.log('Connected successfully!');

  // Fetch all campaigns to get their names for matching
  const { data: campaigns } = await supabase.from('campaigns').select('id, nama');

  // Fetch all payout requests from raw table
  const { data: payouts } = await supabase.from('payout_creator').select('*');
  console.log(`Found ${payouts?.length || 0} payout records in raw table.`);

  // Fetch existing payments to avoid duplicates
  const { data: existingPayments } = await supabase.from('creator_payments').select('campaign_creator_id');
  const existingSet = new Set(existingPayments?.map(p => p.campaign_creator_id) || []);

  // Fetch all campaign creators
  const { data: campaignCreators } = await supabase.from('campaign_creators').select('id, campaign_id, price, creator_id');
  const { data: creators } = await supabase.from('creators').select('id, username');
  
  const creatorMap = new Map();
  creators?.forEach(c => creatorMap.set(c.id, c.username));

  let patched = 0;

  for (const payout of (payouts || [])) {
    const rawName = (payout.username || '').toLowerCase().trim();
    const rawCampaignName = (payout.campaign_name || '').toLowerCase().trim();

    // Match campaign
    const campaignMatch = campaigns?.find(c => c.nama.toLowerCase().includes(rawCampaignName) || rawCampaignName.includes(c.nama.toLowerCase()));
    if (!campaignMatch) continue;

    // Get all creators for this campaign
    const ccs = campaignCreators?.filter(c => c.campaign_id === campaignMatch.id) || [];
    
    // Find the closest username match
    let bestMatch = null;
    let bestDist = Infinity;

    for (const cc of ccs) {
      const username = (creatorMap.get(cc.creator_id) || '').toLowerCase().trim();
      const dist = levenshteinDistance(rawName, username);
      
      if (dist < bestDist) {
        bestDist = dist;
        bestMatch = cc;
      }
    }

    // If we have a reasonable match (e.g. typos <= 4 characters distance)
    if (bestMatch && bestDist <= 4) {
      if (!existingSet.has(bestMatch.id)) {
        // Insert creator payment
        const rateCard = typeof payout.rate_card === 'number' ? payout.rate_card : parseInt(String(payout.rate_card).replace(/\\D/g, '') || '0');
        const paid = typeof payout.nominal_pembayaran === 'number' ? payout.nominal_pembayaran : parseInt(String(payout.nominal_pembayaran).replace(/\\D/g, '') || '0');
        
        let status = 'not_yet';
        if (paid > 0 && paid >= rateCard) status = 'pay_off';
        else if (paid > 0) status = 'half_paid';

        const { error } = await supabase.from('creator_payments').insert({
          campaign_creator_id: bestMatch.id,
          rate_card: rateCard || bestMatch.price || 0,
          pelunasan: paid,
          status_bayar: status
        });

        if (error) {
          console.error(`Failed to patch payment for ${rawName}:`, error.message);
        } else {
          console.log(`Patched payment for ${rawName} -> Matched to ${creatorMap.get(bestMatch.creator_id)} (Dist: ${bestDist})`);
          existingSet.add(bestMatch.id);
          patched++;
        }
      }
    } else {
      console.log(`No match for payout: ${rawName} in ${rawCampaignName}`);
    }
  }

  console.log(`Successfully patched ${patched} missing payouts.`);
}

run().catch(console.error);
