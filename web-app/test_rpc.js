const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const { data: viewData, error: viewError } = await supabase.from('campaign_creators_performance').select('*').eq('campaign_id', 41).limit(2);
    console.log('VIEW output:', viewData, viewError);

    const { data: rpcData, error: rpcError } = await supabase.rpc('get_campaign_performance', { p_campaign_id: 41 });
    console.log('RPC output:', rpcData, rpcError);
}
main();
