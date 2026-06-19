import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
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
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set({ name, value, ...options });
            });
          },
        },
      }
    );

    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && session) {
      const user = session.user;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', user.id)
        .single();

      const regNameCookie = cookieStore.get('tnt_reg_name')?.value;

      if (!profile) {
        if (regNameCookie) {
          // New user trying to register - insert with provided name
          await supabase.from('profiles').insert({
            id: user.id,
            email: user.email,
            nama: decodeURIComponent(regNameCookie),
            avatar_url: user.user_metadata?.avatar_url || null,
            role: 'anggota',
            status: 'pending'
          });
          
          // Clear the registration cookie
          cookieStore.delete('tnt_reg_name');
        } else {
          // User tried to login but hasn't registered yet!
          // We must sign them out and send them back to the login page with an error.
          await supabase.auth.signOut();
          return NextResponse.redirect(`${origin}/login?error=not-registered`);
        }
      }

      // We handle the pending state check in middleware or they just see a pending screen
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to an error page with some instructions
  return NextResponse.redirect(`${origin}/login?error=auth-callback-failed`);
}
