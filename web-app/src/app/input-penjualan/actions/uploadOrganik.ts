"use server";

import { createClient } from "@supabase/supabase-js";
import { DatabaseSchema } from "@/types/database";

const supabase = createClient<DatabaseSchema>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function uploadOrganik(jsonData: any[]) {
  try {
    if (!jsonData || jsonData.length === 0) {
      throw new Error("File kosong atau tidak terbaca.");
    }

    // Ambil semua username dari creator yang ada di database untuk referensi cepat
    const { data: creators, error: errCreator } = await supabase.from('creators').select('username') as { data: any[] | null, error: any };
    if (errCreator) throw errCreator;
    const existingUsernames = new Set(creators?.map(c => c.username.toLowerCase()) || []);

    const isSalesFormat = jsonData.some((row: any) => row['Order ID']);
    const isAwarenessFormat = jsonData.some((row: any) => row['Video ID'] && row['Affiliate video GMV']);

    if (!isSalesFormat && !isAwarenessFormat) {
      throw new Error("Format file tidak dikenali. Pastikan ini adalah Laporan Pesanan (Sales) atau Laporan Video (Awareness) dari TikTok.");
    }

    let validRows = jsonData;
    // Jika format awareness, baris pertama biasanya "Summary", kita skip baris summary atau baris kosong
    if (isAwarenessFormat) {
      validRows = jsonData.filter((row: any) => row['Date'] !== 'Summary' && row['Video ID'] && row['Video ID'] !== '-');
    } else {
      validRows = jsonData.filter((row: any) => row['Order ID']);
    }

    if (validRows.length === 0) {
      throw new Error("Tidak menemukan baris data transaksi atau data video yang valid.");
    }

    // Ambil daftar SKU untuk memetakan Product ID ke Campaign ID
    const { data: skus, error: errSku } = await supabase.from('skus').select('product_id, campaign_id') as { data: any[] | null, error: any };
    if (errSku) throw errSku;
    
    // Buat kamus (dictionary) Product ID -> Campaign ID
    const skuMapping: Record<string, number> = {};
    skus?.forEach(sku => {
      // product_id bisa saja tersimpan sebagai string atau number, kita amankan menjadi string
      if (sku.product_id) {
        skuMapping[sku.product_id.toString()] = sku.campaign_id;
      }
    });

    let insertedCount = 0;
    let skippedRefundCount = 0;
    let skippedDuplicateCount = 0;
    let skippedUnknownSkuCount = 0;
    const errors: string[] = [];
    
    const payload = [];

    for (const row of validRows) {
      let isRefund = false;
      let rawProductId = '';
      let price = 0;
      let quantity = 0;
      let gmv = 0;
      let creatorUsername = '';
      let contentUid = '';
      let tanggal = '';
      let contentType = 'Video';
      let orderId = '';
      let orderStatus = '';

      let followers = 0;

      if (isSalesFormat) {
        const isRefundStr = row['Fully returned or refunded'] || 'No';
        isRefund = isRefundStr.trim().toLowerCase() === 'yes';
        if (isRefund) {
          skippedRefundCount++;
          continue; 
        }

        rawProductId = row['Product ID']?.toString() || '';
        price = Math.round(parseFloat(row['Price'] || 0));
        quantity = parseInt(row['Quantity'] || 0);
        gmv = Math.round(price * quantity);
        const rawUsername = row['Creator Username'] || '';
        creatorUsername = rawUsername.replace('@', '').toLowerCase();
        contentUid = row['Content ID']?.toString() || '';
        tanggal = row['Time Created'] ? new Date(row['Time Created']).toISOString() : new Date().toISOString();
        contentType = row['Content Type'] || 'Video';
        orderId = row['Order ID']?.toString() || '';
        orderStatus = row['Order settlement status'] || '';
      } else {
        // Awareness Format
        rawProductId = row['Product ID']?.toString() || '';
        const gmvStr = row['Affiliate video GMV']?.toString() || '0';
        // Membersihkan string "Rp1.057.666" menjadi angka 1057666
        gmv = Math.round(parseFloat(gmvStr.replace(/[^0-9]/g, '')) || 0); 
        quantity = parseInt(row['Items sold'] || row['Video orders'] || 0);
        price = quantity > 0 ? Math.round(gmv / quantity) : 0;
        const rawUsername = row['Creator name'] || '';
        creatorUsername = rawUsername.replace('@', '').toLowerCase();
        contentUid = row['Video ID']?.toString() || '';
        tanggal = row['Post time'] ? new Date(row['Post time']).toISOString() : new Date().toISOString();
        contentType = 'Video';
        orderId = `video_${contentUid}_${rawProductId}`; // ID Sintetis agar bisa diupsert tanpa konflik dengan video lain
        orderStatus = 'Completed'; 
        const followersStr = row['Creator followers']?.toString() || '0';
        followers = parseInt(followersStr.replace(/[^0-9]/g, '')) || 0;
      }

      const campaignId = skuMapping[rawProductId];

      // Jika Product ID tidak ada di tabel SKU kita, lewati baris ini
      if (!campaignId) {
        skippedUnknownSkuCount++;
        continue;
      }

      payload.push({
        campaign_id: campaignId,
        creator_username: creatorUsername,
        content_uid: contentUid || null,
        product_id: rawProductId || null,
        tanggal: tanggal,
        price: price,
        quantity: quantity,
        gmv: gmv,
        is_refund: isRefund,
        content_type: contentType,
        order_id: orderId || null,
        order_status: orderStatus || null,
        raw_data: row,
        followers: followers
      });
    }

    if (payload.length === 0) {
      return { 
        success: false, 
        message: `Tidak ada data yang diproses. Ada ${skippedUnknownSkuCount} baris yang dilewati karena 'Product ID' belum didaftarkan di menu SKU Campaign.`
      };
    }

    // Bulk upsert ke tabel sales menggunakan Supabase
    const chunkSize = 1000;
    for (let i = 0; i < payload.length; i += chunkSize) {
      const chunk = payload.slice(i, i + chunkSize);
      
      // Clean up payload before inserting to sales to avoid schema errors
      const salesChunk = chunk.map(({ followers, ...rest }) => rest);
      
      const { data, error } = await supabase.from('sales').upsert(salesChunk as any, { onConflict: 'order_id' }).select();
      if (error) {
        errors.push(`Gagal memproses batch: ${error.message}`);
      } else {
        insertedCount += (data?.length || 0);
        skippedDuplicateCount += (chunk.length - (data?.length || 0));
      }
    }

    // AUTO REGISTER CREATORS & CAMPAIGN CREATORS
    try {
      const uniqueUsernames = Array.from(new Set(payload.map(p => p.creator_username).filter(Boolean)));
      if (uniqueUsernames.length > 0) {
        // Find existing creators
        const { data: existingCreators } = await supabase.from('creators').select('id, username').in('username', uniqueUsernames) as { data: { id: number, username: string }[] | null };
        const existingUsernameMap = new Map((existingCreators || []).map(c => [c.username, c.id]));
        
        // Find missing creators
        const missingUsernames = uniqueUsernames.filter(u => !existingUsernameMap.has(u));
        if (missingUsernames.length > 0) {
          const newCreatorsToInsert = missingUsernames.map(u => ({ username: u }));
          const { data: insertedCreators } = await supabase.from('creators').insert(newCreatorsToInsert as any).select('id, username') as { data: { id: number, username: string }[] | null };
          if (insertedCreators) {
            insertedCreators.forEach(c => existingUsernameMap.set(c.username, c.id));
          }
        }

        
        // Now auto-join campaign
        const pairsToJoin = new Set<string>();
        payload.forEach(p => {
          const cid = p.campaign_id;
          const creatorId = existingUsernameMap.get(p.creator_username);
          if (cid && creatorId) {
            pairsToJoin.add(`${cid}_${creatorId}`);
          }
        });
        
        if (pairsToJoin.size > 0) {
          const cids = Array.from(new Set(payload.map(p => p.campaign_id).filter(Boolean)));
          const creatorIds = Array.from(existingUsernameMap.values());
          const { data: existingCC } = await supabase.from('campaign_creators').select('campaign_id, creator_id').in('campaign_id', cids).in('creator_id', creatorIds);
          const existingPairs = new Set(((existingCC as any[]) || []).map(cc => `${cc.campaign_id}_${cc.creator_id}`));
          
          const newCCToInsert: any[] = [];
          for (const pair of pairsToJoin) {
            if (!existingPairs.has(pair)) {
              const [campaign_id, creator_id] = pair.split('_').map(Number);
              newCCToInsert.push({
                campaign_id,
                creator_id,
                tier: 'Auto-Detect',
                price: 0,
                qty_vt: 1,
                approval: 'pending',
                status_bayar: 'belum',
                client_approval: 'not_required'
              });
            }
          }
          if (newCCToInsert.length > 0) {
             await supabase.from('campaign_creators').insert(newCCToInsert as any);
          }
        }
      }
    } catch (autoErr) {
      console.error("Gagal auto-register creator:", autoErr);
    }

    // AUTO POPULATE VIDEOS TABLE
    try {
      // 1. Get all unique content_uids from the payload
      const uniqueVideos = Array.from(new Set(payload.map(p => p.content_uid).filter(Boolean)));
      
      if (uniqueVideos.length > 0) {
        // 2. Fetch all existing videos to prevent duplicates
        const { data: existingVideos } = await supabase.from('videos').select('content_uid').in('content_uid', uniqueVideos);
        const existingUids = new Set(((existingVideos as any[]) || []).map(v => v.content_uid));
        
        // 3. Find missing videos
        const missingVideos = payload.filter(p => p.content_uid && !existingUids.has(p.content_uid));
        
        if (missingVideos.length > 0) {
          // 4. We need campaign_creator_id for the videos. Fetch campaign_creators.
          // First, get the creator IDs for the usernames
          const usernames = Array.from(new Set(missingVideos.map(m => m.creator_username)));
          const { data: creatorsData } = await supabase.from('creators').select('id, username').in('username', usernames);
          
          if (creatorsData && (creatorsData as any[]).length > 0) {
            const creatorUsernameToId: Record<string, number> = {};
            (creatorsData as any[]).forEach(c => { creatorUsernameToId[c.username] = c.id; });
            
            const creatorIds = Object.values(creatorUsernameToId);
            // Fetch campaign creators
            const { data: ccData } = await supabase.from('campaign_creators').select('id, campaign_id, creator_id').in('creator_id', creatorIds);
            const typedCcData = (ccData as any[]) || [];
            
            // Get current max urutan for each campaign_creator_id
            const ccIds = typedCcData.map(cc => cc.id);
            const { data: existingVidsData } = await supabase.from('videos').select('campaign_creator_id, urutan').in('campaign_creator_id', ccIds);
            const currentUrutanMap: Record<number, number> = {};
            if (existingVidsData) {
                (existingVidsData as any[]).forEach(v => {
                    const cid = v.campaign_creator_id;
                    const u = v.urutan || 0;
                    if (!currentUrutanMap[cid] || u > currentUrutanMap[cid]) {
                        currentUrutanMap[cid] = u;
                    }
                });
            }

            const newVideosToInsert = [];
            const processedUids = new Set();

            for (const item of missingVideos) {
              if (processedUids.has(item.content_uid)) continue;
              
              const creatorId = creatorUsernameToId[item.creator_username];
              if (!creatorId) continue;
              
              // Find the campaign_creator for this campaign and creator
              const cc = typedCcData.find(c => c.campaign_id === item.campaign_id && c.creator_id === creatorId);
              if (cc) {
                let nextUrutan = (currentUrutanMap[cc.id] || 0) + 1;
                currentUrutanMap[cc.id] = nextUrutan;

                newVideosToInsert.push({
                  campaign_creator_id: cc.id,
                  content_uid: item.content_uid,
                  link_video: `https://www.tiktok.com/@${item.creator_username}/video/${item.content_uid}`,
                  urutan: nextUrutan,
                  vt_approval: 'pending'
                });
                processedUids.add(item.content_uid);
              }
            }
            
            if (newVideosToInsert.length > 0) {
              await supabase.from('videos').insert(newVideosToInsert as any);
            }
          }
        }
      }
    } catch (videoErr) {
      console.error("Gagal auto-populate video:", videoErr);
      // We don't fail the whole request just because video population failed
    }

    if (errors.length > 0) {
      return { success: false, message: `Berhasil dengan error sebagian:\n` + errors.join('\n') };
    }

    return { 
      success: true, 
      message: `Data organik berhasil diproses!\n- Baris dimasukkan: ${insertedCount}\n- Baris refund (dilewati): ${skippedRefundCount}\n- Baris duplikat (dilewati): ${skippedDuplicateCount}\n- Baris beda Campaign/SKU tidak terdaftar (dilewati): ${skippedUnknownSkuCount}` 
    };

  } catch (err: any) {
    return { success: false, message: err.message || "Terjadi kesalahan yang tidak terduga" };
  }
}
