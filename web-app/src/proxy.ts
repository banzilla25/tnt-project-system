import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function proxy(request: NextRequest) {
  // Update session first
  const response = await updateSession(request);

  // Check auth state
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Handled by updateSession
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/auth/callback');
  const isPendingRoute = request.nextUrl.pathname.startsWith('/pending');

  if (!user && !isAuthRoute) {
    // Redirect to login if accessing protected route without session
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (user) {
    // Check user profile status
    const { data: profile } = await supabase
      .from('profiles')
      .select('status')
      .eq('id', user.id)
      .single();

    const isPending = profile?.status === 'pending' || profile?.status === 'inactive';

    if (isPending && !isPendingRoute && !isAuthRoute) {
      return NextResponse.redirect(new URL('/pending', request.url));
    }

    if (!isPending && (isPendingRoute || request.nextUrl.pathname === '/login')) {
      // Redirect to home if already approved and trying to access login/pending
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
