import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function check() {
  console.log('Checking database counts...');
  
  const { count: cCount } = await supabase.from('creators').select('*', { count: 'exact', head: true });
  console.log(`Creators: ${cCount}`);
  
  const { count: campCount } = await supabase.from('campaigns').select('*', { count: 'exact', head: true });
  console.log(`Campaigns: ${campCount}`);
  
  const { count: ccCount } = await supabase.from('campaign_creators').select('*', { count: 'exact', head: true });
  console.log(`Campaign Creators: ${ccCount}`);
  
  const { count: snapCount } = await supabase.from('creator_snapshots').select('*', { count: 'exact', head: true });
  console.log(`Snapshots: ${snapCount}`);
  
  const { count: contactCount } = await supabase.from('creator_contacts').select('*', { count: 'exact', head: true });
  console.log(`Contacts: ${contactCount}`);
}

check().catch(console.error);
