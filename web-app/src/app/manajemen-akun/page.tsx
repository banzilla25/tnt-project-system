import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import ManajemenAkunClient from './ManajemenAkunClient';

export default async function ManajemenAkunPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // handled by middleware
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Cek apakah user adalah manager
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'manager') {
    redirect('/'); // Lempar ke dashboard jika bukan manager
  }

  // Ambil data users dan campaigns untuk initial state
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name')
    .order('name');

  const { data: userCampaigns } = await supabase
    .from('user_campaigns')
    .select('*');

  const { data: whitelist } = await supabase
    .from('whitelisted_emails')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Manajemen Akun</h1>
        <p className="text-slate-500">Kelola persetujuan akun, whitelist email, dan hak akses campaign anggota tim.</p>
      </div>

      <ManajemenAkunClient 
        initialProfiles={profiles || []} 
        campaigns={campaigns || []}
        initialUserCampaigns={userCampaigns || []}
        initialWhitelist={whitelist || []}
      />
    </div>
  );
}
