"use server";

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// ==========================================
// READ ACTIONS
// ==========================================

export async function getPaymentBatches(campaignId?: number, status?: string) {
  const supabase = await createClient();
  let query = supabase.from('payment_batches').select(`
    *,
    submitter:profiles!submitted_by(nama),
    campaigns(nama),
    payment_items(id, nominal, biaya_transfer, final_status, payment_type, campaign_creator_id)
  `).order('created_at', { ascending: false });

  if (campaignId) query = query.eq('campaign_id', campaignId);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchMutationsPaginated(page: number, limit: number, month: string, search: string) {
  const supabase = await createClient();
  let query = supabase.from('vw_payment_mutations').select('*', { count: 'exact' });

  if (month !== 'all') {
    query = query.eq('paid_month', month);
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

export async function fetchMutationsExport(month: string, search: string) {
  const supabase = await createClient();
  let query = supabase.from('vw_payment_mutations').select('*');

  if (month !== 'all') {
    query = query.eq('paid_month', month);
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
    submitter:profiles!submitted_by(nama),
    manager:profiles!manager_reviewed_by(nama),
    finance:profiles!finance_reviewed_by(nama),
    executive:profiles!executive_reviewed_by(nama),
    payer:profiles!paid_by(nama),
    sender_account:sender_accounts(nama),
    campaigns(nama),
    payment_items(
      *,
      campaign_creators(
        id, tier, price, qty_vt, creators(id, username, nama_asli), profiles:profiles!pic_id(nama)
      ),
      creator_bank_accounts(bank_name, account_number, account_holder)
    )
  `).eq('id', batchId).single();

  if (error) throw new Error(error.message);

  if (data?.executive_reviewed_1_by) {
    const { data: exec1 } = await supabase.from('profiles').select('nama').eq('id', data.executive_reviewed_1_by).single();
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
  
  // Jika rekening diketik manual, kita harus insert ke creator_bank_accounts dulu
  let bankAccountId = itemData.bank_account_id;
  let bankName = itemData.metode_pembayaran || null;
  let bankNumber = itemData.nomor_rekening || null;
  let bankHolder = itemData.nama_penerima || null;
  
  if (bankAccountId) {
    // Kunci data bank ke payment_items agar history mutasi statis & akurat
    const { data: bankData } = await supabase.from('creator_bank_accounts').select('*').eq('id', bankAccountId).single();
    if (bankData) {
      bankName = bankData.bank_name;
      bankNumber = bankData.account_number;
      bankHolder = bankData.account_holder;
    }
  } else if (itemData.metode_pembayaran && itemData.nomor_rekening) {
    // Get creator_id from campaign_creators
    const { data: ccData } = await supabase.from('campaign_creators').select('creator_id').eq('id', itemData.campaign_creator_id).single();
    
    if (ccData) {
      const { data: newBank } = await supabase.from('creator_bank_accounts').insert({
        creator_id: ccData.creator_id,
        bank_name: itemData.metode_pembayaran,
        account_number: itemData.nomor_rekening,
        account_holder: itemData.nama_penerima || '',
      }).select('id').single();
      
      if (newBank) bankAccountId = newBank.id;
    }
  }

  const payload = {
    batch_id: batchId,
    campaign_creator_id: itemData.campaign_creator_id || null, // Allow null for Ads Top Up
    payment_type: itemData.payment_type,
    ratecard_awal: itemData.ratecard_awal || null,
    nominal: itemData.nominal,
    biaya_transfer: itemData.biaya_transfer || 0,
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
    final_status: 'pending'
  };

  const { error } = await supabase.from('payment_items').insert(payload);
  if (error) throw new Error(error.message);
}

export async function updatePaymentItem(itemId: number, itemData: any) {
  const supabase = await createClient();
  const { error } = await supabase.from('payment_items').update(itemData).eq('id', itemId);
  if (error) throw new Error(error.message);
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
      pic_id: picId,
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
    notes_dari_pic: item.notes || null,
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

export async function financeMarkPaid(batchId: number, payload: { actualPaymentDate: string, buktiTransferUrl: string, senderAccountId: number }) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  
  // 1. Update batch status
  const { error: batchErr } = await supabase.from('payment_batches').update({
    status: 'paid',
    paid_by: user?.user?.id,
    paid_at: new Date().toISOString(),
    actual_payment_date: payload.actualPaymentDate,
    bukti_transfer_url: payload.buktiTransferUrl,
    sender_account_id: payload.senderAccountId
  }).eq('id', batchId);
  if (batchErr) throw new Error(batchErr.message);

  // 2. Update item final_status for all executive_approved items
  const { error: itemsErr } = await supabase.from('payment_items').update({
    final_status: 'paid'
  }).eq('batch_id', batchId).eq('final_status', 'executive_approved');
  if (itemsErr) throw new Error(itemsErr.message);

  revalidatePath('/budgeting');
}

export async function financeBulkMarkPaidItems(batchId: number, itemIds: number[], payload: { actualPaymentDate: string, buktiTransferUrl: string, senderAccountId: number }) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  
  // Update specific items to paid
  const { error: itemsErr } = await supabase.from('payment_items').update({
    final_status: 'paid',
    // Could also store bukti transfer per item if schema supported it, but we'll stick to updating status
  }).in('id', itemIds).eq('batch_id', batchId);
  if (itemsErr) throw new Error(itemsErr.message);

  // Check if all items in batch are now paid, rejected or cancelled
  const { data: allItems } = await supabase.from('payment_items')
    .select('id, final_status')
    .eq('batch_id', batchId);
  
  const remainingItems = (allItems || []).filter(item => 
    !['paid', 'rejected', 'cancelled'].includes(item.final_status)
  );
  
  if (remainingItems.length === 0) {
    // All items are finalized, close the batch
    const { error: batchErr } = await supabase.from('payment_batches').update({
      status: 'paid',
      paid_by: user?.user?.id,
      paid_at: new Date().toISOString(),
      actual_payment_date: payload.actualPaymentDate,
      bukti_transfer_url: payload.buktiTransferUrl,
      sender_account_id: payload.senderAccountId
    }).eq('id', batchId);
    if (batchErr) throw new Error(batchErr.message);
  }

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
  
  // Ambil semua campaigns yang aktif
  const { data: campaigns, error: campErr } = await supabase
    .from('campaigns')
    .select('id, nama, budget_creator_plafon, budget_ads_plafon, status')
    .neq('status', 'draft');
    
  if (campErr) throw new Error(campErr.message);

  // Ambil semua payment items yang berstatus paid
  const { data: paidItems, error: itemsErr } = await supabase
    .from('payment_items')
    .select('payment_type, nominal, biaya_transfer, payment_batches!inner(campaign_id)')
    .eq('final_status', 'paid');
    
  if (itemsErr) throw new Error(itemsErr.message);

  // Kalkulasi per campaign
  const summary = campaigns.map(camp => {
    let terpakaiCreator = 0;
    let terpakaiAds = 0;
    
    paidItems?.forEach(item => {
      const itemCampaignId = (item.payment_batches as any)?.campaign_id;
      if (itemCampaignId === camp.id) {
        if (item.payment_type === 'ads') {
          terpakaiAds += Number(item.nominal || 0);
        } else {
          terpakaiCreator += Number(item.nominal || 0) + Number(item.biaya_transfer || 0);
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
