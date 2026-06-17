const { createClient } = require('@supabase/supabase-js');
const sb = createClient('https://eolisqycvpkzdzzaugkk.supabase.co', 'sb_publishable_OFbbBA8nlXzMLeZOliTt7A_pRadq_P7');
async function run() {
  let all = [];
  let hasMore = true;
  let from = 0;
  while(hasMore) {
    const {data} = await sb.from('campaign_creators').select('id, campaign_id, creator_id').range(from, from+999);
    if(data.length===0) break;
    all.push(...data);
    from += 1000;
  }
  const groups = {};
  all.forEach(x => {
    const k = x.campaign_id+'_'+x.creator_id;
    if(!groups[k]) groups[k]=[];
    groups[k].push(x.id);
  });
  const toDelete = [];
  for(const k in groups){
    const ids = groups[k];
    if(ids.length > 1){
      const {data: vids} = await sb.from('videos').select('campaign_creator_id').in('campaign_creator_id', ids);
      const hasVid = new Set(vids.map(v=>v.campaign_creator_id));
      let keepId = ids.find(id => hasVid.has(id)) || Math.min(...ids);
      toDelete.push(...ids.filter(id => id !== keepId));
    }
  }
  console.log('To delete:', toDelete.length);
  if(toDelete.length > 0){
    for(let i=0; i<toDelete.length; i+=500){
      const chunk = toDelete.slice(i, i+500);
      await sb.from('campaign_creators').delete().in('id', chunk);
      console.log('Deleted', chunk.length);
    }
  }
}
run();
