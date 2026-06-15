"use server";

import { createClient } from "@supabase/supabase-js";
import { DatabaseSchema } from "@/types/database";

const supabase = createClient<DatabaseSchema>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function uploadAds(jsonData: any[], kurs: number) {
  try {
    if (!jsonData || jsonData.length === 0) {
      throw new Error("File kosong atau tidak terbaca.");
    }
    if (!kurs || kurs <= 0) {
      throw new Error("Kurs tidak valid.");
    }

    // Filter baris yang benar-benar iklan (punya Ad name)
    const validRows = jsonData.filter((row: any) => row['Ad name'] && row['Ad name'] !== 'Total of all results' && row['Ad name'] !== 'Total' && row['Cost'] !== undefined);
    
    if (validRows.length === 0) {
      throw new Error("Tidak menemukan kolom 'Ad name' dan 'Cost', atau baris data kosong.");
    }

    // Ambil pemetaan Ad name yang sudah ada di database
    const { data: mappings, error: errMap } = await supabase.from('ad_name_mapping').select('*') as { data: any[] | null, error: any };
    if (errMap) throw errMap;
    const adMapping: Record<string, number> = {};
    mappings?.forEach(m => {
      adMapping[m.ad_name] = m.creator_id;
    });

    // Ambil daftar creator untuk automatic matching dari 'Ad name' (misal: "ariantiw_1" -> "ariantiw")
    const { data: creators, error: errCreator } = await supabase.from('creators').select('id, username') as { data: any[] | null, error: any };
    if (errCreator) throw errCreator;
    
    const creatorLookup: Record<string, number> = {};
    creators?.forEach(c => {
      creatorLookup[c.username.toLowerCase().replace('@', '')] = c.id;
    });

    const unmapped: string[] = [];
    const payload: any[] = [];
    
    // Periksa setiap baris
    for (const row of validRows) {
      const adName = row['Ad name'].toString();
      
      let creatorId = adMapping[adName];

      if (!creatorId) {
        // Coba auto-match: pecah string misal "nris9_1" menjadi "nris9"
        const possibleUsername = adName.split('_')[0].toLowerCase();
        if (creatorLookup[possibleUsername]) {
          creatorId = creatorLookup[possibleUsername];
        } else if (creatorLookup[adName.toLowerCase()]) {
          creatorId = creatorLookup[adName.toLowerCase()];
        }
      }

      if (!creatorId) {
        if (!unmapped.includes(adName)) {
          unmapped.push(adName);
        }
      }

      payload.push({
        ad_name: adName,
        creator_id: creatorId || null,
        tanggal: new Date().toISOString(), // Laporan TikTok ads tidak selalu per baris punya tanggal, pakai hari upload.
        cost_usd: parseFloat(row['Cost'] || 0),
        gross_revenue_usd: parseFloat(row['Gross revenue (Shop)'] || 0),
        purchases: parseInt(row['Purchases (Shop)'] || 0),
        kurs: kurs,
      });
    }

    if (unmapped.length > 0) {
      return { 
        success: false, 
        message: `Ada ${unmapped.length} nama Iklan (Ad name) yang tidak ditemukan di database kreator. Silakan petakan terlebih dahulu atau tambah kreator tersebut.`,
        unmapped: unmapped
      };
    }

    // Jika semua ter-mapping, insert ke tabel ads_performance
    // Untuk ads, tidak ada dedup berdasarkan ID spesifik dari laporan itu, kecuali kita bikin hashing baris, 
    // jadi asumsikan upload Ads adalah akumulatif, atau report daily yang baru setiap upload.
    const { error } = await supabase.from('ads_performance').insert(payload as any);
    
    if (error) {
      throw new Error(`Gagal menyimpan data ads: ${error.message}`);
    }

    return { 
      success: true, 
      message: `Data Ads berhasil diproses!\n- Sebanyak ${payload.length} baris telah dimasukkan ke database dengan kurs Rp ${kurs.toLocaleString()}/USD.`
    };

  } catch (err: any) {
    return { success: false, message: err.message || "Terjadi kesalahan yang tidak terduga" };
  }
}
