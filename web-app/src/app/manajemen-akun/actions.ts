"use server";

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

async function getSupabaseAdmin() {
  const cookieStore = await cookies();
  // We use the regular client, but ensure RLS allows updates or use a service role key if needed.
  // Since the user is logged in as a Manager, their token is passed. 
  // If no RLS is set on the table, it allows updates.
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {}
      },
    }
  );
}

export async function approveUser(userId: string) {
  const supabase = await getSupabaseAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from('profiles')
    .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: user.id })
    .eq('id', userId);

  if (error) throw new Error(error.message);
  revalidatePath('/manajemen-akun');
}

export async function rejectUser(userId: string) {
  const supabase = await getSupabaseAdmin();
  
  // Hard delete profile, or just mark inactive
  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', userId)
    .eq('status', 'pending'); // Only allow deleting if pending

  if (error) throw new Error(error.message);
  revalidatePath('/manajemen-akun');
}

export async function deactivateUser(userId: string) {
  const supabase = await getSupabaseAdmin();
  const { error } = await supabase
    .from('profiles')
    .update({ status: 'inactive' })
    .eq('id', userId);

  if (error) throw new Error(error.message);
  revalidatePath('/manajemen-akun');
}

export async function assignCampaignsToUser(userId: string, campaignIds: number[], allCampaigns: boolean) {
  const supabase = await getSupabaseAdmin();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  // First delete existing assignments
  await supabase.from('user_campaigns').delete().eq('user_id', userId);

  // If not all_campaigns and there are specific campaigns, insert them
  if (allCampaigns) {
    const { error } = await supabase.from('user_campaigns').insert({
      user_id: userId,
      all_campaigns: true,
      assigned_by: user.id
    });
    if (error) throw new Error(error.message);
  } else if (campaignIds.length > 0) {
    const inserts = campaignIds.map(cid => ({
      user_id: userId,
      campaign_id: cid,
      all_campaigns: false,
      assigned_by: user.id
    }));
    const { error } = await supabase.from('user_campaigns').insert(inserts);
    if (error) throw new Error(error.message);
  }

  revalidatePath('/manajemen-akun');
}

export async function addWhitelistEmail(email: string, nama: string, role: string) {
  const supabase = await getSupabaseAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase.from('whitelisted_emails').insert({
    email: email.trim().toLowerCase(),
    nama: nama.trim(),
    role,
    added_by: user.id
  });

  if (error) {
    if (error.code === '23505') { // Unique violation
      throw new Error("Email ini sudah terdaftar di whitelist.");
    }
    throw new Error(error.message);
  }
  revalidatePath('/manajemen-akun');
}

export async function removeWhitelistEmail(id: number) {
  const supabase = await getSupabaseAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase.from('whitelisted_emails').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/manajemen-akun');
}
