import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: allRecapData } = await supabase
        .from('campaign_creators')
        .select(`
          id, approval, approved_at, created_at, added_by, tier, creator_id,
          creators ( username, creator_snapshots ( id, tier, tanggal_update ) )
        `)
        .eq('campaign_id', 41)
        .order('id', { ascending: true });

  const uniqueMap = new Map();
  for (const row of allRecapData) {
     const uname = row.creators?.username?.toLowerCase() || `unknown_${row.creator_id || row.id}`;
     if (!uniqueMap.has(uname)) {
        uniqueMap.set(uname, row);
     } else {
        // If duplicate exists, prefer 'approved' over others
        const existing = uniqueMap.get(uname);
        if (existing.approval !== 'approved' && row.approval === 'approved') {
            uniqueMap.set(uname, row);
        }
     }
  }
  const deduplicatedData = Array.from(uniqueMap.values());
  
  let approved = 0, pending = 0, alternate = 0, not_approved = 0;
  
  const tCounts = {
      approved: { Nano: 0, Micro: 0, Macro: 0, Mega: 0 },
      pending: { Nano: 0, Micro: 0, Macro: 0, Mega: 0 },
      alternate: { Nano: 0, Micro: 0, Macro: 0, Mega: 0 },
      not_approved: { Nano: 0, Micro: 0, Macro: 0, Mega: 0 },
      all: { Nano: 0, Micro: 0, Macro: 0, Mega: 0 }
  };

  deduplicatedData.forEach(r => {
      if (r.approval === 'approved') approved++;
      if (r.approval === 'pending') pending++;
      if (r.approval === 'alternate') alternate++;
      if (r.approval === 'not_approved') not_approved++;
      
      let t = r.creators?.creator_snapshots?.[0]?.tier || r.creators?.tier || 'Nano';
      t = t.toLowerCase();
      if (t === 'mega') t = 'Mega';
      else if (t === 'macro') t = 'Macro';
      else if (t === 'micro') t = 'Micro';
      else t = 'Nano';

      tCounts.all[t]++;
      if (r.approval === 'approved') tCounts.approved[t]++;
      else if (r.approval === 'alternate') tCounts.alternate[t]++;
      else if (r.approval === 'not_approved') tCounts.not_approved[t]++;
      else if (r.approval === 'pending') tCounts.pending[t]++;
  });

  console.log("JS deduplicated counts:", { all: deduplicatedData.length, approved, pending, alternate, not_approved });
  console.log("JS Tier counts pending:", tCounts.pending);
}

check();
