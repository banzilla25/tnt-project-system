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
    payment_items(id, nominal, biaya_transfer, final_status, payment_type)
  `).order('created_at', { ascending: false });

  if (campaignId) query = query.eq('campaign_id', campaignId);
  if (status) query = query.eq('status', status);

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
        id, tier, price, qty_vt, creators(id, username, nama_asli, type, followers)
      ),
      creator_bank_accounts(bank_name, account_number, account_holder)
    )
  `).eq('id', batchId).single();

  if (error) throw new Error(error.message);
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
  
  if (!bankAccountId && itemData.metode_pembayaran && itemData.nomor_rekening) {
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
    campaign_creator_id: itemData.campaign_creator_id,
    payment_type: itemData.payment_type,
    ratecard_awal: itemData.ratecard_awal || null,
    nominal: itemData.nominal,
    biaya_transfer: itemData.biaya_transfer || 0,
    bank_account_id: bankAccountId,
    metode_pembayaran: itemData.metode_pembayaran || null,
    nomor_rekening: itemData.nomor_rekening || null,
    nama_penerima: itemData.nama_penerima || null,
    nama_wa_pic: itemData.nama_wa_pic,
    nomor_wa_dealing: itemData.nomor_wa_dealing,
    alamat_ktp: itemData.alamat_ktp,
    nik: itemData.nik,
    link_ktp: itemData.link_ktp,
    link_kontrak: itemData.link_kontrak,
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

export async function submitBatchToManager(batchId: number) {
  const supabase = await createClient();
  const { error } = await supabase.from('payment_batches').update({
    status: 'pending_manager',
    submitted_at: new Date().toISOString()
  }).eq('id', batchId);
  if (error) throw new Error(error.message);
  revalidatePath('/budgeting');
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
    status: 'pending_finance',
    manager_reviewed_by: user?.user?.id,
    manager_reviewed_at: new Date().toISOString()
  }).eq('id', batchId);
  if (error) throw new Error(error.message);
  revalidatePath('/budgeting');
}

// ==========================================
// FINANCE ACTIONS
// ==========================================

export async function financeToggleItem(itemId: number, selected: boolean) {
  const supabase = await createClient();
  const finalStatus = selected ? 'finance_selected' : 'manager_approved';
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

  // 2. Update item final_status for all exec_approved items
  const { error: itemsErr } = await supabase.from('payment_items').update({
    final_status: 'paid'
  }).eq('batch_id', batchId).eq('final_status', 'exec_approved');
  if (itemsErr) throw new Error(itemsErr.message);

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
    final_status: 'exec_approved',
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
