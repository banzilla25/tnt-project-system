"use server";

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// ==========================================
// READ ACTIONS
// ==========================================

export async function getPaymentBatches(campaignId?: number, status?: string) {
  const supabase = await createClient();
  
  let rpcArgs: any = {};
  if (campaignId) rpcArgs.p_campaign_id = campaignId;
  if (status) rpcArgs.p_status_in = [status];

  const { data, error } = await supabase.rpc('rpc_get_payment_batches', rpcArgs);

  if (error) throw new Error(error.message);
  return data || [];
}

export async function fetchPendingAdsTopUp() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('payment_items')
    .select(`
      *,
      payment_batches!inner(batch_label, status, campaigns!inner(nama))
    `)
    .eq('payment_type', 'ads')
    .not('final_status', 'in', '("paid","rejected","cancelled")')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function fetchCampaignCreatorMutations(campaignId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('payment_items')
    .select(`
      *,
      payment_batches!inner(campaign_id, batch_label, paid_at),
      campaign_creators(creators(username, nama_asli)),
      creator_bank_accounts(bank_name)
    `)
    .eq('payment_batches.campaign_id', campaignId)
    .eq('final_status', 'paid')
    .neq('payment_type', 'ads')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function fetchUnpaidCreators(campaignId: number) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('campaign_creators')
      .select(`
        id, price, tier, qty_vt, qty_live, content_type, approval,
        creator_id,
        creators ( 
          id,
          username, 
          nama_asli,
          avatar_url,
          creator_snapshots ( id, followers, level, gmv_30d, gmv_30d_video, gmv_30d_live, ratecard, tanggal_update ),
          creator_bank_accounts ( id, bank_name, account_number, account_holder )
        ),
        videos ( id, link_video, content_uid, urutan, vt_approval ),
        payment_items ( id, final_status, payment_type, nominal )
      `)
      .eq('campaign_id', campaignId)
      .eq('approval', 'approved')
      .order('created_at', { ascending: false })
      .range(0, 4999);

    if (error) {
      console.error("Supabase Error in fetchUnpaidCreators:", error);
      throw new Error(error.message);
    }
    
    // Cross-check if creators have recorded live activity in sales or organic_videos
    const [salesLiveRes, organicLiveRes] = await Promise.all([
      supabase.from('sales')
        .select('creator_username')
        .eq('campaign_id', campaignId)
        .or('content_type.ilike.%live%,content_type.ilike.%livestream%'),
      supabase.from('organic_videos')
        .select('creator_username')
        .eq('campaign_id', campaignId)
        .or('content_type.ilike.%live%,content_type.ilike.%livestream%')
    ]);

    const liveUsernames = new Set<string>();
    salesLiveRes.data?.forEach(r => r.creator_username && liveUsernames.add(r.creator_username.toLowerCase().replace(/^@/, '').trim()));
    organicLiveRes.data?.forEach(r => r.creator_username && liveUsernames.add(r.creator_username.toLowerCase().replace(/^@/, '').trim()));

    const enriched = (data || []).map(cc => {
      const u = (cc.creators?.username || '').toLowerCase().replace(/^@/, '').trim();
      return {
        ...cc,
        has_live_activity: liveUsernames.has(u)
      };
    });

    return enriched;
  } catch (err: any) {
    console.error("Exception in fetchUnpaidCreators:", err);
    throw err;
  }
}

export async function fetchApprovedCreatorsForBatch(campaignId: number) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('campaign_creators')
      .select(`
        id, campaign_id, creator_id, tier, price, qty_vt, content_type, approval, status_bayar, created_at,
        creators (
          id,
          username,
          nama_asli,
          avatar_url,
          nik,
          alamat_ktp,
          link_ktp,
          link_kontrak,
          nama_wa_pic,
          nomor_wa_dealing,
          creator_bank_accounts ( id, bank_name, account_number, account_holder, is_primary )
        )
      `)
      .eq('campaign_id', campaignId)
      .range(0, 4999);

    if (error) {
      console.warn("Supabase Warning in fetchApprovedCreatorsForBatch, using fallback:", error.message);
      const { data: fallbackData, error: fallbackError } = await supabase.from('campaign_creators')
        .select(`
          id, campaign_id, creator_id, tier, price, qty_vt, content_type, approval, status_bayar, created_at,
          creators (
            id,
            username,
            nama_asli,
            creator_bank_accounts ( id, bank_name, account_number, account_holder, is_primary )
          )
        `)
        .eq('campaign_id', campaignId)
        .range(0, 4999);
      if (fallbackError) throw fallbackError;
      return fallbackData || [];
    }
    
    return data || [];
  } catch (err: any) {
    console.error("Exception in fetchApprovedCreatorsForBatch:", err);
    throw err;
  }
}

export async function fetchMutationsPaginated(page: number, limit: number, month: string, search: string, paymentType: string = 'all') {
  const supabase = await createClient();
  let query = supabase.from('vw_payment_mutations').select('*', { count: 'exact' });

  if (month !== 'all') {
    query = query.eq('paid_month', month);
  }

  if (paymentType === 'ads') {
    query = query.eq('payment_type', 'ads');
  } else if (paymentType === 'kreator') {
    query = query.neq('payment_type', 'ads');
  }

  if (search) {
    query = query.or(`nama_penerima.ilike.%${search}%,username.ilike.%${search}%,campaign_nama.ilike.%${search}%`);
  }

  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1).order('paid_at', { ascending: false });

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return { data, count: count || 0 };
}

export async function fetchMutationsExport(month: string, search: string, paymentType: string = 'all') {
  const supabase = await createClient();
  let query = supabase.from('vw_payment_mutations').select('*');

  if (month !== 'all') {
    query = query.eq('paid_month', month);
  }

  if (paymentType === 'ads') {
    query = query.eq('payment_type', 'ads');
  } else if (paymentType === 'kreator') {
    query = query.neq('payment_type', 'ads');
  }

  if (search) {
    query = query.or(`nama_penerima.ilike.%${search}%,username.ilike.%${search}%,campaign_nama.ilike.%${search}%`);
  }

  // Set a high limit for export just in case
  query = query.limit(5000).order('paid_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return data;
}

export async function getPaymentBatchDetail(batchId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('payment_batches').select(`
    *,
    submitter:profiles!submitted_by(nama, role),
    manager:profiles!manager_reviewed_by(nama, role),
    finance:profiles!finance_reviewed_by(nama, role),
    executive:profiles!executive_reviewed_by(nama, role),
    payer:profiles!paid_by(nama, role),
    campaigns(nama),
    payment_items(
      *,
      campaign_creators(
        id, tier, price, qty_vt, creators(id, username, nama_asli), profiles:profiles!added_by(nama, role)
      ),
      creator_bank_accounts(bank_name, account_number, account_holder)
    )
  `).eq('id', batchId).maybeSingle();

  if (error) {
    console.error("Error getPaymentBatchDetail:", error);
    return null; // Return null gracefully instead of throwing
  }
  if (!data) return null;

  if (data?.executive_reviewed_1_by) {
    const { data: exec1 } = await supabase.from('profiles').select('nama, role').eq('id', data.executive_reviewed_1_by).single();
    if (exec1) {
      data.executive1 = exec1;
    }
  }

  return data;
}

export async function getCreatorBankAccounts(creatorId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('creator_bank_accounts')
    .select('*')
    .eq('creator_id', creatorId);
  if (error) throw new Error(error.message);
  return data;
}



export async function getSenderAccounts() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('sender_accounts').select('*');
  if (error) throw new Error(error.message);
  return data;
}

// ==========================================
// PIC ACTIONS
// ==========================================

export async function createPaymentBatch(campaignId: number, batchLabel: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not authenticated');

  const { data, error } = await supabase.from('payment_batches').insert({
    campaign_id: campaignId,
    batch_label: batchLabel,
    status: 'draft',
    submitted_by: userData.user.id,
    submitted_at: new Date().toISOString()
  }).select('id').single();

  if (error) throw new Error(error.message);
  revalidatePath(`/campaigns/${campaignId}/keuangan`);
  return data.id;
}

export async function addPaymentItem(batchId: number, itemData: any) {
  const supabase = await createClient();
  
  // Jika rekening diketik manual, kita harus cek/insert ke creator_bank_accounts
  let bankAccountId = itemData.bank_account_id ? Number(itemData.bank_account_id) : null;
  let bankName = itemData.metode_pembayaran ? String(itemData.metode_pembayaran).trim() : null;
  let bankNumber = itemData.nomor_rekening ? String(itemData.nomor_rekening).trim() : null;
  let bankHolder = itemData.nama_penerima ? String(itemData.nama_penerima).trim() : null;
  
  if (bankAccountId) {
    // Kunci data bank ke payment_items agar history mutasi statis & akurat
    const { data: bankData } = await supabase.from('creator_bank_accounts').select('*').eq('id', bankAccountId).maybeSingle();
    if (bankData) {
      bankName = bankData.bank_name;
      bankNumber = bankData.account_number;
      bankHolder = bankData.account_holder;
    }
  } else if (bankName && bankNumber && itemData.campaign_creator_id) {
    // Get creator_id from campaign_creators
    const { data: ccData } = await supabase.from('campaign_creators').select('creator_id').eq('id', itemData.campaign_creator_id).maybeSingle();
    
    if (ccData && ccData.creator_id) {
      // First check if this bank account already exists
      const { data: existingBank } = await supabase
        .from('creator_bank_accounts')
        .select('id, bank_name, account_number, account_holder')
        .eq('creator_id', ccData.creator_id)
        .ilike('bank_name', bankName)
        .eq('account_number', bankNumber)
        .maybeSingle();

      if (existingBank) {
        bankAccountId = existingBank.id;
        bankName = existingBank.bank_name;
        bankNumber = existingBank.account_number;
        bankHolder = existingBank.account_holder || bankHolder;
      } else {
        try {
          const { data: newBank } = await supabase.from('creator_bank_accounts').insert({
            creator_id: ccData.creator_id,
            bank_name: bankName,
            account_number: bankNumber,
            account_holder: bankHolder || '',
          }).select('id').maybeSingle();
          
          if (newBank) bankAccountId = newBank.id;
        } catch (e) {
          console.warn('Could not insert creator_bank_account:', e);
        }
      }
    }
  }

  const payload: any = {
    batch_id: Number(batchId),
    campaign_creator_id: itemData.campaign_creator_id ? Number(itemData.campaign_creator_id) : null,
    payment_type: itemData.payment_type || '100_akhir',
    ratecard_awal: itemData.ratecard_awal ? Number(itemData.ratecard_awal) : null,
    nominal: Number(itemData.nominal) || 0,
    biaya_transfer: Number(itemData.biaya_transfer) || 0,
    bank_account_id: bankAccountId,
    metode_pembayaran: bankName,
    nomor_rekening: bankNumber,
    nama_penerima: bankHolder,
    nama_wa_pic: itemData.nama_wa_pic || null,
    nomor_wa_dealing: itemData.nomor_wa_dealing || null,
    alamat_ktp: itemData.alamat_ktp || null,
    nik: itemData.nik || null,
    link_ktp: itemData.link_ktp || null,
    link_kontrak: itemData.link_kontrak || null,
    notes: itemData.notes_dari_pic || null,
    manager_status: 'pending',
    executive_status: 'pending',
    final_status: 'pending',
    transaction_id: `${itemData.payment_type === 'ads' ? 'ADS' : (itemData.payment_type === 'ops' ? 'OPS' : 'RC')}-${new Date().toISOString().slice(2,7).replace('-','')}-${Math.floor(1000 + Math.random() * 9000)}`
  };

  const { error } = await supabase.from('payment_items').insert(payload);
  if (error) {
    console.error('Error inserting payment_items:', error);
    throw new Error(error.message);
  }

  // Update creator master admin data if this is a creator payment
  if (itemData.campaign_creator_id) {
    try {
      const { data: cc } = await supabase.from('campaign_creators').select('creator_id').eq('id', itemData.campaign_creator_id).maybeSingle();
      if (cc && cc.creator_id) {
        const updateCreatorData: Record<string, any> = {};
        if (itemData.nik) updateCreatorData.nik = itemData.nik;
        if (itemData.link_ktp) updateCreatorData.link_ktp = itemData.link_ktp;
        if (itemData.link_kontrak) updateCreatorData.link_kontrak = itemData.link_kontrak;
        if (itemData.nama_wa_pic) updateCreatorData.nama_wa_pic = itemData.nama_wa_pic;
        if (itemData.nomor_wa_dealing) updateCreatorData.nomor_wa_dealing = itemData.nomor_wa_dealing;
        if (itemData.alamat_ktp) updateCreatorData.alamat_ktp = itemData.alamat_ktp;

        if (Object.keys(updateCreatorData).length > 0) {
          const { error: updCreatorErr } = await supabase.from('creators').update(updateCreatorData).eq('id', cc.creator_id);
          if (updCreatorErr) {
            console.warn('Could not update creators admin metadata:', updCreatorErr.message);
          }
        }
      }
    } catch (e) {
      console.warn('Silent fallback for creator metadata update:', e);
    }
  }
}

export async function updatePaymentItem(itemId: number, itemData: any) {
  const supabase = await createClient();
  
  // Ambil data item awal untuk mendapatkan campaign_creator_id
  const { data: item } = await supabase.from('payment_items').select('campaign_creator_id, batch_id').eq('id', itemId).maybeSingle();
  
  // Jika bank diubah manual
  let bankAccountId = itemData.bank_account_id ? Number(itemData.bank_account_id) : null;
  let bankName = itemData.metode_pembayaran ? String(itemData.metode_pembayaran).trim() : null;
  let bankNumber = itemData.nomor_rekening ? String(itemData.nomor_rekening).trim() : null;
  let bankHolder = itemData.nama_penerima ? String(itemData.nama_penerima).trim() : null;

  if (item?.campaign_creator_id && bankName && bankNumber && !bankAccountId) {
    const { data: ccData } = await supabase.from('campaign_creators').select('creator_id').eq('id', item.campaign_creator_id).maybeSingle();
    if (ccData?.creator_id) {
      const { data: existingBank } = await supabase
        .from('creator_bank_accounts')
        .select('id')
        .eq('creator_id', ccData.creator_id)
        .ilike('bank_name', bankName)
        .eq('account_number', bankNumber)
        .maybeSingle();

      if (existingBank) {
        bankAccountId = existingBank.id;
      } else {
        try {
          const { data: newBank } = await supabase.from('creator_bank_accounts').insert({
            creator_id: ccData.creator_id,
            bank_name: bankName,
            account_number: bankNumber,
            account_holder: bankHolder || '',
          }).select('id').maybeSingle();
          if (newBank) bankAccountId = newBank.id;
        } catch (e) {
          console.warn('Could not insert new bank on update:', e);
        }
      }
    }
  }

  const payload: any = { ...itemData };
  if (bankAccountId) payload.bank_account_id = bankAccountId;
  if (payload.nominal !== undefined) payload.nominal = Number(payload.nominal);
  if (payload.biaya_transfer !== undefined) payload.biaya_transfer = Number(payload.biaya_transfer);

  const { error } = await supabase.from('payment_items').update(payload).eq('id', itemId);
  if (error) throw new Error(error.message);

  // Update creator master admin data if this is a creator payment
  if (item?.campaign_creator_id) {
    try {
      const { data: cc } = await supabase.from('campaign_creators').select('creator_id').eq('id', item.campaign_creator_id).maybeSingle();
      if (cc && cc.creator_id) {
        const updateCreatorData: Record<string, any> = {};
        if (itemData.nik !== undefined) updateCreatorData.nik = itemData.nik || null;
        if (itemData.link_ktp !== undefined) updateCreatorData.link_ktp = itemData.link_ktp || null;
        if (itemData.link_kontrak !== undefined) updateCreatorData.link_kontrak = itemData.link_kontrak || null;
        if (itemData.nama_wa_pic !== undefined) updateCreatorData.nama_wa_pic = itemData.nama_wa_pic || null;
        if (itemData.nomor_wa_dealing !== undefined) updateCreatorData.nomor_wa_dealing = itemData.nomor_wa_dealing || null;
        if (itemData.alamat_ktp !== undefined) updateCreatorData.alamat_ktp = itemData.alamat_ktp || null;

        if (Object.keys(updateCreatorData).length > 0) {
          await supabase.from('creators').update(updateCreatorData).eq('id', cc.creator_id);
        }
      }
    } catch (e) {
      console.warn('Silent fallback for creator metadata update on updatePaymentItem:', e);
    }
  }
}

export async function deletePaymentItem(itemId: number) {
  const supabase = await createClient();
  const { error } = await supabase.from('payment_items').delete().eq('id', itemId);
  if (error) throw new Error(error.message);
}

export async function deletePaymentBatch(batchId: number) {
  const supabase = await createClient();
  // hapus items dulu (kalau db belum cascade)
  await supabase.from('payment_items').delete().eq('batch_id', batchId);
  const { error } = await supabase.from('payment_batches').delete().eq('id', batchId);
  if (error) throw new Error(error.message);
}

export async function submitBatchToManager(batchId: number) {
  const supabase = await createClient();
  const { error } = await supabase.from('payment_batches').update({
    status: 'pending_manager',
    submitted_at: new Date().toISOString()
  }).eq('id', batchId);
  if (error) throw new Error(error.message);
  revalidatePath('/budgeting');
}

export async function revertBatchStatus(batchId: number) {
  const supabase = await createClient();
  const { data: batch, error: getErr } = await supabase.from('payment_batches').select('status').eq('id', batchId).single();
  if (getErr) throw new Error(getErr.message);

  let newStatus = '';
  if (batch.status === 'ready_to_pay') newStatus = 'pending_executive';
  else if (batch.status === 'pending_executive') newStatus = 'pending_finance';
  else if (batch.status === 'pending_finance') newStatus = 'pending_executive_1';
  else if (batch.status === 'pending_executive_1') newStatus = 'pending_manager';
  else throw new Error('Status tidak dapat dikembalikan lagi');

  const { error } = await supabase.from('payment_batches').update({ status: newStatus }).eq('id', batchId);
  if (error) throw new Error(error.message);
  revalidatePath('/budgeting');
}

// ==========================================
// MIGRATION ACTIONS
// ==========================================

export async function resolveCreatorForMigration(username: string, campaignId: number, uploaderId: number, rowData: any) {
  const supabase = await createClient();
  let creatorId;
  let campaignCreatorId;
  let picId = uploaderId;

  // Resolve PIC if provided in Excel
  if (rowData.pic_name) {
    const cleanPicName = rowData.pic_name.trim();
    const { data: picData } = await supabase.from('profiles').select('id').ilike('nama', `%${cleanPicName}%`).limit(1);
    if (picData && picData.length > 0) {
      picId = picData[0].id;
    }
  }

  // 1. Check if creator exists in creators table
  let cleanUsername = username.replace('@', '').trim();
  const { data: existingCreator } = await supabase.from('creators').select('id').ilike('username', cleanUsername).single();
  
  if (existingCreator) {
    creatorId = existingCreator.id;
  } else {
    // Insert new creator
    const { data: newCreator, error: errC } = await supabase.from('creators').insert({
      username: cleanUsername,
      nama_asli: rowData.nama_penerima || cleanUsername,
      status: 'active'
    }).select('id').single();
    if (errC) throw new Error("Gagal membuat kreator baru: " + errC.message);
    creatorId = newCreator.id;
  }

  // 2. Check if linked to campaign
  const { data: ccData } = await supabase.from('campaign_creators').select('id').eq('campaign_id', campaignId).eq('creator_id', creatorId).single();
  if (ccData) {
    campaignCreatorId = ccData.id;
  } else {
    // Link to campaign
    const { data: newCc, error: errCc } = await supabase.from('campaign_creators').insert({
      campaign_id: campaignId,
      creator_id: creatorId,
      added_by: picId,
      approval: 'approved',
      tier: 'Nano',
      price: rowData.ratecard_awal || rowData.nominal || 0,
      nomor_wa_dealing: rowData.nomor_wa_dealing || null,
      nama_wa: rowData.nama_wa_pic || null,
      alamat_ktp: rowData.alamat_ktp || null,
      nik: rowData.nik || null,
      link_ktp: rowData.link_ktp || null,
      link_kontrak: rowData.link_kontrak || null,
      notes: "Di-import otomatis via Migrasi"
    }).select('id').single();
    if (errCc) throw new Error("Gagal mendaftarkan kreator ke campaign: " + errCc.message);
    campaignCreatorId = newCc.id;
  }

  return campaignCreatorId;
}

export async function importHistoricalBatch(campaignId: number, batchLabel: string, items: any[]) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  if (!userId) throw new Error('Not authenticated');

  const { data: profile } = await supabase.from('profiles').select('id').eq('id', userId).single();
  const profileId = profile?.id;

  const batchDate = items.length > 0 && items[0].tanggal_pengajuan ? new Date(items[0].tanggal_pengajuan).toISOString() : new Date().toISOString();
  const actualDate = items.length > 0 && items[0].tanggal_aktual ? new Date(items[0].tanggal_aktual).toISOString() : new Date().toISOString();

  const { data: batch, error: batchErr } = await supabase.from('payment_batches').insert({
    campaign_id: campaignId,
    batch_label: batchLabel,
    status: 'paid',
    submitted_by: profileId,
    manager_reviewed_by: profileId,
    executive_reviewed_1_by: profileId,
    finance_reviewed_by: profileId,
    executive_reviewed_by: profileId,
    paid_by: profileId,
    submitted_at: batchDate,
    manager_reviewed_at: batchDate,
    executive_reviewed_1_at: batchDate,
    finance_reviewed_at: batchDate,
    executive_reviewed_at: batchDate,
    paid_at: actualDate,
  }).select('id').single();

  if (batchErr) throw new Error("Gagal membuat batch migrasi: " + batchErr.message);

  const payload = items.map(item => ({
    batch_id: batch.id,
    campaign_creator_id: item.campaign_creator_id,
    payment_type: item.payment_type,
    ratecard_awal: item.ratecard_awal || null,
    nominal: item.nominal,
    biaya_transfer: item.biaya_transfer || 0,
    metode_pembayaran: item.metode_pembayaran,
    nomor_rekening: item.nomor_rekening,
    nama_penerima: item.nama_penerima,
    notes: item.notes || null,
    manager_status: 'approved',
    executive_1_status: 'approved',
    finance_selected: true,
    executive_status: 'approved',
    final_status: 'paid',
    created_at: item.tanggal_pengajuan || batchDate,
    actual_payment_date: item.tanggal_aktual || actualDate,
    bukti_transfer_url: item.bukti_transfer_url || null,
    sender_account_id: 1
  }));

  const { error: itemsErr } = await supabase.from('payment_items').insert(payload);
  if (itemsErr) {
    await supabase.from('payment_batches').delete().eq('id', batch.id);
    throw new Error("Gagal menyimpan item: " + itemsErr.message);
  }

  revalidatePath(`/campaigns/${campaignId}/keuangan`);
  return batch.id;
}

// ==========================================
// MANAGER ACTIONS
// ==========================================

export async function managerApproveItem(itemId: number) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  const { error } = await supabase.from('payment_items').update({
    manager_status: 'approved',
    final_status: 'manager_approved',
    manager_acted_by: user?.user?.id,
    manager_acted_at: new Date().toISOString()
  }).eq('id', itemId);
  if (error) throw new Error(error.message);
}

export async function managerRejectItem(itemId: number, reason: string) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  const { error } = await supabase.from('payment_items').update({
    manager_status: 'rejected',
    final_status: 'rejected',
    manager_note: reason,
    manager_acted_by: user?.user?.id,
    manager_acted_at: new Date().toISOString()
  }).eq('id', itemId);
  if (error) throw new Error(error.message);
}

export async function managerFinalizeReview(batchId: number) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();

  const { data: items } = await supabase.from('payment_items').select('id, final_status').eq('batch_id', batchId);
  const pendingItems = items?.filter(i => i.final_status === 'pending') || [];
  if (pendingItems.length > 0) {
    throw new Error(`Masih ada ${pendingItems.length} tagihan yang belum direview (berstatus pending). Harap setujui atau tolak semua tagihan terlebih dahulu sebelum melakukan Finalize.`);
  }

  const { error } = await supabase.from('payment_batches').update({
    status: 'pending_executive_1',
    manager_reviewed_by: user?.user?.id,
    manager_reviewed_at: new Date().toISOString()
  }).eq('id', batchId);
  if (error) throw new Error(error.message);
  revalidatePath('/budgeting');
}

// ==========================================
// EXECUTIVE REVIEW 1 ACTIONS
// ==========================================

export async function executiveApproveItem1(itemId: number) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  const { error } = await supabase.from('payment_items').update({
    executive_1_status: 'approved',
    final_status: 'executive_1_approved',
    executive_1_acted_by: user?.user?.id,
    executive_1_acted_at: new Date().toISOString()
  }).eq('id', itemId);
  if (error) throw new Error(error.message);
}

export async function executiveRejectItem1(itemId: number, reason: string) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  const { error } = await supabase.from('payment_items').update({
    executive_1_status: 'rejected',
    final_status: 'rejected',
    executive_1_note: reason,
    executive_1_acted_by: user?.user?.id,
    executive_1_acted_at: new Date().toISOString()
  }).eq('id', itemId);
  if (error) throw new Error(error.message);
}

export async function executiveFinalizeReview1(batchId: number) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();

  const { data: items } = await supabase.from('payment_items').select('id, final_status').eq('batch_id', batchId);
  const unreviewed = items?.filter(i => ['pending', 'manager_approved'].includes(i.final_status)) || [];
  if (unreviewed.length > 0) {
    throw new Error(`Masih ada ${unreviewed.length} tagihan yang belum selesai direview. Harap setujui atau tolak semua tagihan terlebih dahulu sebelum submit ke Finance.`);
  }

  const { error } = await supabase.from('payment_batches').update({
    status: 'pending_finance',
    executive_reviewed_1_by: user?.user?.id,
    executive_reviewed_1_at: new Date().toISOString()
  }).eq('id', batchId);
  if (error) throw new Error(error.message);
  revalidatePath('/budgeting');
}

// ==========================================
// FINANCE ACTIONS
// ==========================================

export async function financeToggleItem(itemId: number, selected: boolean) {
  const supabase = await createClient();
  const finalStatus = selected ? 'finance_selected' : 'executive_1_approved';
  const { error } = await supabase.from('payment_items').update({
    finance_selected: selected,
    final_status: finalStatus
  }).eq('id', itemId);
  if (error) throw new Error(error.message);
}

export async function financeSubmitToExecutive(batchId: number) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  const { error } = await supabase.from('payment_batches').update({
    status: 'pending_executive',
    finance_reviewed_by: user?.user?.id,
    finance_reviewed_at: new Date().toISOString()
  }).eq('id', batchId);
  if (error) throw new Error(error.message);
  revalidatePath('/budgeting');
}

/**
 * Auto-Split / Rollover Batch:
 * Jika sebagian item dalam batch dibayar dan ada item yang belum dibayar (misal pending_finance_outstanding, dll),
 * item-item yang belum dibayar tersebut otomatis dipindahkan ke batch baru bertajuk:
 * "[Nama Batch Asli] - Termin 2" (atau Termin 3, dst).
 * Batch baru berstatus 'pending_finance' sehingga tetap aktif di antrean Finance Review.
 */
export async function autoSplitUnpaidBatchItems(supabase: any, batchId: number, user: any) {
  // 1. Ambil data batch asli
  const { data: batch, error: bErr } = await supabase.from('payment_batches').select('*').eq('id', batchId).single();
  if (bErr || !batch) return;

  // 2. Ambil semua item di batch ini yang BELUM lunas, ditolak, atau dibatalkan
  const { data: unpaidItems, error: itemsErr } = await supabase.from('payment_items')
    .select('id, final_status')
    .eq('batch_id', batchId)
    .not('final_status', 'in', '("paid","rejected","cancelled")');

  if (itemsErr || !unpaidItems || unpaidItems.length === 0) {
    return; // Semua item sudah beres, tidak perlu split
  }

  // 3. Tentukan nama batch baru dengan penomoran termin
  let baseLabel = batch.batch_label || `Batch #${batch.id}`;
  let nextTermin = 2;
  const terminMatch = baseLabel.match(/\s*-\s*Termin\s*(\d+)$/i);
  if (terminMatch) {
    nextTermin = parseInt(terminMatch[1], 10) + 1;
    baseLabel = baseLabel.replace(/\s*-\s*Termin\s*(\d+)$/i, '').trim();
  }
  const newBatchLabel = `${baseLabel} - Termin ${nextTermin}`;

  // Tentukan status batch baru sesuai status terendah dari sisa item yang belum selesai
  const hasPendingManager = unpaidItems.some((i: any) => i.final_status === 'pending');
  const hasPendingExec1 = unpaidItems.some((i: any) => i.final_status === 'manager_approved');
  const hasPendingFinance = unpaidItems.some((i: any) => ['executive_1_approved', 'pending_finance_outstanding'].includes(i.final_status));
  const hasPendingExecFinal = unpaidItems.some((i: any) => i.final_status === 'finance_selected');

  let newBatchStatus = 'pending_finance';
  if (hasPendingManager) newBatchStatus = 'pending_manager';
  else if (hasPendingExec1) newBatchStatus = 'pending_executive_1';
  else if (hasPendingFinance) newBatchStatus = 'pending_finance';
  else if (hasPendingExecFinal) newBatchStatus = 'pending_executive';

  // 4. Buat batch baru di database
  const now = new Date().toISOString();
  const { data: newBatch, error: newBatchErr } = await supabase.from('payment_batches').insert({
    campaign_id: batch.campaign_id,
    batch_label: newBatchLabel,
    status: newBatchStatus,
    submitted_by: batch.submitted_by,
    submitted_at: batch.submitted_at || now,
    manager_reviewed_by: batch.manager_reviewed_by,
    manager_reviewed_at: batch.manager_reviewed_at,
    notes: batch.notes ? `${batch.notes} (Pemisahan dari ${batch.batch_label})` : `Pemisahan sisa dari ${batch.batch_label}`
  }).select('id').single();

  if (newBatchErr || !newBatch) {
    console.error("Gagal membuat batch auto-split:", newBatchErr);
    return;
  }

  // 5. Pindahkan item-item yang belum lunas ke batch baru
  const unpaidItemIds = unpaidItems.map((i: any) => i.id);
  const { error: moveErr } = await supabase.from('payment_items')
    .update({ batch_id: newBatch.id })
    .in('id', unpaidItemIds);

  if (moveErr) {
    console.error("Gagal memindahkan item ke batch auto-split:", moveErr);
  }
}

export async function financeMarkPaid(batchId: number, payload: { actualPaymentDate: string, buktiTransferUrl: string, senderAccountId: number }) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  const now = new Date().toISOString();
  
  // 1. Update item final_status for all executive_approved items
  const { error: itemsErr } = await supabase.from('payment_items').update({
    final_status: 'paid'
  }).eq('batch_id', batchId).eq('final_status', 'executive_approved');
  if (itemsErr) throw new Error(itemsErr.message);

  // 2. Auto-split any remaining unpaid items into Termin 2
  await autoSplitUnpaidBatchItems(supabase, batchId, user);

  // 3. Update batch status to paid
  const { error: batchErr } = await supabase.from('payment_batches').update({
    status: 'paid',
    paid_by: user?.user?.id,
    paid_at: now,
    actual_payment_date: payload.actualPaymentDate,
    bukti_transfer_url: payload.buktiTransferUrl,
    sender_account_id: payload.senderAccountId
  }).eq('id', batchId);
  if (batchErr) throw new Error(batchErr.message);

  revalidatePath('/budgeting');
}

export async function financeBulkMarkPaidItems(batchId: number, itemIds: number[], payload: { actualPaymentDate: string, buktiTransferUrl: string, senderAccountId: number }) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  const now = new Date().toISOString();
  
  // 1. Update specific items to paid
  const { error: itemsErr } = await supabase.from('payment_items').update({
    final_status: 'paid'
  }).in('id', itemIds).eq('batch_id', batchId);
  if (itemsErr) throw new Error(itemsErr.message);

  // 2. Auto-split any remaining unpaid items into Termin 2
  await autoSplitUnpaidBatchItems(supabase, batchId, user);

  // 3. All remaining items in batch are now finalized, close the batch as paid
  const { error: batchErr } = await supabase.from('payment_batches').update({
    status: 'paid',
    paid_by: user?.user?.id,
    paid_at: now,
    actual_payment_date: payload.actualPaymentDate,
    bukti_transfer_url: payload.buktiTransferUrl,
    sender_account_id: payload.senderAccountId
  }).eq('id', batchId);
  if (batchErr) throw new Error(batchErr.message);

  revalidatePath('/budgeting');
}


// ==========================================
// EXECUTIVE ACTIONS
// ==========================================

export async function executiveApproveItem(itemId: number) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  const { error } = await supabase.from('payment_items').update({
    executive_status: 'approved',
    final_status: 'executive_approved',
    executive_acted_by: user?.user?.id,
    executive_acted_at: new Date().toISOString()
  }).eq('id', itemId);
  if (error) throw new Error(error.message);
}

export async function executiveRejectItem(itemId: number, reason: string) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  const { error } = await supabase.from('payment_items').update({
    executive_status: 'rejected',
    final_status: 'rejected',
    executive_note: reason,
    executive_acted_by: user?.user?.id,
    executive_acted_at: new Date().toISOString()
  }).eq('id', itemId);
  if (error) throw new Error(error.message);
}

export async function executiveFinalizeReview(batchId: number) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();

  const { data: items } = await supabase.from('payment_items').select('id, final_status').eq('batch_id', batchId);
  const unapproved = items?.filter(i => ['pending', 'manager_approved', 'finance_selected'].includes(i.final_status)) || [];
  if (unapproved.length > 0) {
    throw new Error(`Masih ada ${unapproved.length} tagihan yang belum selesai disetujui. Harap setujui atau tolak tagihan terlebih dahulu sebelum menandai batch siap bayar.`);
  }

  const { error } = await supabase.from('payment_batches').update({
    status: 'ready_to_pay',
    executive_reviewed_by: user?.user?.id,
    executive_reviewed_at: new Date().toISOString()
  }).eq('id', batchId);
  if (error) throw new Error(error.message);
  revalidatePath('/budgeting');
}

// ==========================================
// READ / SUMMARY ACTIONS
// ==========================================

export async function getBudgetSummary() {
  const supabase = await createClient();
  
  // 1. Coba query view agregasi berkecepatan tinggi jika ada
  try {
    const { data: viewData, error: vErr } = await supabase
      .from('vw_campaign_budget_summary')
      .select('*')
      .order('campaign_nama', { ascending: true });
      
    if (!vErr && viewData && viewData.length > 0) {
      return viewData;
    }
  } catch (e) {
    // Abaikan jika view belum ada di Supabase, gunakan fallback
  }

  // 2. Fallback perhitungan manual yang telah dioptimasi
  const { data: campaigns, error: campErr } = await supabase
    .from('campaigns')
    .select('id, nama, budget_creator_plafon, budget_ads_plafon, status')
    .neq('status', 'draft');
    
  if (campErr) throw new Error(campErr.message);

  const { data: paidItems, error: itemsErr } = await supabase
    .from('payment_items')
    .select('payment_type, nominal, actual_transfer, biaya_transfer, payment_batches!inner(campaign_id)')
    .eq('final_status', 'paid');
    
  if (itemsErr) throw new Error(itemsErr.message);

  const summary = campaigns.map(camp => {
    let terpakaiCreator = 0;
    let terpakaiAds = 0;
    
    paidItems?.forEach(item => {
      const itemCampaignId = (item.payment_batches as any)?.campaign_id;
      if (itemCampaignId === camp.id) {
        const baseNominal = item.actual_transfer != null ? Number(item.actual_transfer) : Number(item.nominal || 0);
        if (item.payment_type === 'ads') {
          terpakaiAds += baseNominal + Number(item.biaya_transfer || 0);
        } else {
          terpakaiCreator += baseNominal + Number(item.biaya_transfer || 0);
        }
      }
    });
    
    const budgetCreator = Number(camp.budget_creator_plafon || 0);
    const budgetAds = Number(camp.budget_ads_plafon || 0);
    
    return {
      campaign_id: camp.id,
      campaign_nama: camp.nama,
      status: camp.status,
      budget_creator: budgetCreator,
      terpakai_creator: terpakaiCreator,
      sisa_creator: budgetCreator - terpakaiCreator,
      budget_ads: budgetAds,
      terpakai_ads: terpakaiAds,
      sisa_ads: budgetAds - terpakaiAds
    };
  });

  return summary;
}

export async function financeUpdateAmounts(itemId: number, actualTransfer: number | null, biayaTransfer: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase.from('payment_items').update({
    actual_transfer: actualTransfer,
    biaya_transfer: biayaTransfer
  }).eq('id', itemId);

  if (error) throw new Error(error.message);
  revalidatePath('/budgeting');
}

// ==========================================
// GLOBAL COMMAND CENTER ACTIONS (BULK)
// ==========================================

export async function fetchCommandCenterBatches() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('rpc_get_payment_batches', {
    p_status_in: ['pending_manager', 'pending_executive_1', 'pending_finance', 'pending_executive', 'ready_to_pay']
  });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function bulkApproveManager(batchIds: number[]) {
  if (!batchIds || batchIds.length === 0) return;
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  const userId = user?.user?.id;
  const now = new Date().toISOString();

  await supabase.from('payment_items')
    .update({
      manager_status: 'approved',
      final_status: 'manager_approved',
      manager_acted_by: userId,
      manager_acted_at: now
    })
    .in('batch_id', batchIds)
    .eq('final_status', 'pending');

  await supabase.from('payment_batches')
    .update({
      status: 'pending_executive_1',
      manager_reviewed_by: userId,
      manager_reviewed_at: now
    })
    .in('id', batchIds)
    .eq('status', 'pending_manager');
    
  revalidatePath('/budgeting');
}

export async function bulkApproveExecutive1(batchIds: number[]) {
  if (!batchIds || batchIds.length === 0) return;
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  const userId = user?.user?.id;
  const now = new Date().toISOString();

  await supabase.from('payment_items')
    .update({
      manager_status: 'approved',
      manager_acted_by: userId,
      manager_acted_at: now,
      final_status: 'executive_1_approved',
      executive_1_status: 'approved',
      executive_1_acted_by: userId,
      executive_1_acted_at: now
    })
    .in('batch_id', batchIds)
    .eq('final_status', 'pending');

  await supabase.from('payment_items')
    .update({
      final_status: 'executive_1_approved',
      executive_1_status: 'approved',
      executive_1_acted_by: userId,
      executive_1_acted_at: now
    })
    .in('batch_id', batchIds)
    .eq('final_status', 'manager_approved');

  await supabase.from('payment_batches')
    .update({
      status: 'pending_finance',
      manager_reviewed_by: userId,
      manager_reviewed_at: now,
      executive_reviewed_1_by: userId,
      executive_reviewed_1_at: now
    })
    .in('id', batchIds)
    .eq('status', 'pending_manager');

  await supabase.from('payment_batches')
    .update({
      status: 'pending_finance',
      executive_reviewed_1_by: userId,
      executive_reviewed_1_at: now
    })
    .in('id', batchIds)
    .eq('status', 'pending_executive_1');
    
  revalidatePath('/budgeting');
}

export async function bulkApproveExecutiveFinal(batchIds: number[]) {
  if (!batchIds || batchIds.length === 0) return;
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  const userId = user?.user?.id;
  const now = new Date().toISOString();

  await supabase.from('payment_items')
    .update({
      executive_status: 'approved',
      final_status: 'ready_to_pay',
      executive_acted_by: userId,
      executive_acted_at: now
    })
    .in('batch_id', batchIds)
    .in('final_status', ['finance_selected']);

  await supabase.from('payment_batches')
    .update({
      status: 'ready_to_pay',
      executive_reviewed_by: userId,
      executive_reviewed_at: now
    })
    .in('id', batchIds)
    .eq('status', 'pending_executive');
    
  revalidatePath('/budgeting');
}

// ==========================================
// FINANCE BULK ACTIONS (PHASE 3)
// ==========================================

export async function bulkProcessFinanceReview(itemIds: number[], actionType: 'approve' | 'pending' | 'reject') {
  if (!itemIds || itemIds.length === 0) return;
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  const userId = user?.user?.id;
  const now = new Date().toISOString();

  try {
    let finalStatus = 'pending';
    let updateData: any = {};

    if (actionType === 'approve') {
      finalStatus = 'finance_selected'; // this means it's ready for executive final
      updateData = {
        finance_selected: true,
        final_status: finalStatus
      };
    } else if (actionType === 'pending') {
      finalStatus = 'pending_finance_outstanding'; // new status for Tunda
      updateData = {
        finance_selected: false,
        final_status: finalStatus
      };
    } else if (actionType === 'reject') {
      finalStatus = 'rejected';
      updateData = {
        finance_selected: false,
        final_status: finalStatus
      };
    }

    // Update items
    const { error } = await supabase.from('payment_items')
      .update(updateData)
      .in('id', itemIds);
      
    if (error) return { success: false, error: "Failed to update items: " + error.message };

    const { data: items } = await supabase.from('payment_items').select('batch_id').in('id', itemIds);
    if (items && actionType === 'approve') {
      const batchIds = [...new Set(items.map(i => i.batch_id))];
      for (const bId of batchIds) {
        const { data: rem } = await supabase.from('payment_items').select('final_status').eq('batch_id', bId);
        const hasEarlierStages = rem?.some(i => ['pending', 'manager_approved', 'executive_1_approved', 'pending_finance_outstanding'].includes(i.final_status));
        if (!hasEarlierStages) {
          await supabase.from('payment_batches')
            .update({
              status: 'pending_executive',
              finance_reviewed_by: userId,
              finance_reviewed_at: now
            })
            .eq('id', bId)
            .eq('status', 'pending_finance');
        }
      }
    }

    revalidatePath('/budgeting');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Unknown error occurred" };
  }
}

export async function bulkMarkPaidFinance(itemIds: number[], payload: { actualPaymentDate: string, buktiTransferUrl: string, senderAccountId: number }) {
  if (!itemIds || itemIds.length === 0) return;
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  const userId = user?.user?.id;
  const now = new Date().toISOString();

  // Update items to paid
  const { error } = await supabase.from('payment_items')
    .update({
      final_status: 'paid'
    })
    .in('id', itemIds);

  if (error) throw new Error("Failed to mark items paid: " + error.message);

  // Update affected batches
  const { data: items } = await supabase.from('payment_items').select('batch_id').in('id', itemIds);
  if (items) {
    const batchIds = [...new Set(items.map(i => i.batch_id))];
    
    // For each batch, check if all items are paid or rejected. If so, mark batch as paid.
    for (const bId of batchIds) {
      // Selalu update link bukti transfer di level batch meskipun baru sebagian yang dibayar
      await supabase.from('payment_batches').update({
        actual_payment_date: payload.actualPaymentDate,
        bukti_transfer_url: payload.buktiTransferUrl,
        sender_account_id: payload.senderAccountId
      }).eq('id', bId);

      // Auto-split remaining unpaid items (seperti pending_finance_outstanding) ke Termin 2
      await autoSplitUnpaidBatchItems(supabase, bId, user);

      // Setelah auto-split, batch bId dijamin hanya berisi item yang sudah paid/rejected/cancelled
      await supabase.from('payment_batches').update({
        status: 'paid',
        paid_by: userId,
        paid_at: now
      }).eq('id', bId);
    }
  }

  revalidatePath('/budgeting');
}

export async function processBulkExecutive(itemIds: number[]) {
  // Similar to batch, but for items
  if (!itemIds || itemIds.length === 0) return;
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  const userId = user?.user?.id;
  const now = new Date().toISOString();

  // We need to fetch items to know their current state because Exec can bypass
  const { data: items } = await supabase.from('payment_items').select('id, final_status, batch_id').in('id', itemIds);
  if (!items) return;

  const toExec1FromPending = items.filter(i => i.final_status === 'pending').map(i => i.id);
  const toExec1FromMgr = items.filter(i => i.final_status === 'manager_approved').map(i => i.id);
  const toReady = items.filter(i => i.final_status === 'finance_selected').map(i => i.id);

  if (toExec1FromPending.length > 0) {
    await supabase.from('payment_items').update({
      manager_status: 'approved',
      manager_acted_by: userId,
      manager_acted_at: now,
      final_status: 'executive_1_approved',
      executive_1_status: 'approved',
      executive_1_acted_by: userId,
      executive_1_acted_at: now
    }).in('id', toExec1FromPending);
  }

  if (toExec1FromMgr.length > 0) {
    await supabase.from('payment_items').update({
      final_status: 'executive_1_approved',
      executive_1_status: 'approved',
      executive_1_acted_by: userId,
      executive_1_acted_at: now
    }).in('id', toExec1FromMgr);
  }

  if (toReady.length > 0) {
    await supabase.from('payment_items').update({
      executive_status: 'approved',
      final_status: 'ready_to_pay',
      executive_acted_by: userId,
      executive_acted_at: now
    }).in('id', toReady);
  }

  // Advance batches carefully based on remaining item states
  const batchIds = [...new Set(items.map(i => i.batch_id))];
  for (const bId of batchIds) {
    const { data: remItems } = await supabase.from('payment_items').select('final_status').eq('batch_id', bId);
    const hasPendingManager = remItems?.some(i => i.final_status === 'pending');
    const hasPendingExec1 = remItems?.some(i => i.final_status === 'manager_approved');
    const hasPendingFinance = remItems?.some(i => ['executive_1_approved', 'pending_finance_outstanding'].includes(i.final_status));
    const hasPendingExecFinal = remItems?.some(i => i.final_status === 'finance_selected');

    if (hasPendingManager) {
      // Do not advance past pending_manager while items are still pending manager review
      await supabase.from('payment_batches').update({ status: 'pending_manager' }).eq('id', bId);
    } else if (hasPendingExec1) {
      await supabase.from('payment_batches').update({
        status: 'pending_executive_1',
        manager_reviewed_by: userId,
        manager_reviewed_at: now
      }).eq('id', bId);
    } else if (hasPendingFinance) {
      await supabase.from('payment_batches').update({
        status: 'pending_finance',
        manager_reviewed_by: userId,
        manager_reviewed_at: now,
        executive_reviewed_1_by: userId,
        executive_reviewed_1_at: now
      }).eq('id', bId);
    } else if (hasPendingExecFinal) {
      await supabase.from('payment_batches').update({
        status: 'pending_executive',
        finance_reviewed_by: userId,
        finance_reviewed_at: now
      }).eq('id', bId);
    } else {
      await supabase.from('payment_batches').update({
        status: 'ready_to_pay',
        executive_reviewed_by: userId,
        executive_reviewed_at: now
      }).eq('id', bId);
    }
  }

  revalidatePath('/budgeting');
}

export async function processBulkManagerItems(itemIds: number[]) {
  if (!itemIds || itemIds.length === 0) return;
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  const userId = user?.user?.id;
  const now = new Date().toISOString();

  await supabase.from('payment_items')
    .update({
      manager_status: 'approved',
      final_status: 'manager_approved',
      manager_acted_by: userId,
      manager_acted_at: now
    })
    .in('id', itemIds)
    .eq('final_status', 'pending');

  const { data: items } = await supabase.from('payment_items').select('batch_id').in('id', itemIds);
  if (items) {
    const batchIds = [...new Set(items.map(i => i.batch_id))];
    for (const bId of batchIds) {
      const { data: remItems } = await supabase.from('payment_items').select('final_status').eq('batch_id', bId);
      const hasPending = remItems?.some(i => i.final_status === 'pending');
      // Only advance to pending_executive_1 if ALL pending items in the batch were acted on!
      if (!hasPending) {
        await supabase.from('payment_batches')
          .update({
            status: 'pending_executive_1',
            manager_reviewed_by: userId,
            manager_reviewed_at: now
          })
          .eq('id', bId)
          .eq('status', 'pending_manager');
      }
    }
  }
  revalidatePath('/budgeting');
}
