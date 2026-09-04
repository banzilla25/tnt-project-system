import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DatabaseSchema } from "@/types/database";

const supabase = createClient<DatabaseSchema>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { productId, campaignId } = await req.json();

    if (!productId || !campaignId) {
      return NextResponse.json({ error: "Missing productId or campaignId" }, { status: 400 });
    }

    // 1. Update Sales
    const { data: updatedSales, error: errSales } = await supabase
      .from('sales')
      .update({ campaign_id: campaignId } as any)
      .is('campaign_id', null)
      .eq('product_id', productId)
      .select('creator_username');

    if (errSales) {
      console.error("Error syncing unmapped sales:", errSales);
      throw errSales;
    }

    // 2. Update Organic Videos
    const { data: updatedVideos, error: errVideos } = await supabase
      .from('organic_videos')
      .update({ campaign_id: campaignId } as any)
      .is('campaign_id', null)
      .eq('product_id', productId)
      .select('content_uid, creator_username');

    if (errVideos) {
      console.error("Error syncing unmapped organic videos:", errVideos);
      throw errVideos;
    }

    // 3. Auto-Register Creators
    const uniqueUsernames = new Set<string>();
    updatedSales?.forEach(s => { if (s.creator_username) uniqueUsernames.add(s.creator_username.toLowerCase()); });
    updatedVideos?.forEach(v => { if (v.creator_username) uniqueUsernames.add(v.creator_username.toLowerCase()); });
    
    const usernames = Array.from(uniqueUsernames);
    if (usernames.length > 0) {
      // a. Check missing from creators
      const { data: existingCreators } = await supabase.from('creators').select('username').in('username', usernames);
      const existingCreatorNames = new Set((existingCreators || []).map(c => c.username.toLowerCase()));
      const missingCreators = usernames.filter(u => !existingCreatorNames.has(u));
      
      if (missingCreators.length > 0) {
        const newCreators = missingCreators.map(u => ({ username: u, nama_asli: u }));
        await supabase.from('creators').insert(newCreators);
      }

      // b. Check missing from campaign_creators
      const { data: existingCcs } = await supabase.from('campaign_creators')
        .select('creators!inner(username)')
        .eq('campaign_id', campaignId)
        .in('creators.username', usernames);
        
      const existingCcNames = new Set((existingCcs || []).map(cc => cc.creators.username.toLowerCase()));
      const missingCcs = usernames.filter(u => !existingCcNames.has(u));
      
      if (missingCcs.length > 0) {
        // We need the creator IDs for those missing
        const { data: creatorsForCcs } = await supabase.from('creators').select('id, username').in('username', missingCcs);
        if (creatorsForCcs) {
          const newCcsToInsert = creatorsForCcs.map(c => ({
            campaign_id: campaignId,
            creator_id: c.id,
            tier: 'Auto-Detect',
            approval: 'pending',
            client_approval: 'not_required',
            status_bayar: 'belum',
            qty_vt: 1,
            price: 0
          }));
          await supabase.from('campaign_creators').insert(newCcsToInsert);
        }
      }
    }

    let newlyAssignedCount = 0;

    // 4. Auto-Assign to videos table
    if (updatedVideos && updatedVideos.length > 0) {
      // Deduplicate by content_uid
      const uniqueMap = new Map();
      updatedVideos.forEach(v => {
        if (v.content_uid && !uniqueMap.has(v.content_uid)) {
          uniqueMap.set(v.content_uid, v);
        }
      });
      const uniqueVideos = Array.from(uniqueMap.values());

      if (uniqueVideos.length > 0) {
        const uids = uniqueVideos.map(v => v.content_uid);
        // Check which ones are already in videos table
        const { data: existingVids } = await supabase.from('videos').select('content_uid').in('content_uid', uids);
        const existingUids = new Set(existingVids?.map(v => v.content_uid) || []);

        const missingVideos = uniqueVideos.filter(v => !existingUids.has(v.content_uid));

        if (missingVideos.length > 0) {
          const usernames = Array.from(new Set(missingVideos.map(v => v.creator_username)));
          
          // Get campaign_creators IDs
          const { data: ccs } = await supabase.from('campaign_creators')
            .select('id, creators!inner(username)')
            .eq('campaign_id', campaignId)
            .in('creators.username', usernames);

          const ccMapping: Record<string, number> = {};
          if (ccs) {
            ccs.forEach((cc: any) => {
              ccMapping[cc.creators.username.toLowerCase()] = cc.id;
            });
          }

          const maxUrutanMap: Record<number, number> = {};
          const ccIdsArray = Object.values(ccMapping);
          if (ccIdsArray.length > 0) {
            const { data: existingUrutan } = await supabase.from('videos')
              .select('campaign_creator_id, urutan')
              .in('campaign_creator_id', ccIdsArray);
            
            if (existingUrutan) {
              existingUrutan.forEach((v: any) => {
                const currentMax = maxUrutanMap[v.campaign_creator_id] || 0;
                if (v.urutan > currentMax) {
                  maxUrutanMap[v.campaign_creator_id] = v.urutan;
                }
              });
            }
          }

          const newVideosToInsert: any[] = [];
          for (const missing of missingVideos) {
            const ccId = ccMapping[missing.creator_username?.toLowerCase()];
            if (ccId) {
              const nextUrutan = (maxUrutanMap[ccId] || 0) + 1;
              maxUrutanMap[ccId] = nextUrutan;
              newVideosToInsert.push({
                campaign_creator_id: ccId,
                content_uid: missing.content_uid,
                link_video: `https://www.tiktok.com/@${missing.creator_username}/video/${missing.content_uid}`,
                vt_approval: 'pending',
                urutan: nextUrutan,
                concept: 'Auto-detected from Sync Unmapped'
              });
            }
          }

          if (newVideosToInsert.length > 0) {
            const { error: insertErr } = await supabase.from('videos').insert(newVideosToInsert);
            if (insertErr) {
              console.error("Error auto-assigning videos:", insertErr);
            } else {
              newlyAssignedCount = newVideosToInsert.length;
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Sync complete",
      updatedSalesCount: updatedSales?.length || 0,
      updatedVideosCount: updatedVideos?.length || 0,
      newlyAssignedVideos: newlyAssignedCount
    });

  } catch (error: any) {
    console.error("Sync API Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
