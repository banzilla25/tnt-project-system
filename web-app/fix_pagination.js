const fs = require('fs');

const fetchAllHelper = `
      // Helper to fetch all rows paginated to bypass 1000 row limit
      const fetchAll = async (baseQuery) => {
        let all = [];
        let from = 0;
        while (true) {
          const { data, error } = await baseQuery.range(from, from + 999);
          if (error) throw error;
          if (!data || data.length === 0) break;
          all = all.concat(data);
          if (data.length < 1000) break;
          from += 1000;
        }
        return all;
      };
`;

function fixLivestream() {
  const path = 'src/app/campaigns/[id]/livestream/page.tsx';
  let content = fs.readFileSync(path, 'utf8');
  if (content.includes('const fetchAll = async')) return;

  content = content.replace('try {', 'try {' + fetchAllHelper);
  
  // Replace ccData
  content = content.replace(
    /const { data: ccData, error: ccError } = await supabase\s*\.from\('campaign_creators'\)\s*\.select\('\*, creators!inner\(\*\)'\)\s*\.eq\('campaign_id', campaignId\)\s*\.eq\('approval', 'approved'\);/g,
    `const ccData = await fetchAll(supabase
          .from('campaign_creators')
          .select('*, creators!inner(*)')
          .eq('campaign_id', campaignId)
          .eq('approval', 'approved'));`
  );
  content = content.replace('if (ccError) throw ccError;', '');

  // Replace sData
  content = content.replace(
    /const { data: sData, error: sError } = await supabase\s*\.from\('sales'\)\s*\.select\('\*'\)\s*\.eq\('campaign_id', campaignId\)\s*\.in\('content_type', \['Livestream', 'Live'\]\);/g,
    `const sData = await fetchAll(supabase
          .from('sales')
          .select('*')
          .eq('campaign_id', campaignId)
          .in('content_type', ['Livestream', 'Live']));`
  );
  content = content.replace('if (sError) throw sError;', '');

  fs.writeFileSync(path, content);
  console.log('Fixed livestream');
}

fixLivestream();
