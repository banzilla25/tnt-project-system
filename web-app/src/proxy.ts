import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  // Update session to keep it alive
  let response = await updateSession(request);

  // Create a separate supabase client to check the auth state
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Ignoring because we already handled cookie setting in updateSession
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  // Paths that do not require login
  const isPublicPath = pathname.startsWith('/login') || 
                       pathname.startsWith('/auth') || 
                       pathname.startsWith('/portal');

  // If user is not logged in and path is NOT public, redirect to login
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  
  if (user) {
    // Check user profile status
    const { data: profile } = await supabase
      .from('profiles')
      .select('status')
      .eq('id', user.id)
      .single();

    const isPending = profile?.status === 'pending' || profile?.status === 'inactive';
    const isPendingRoute = pathname.startsWith('/pending');

    if (isPending && !isPendingRoute && !isPublicPath) {
      return NextResponse.redirect(new URL('/pending', request.url));
    }

    if (!isPending && (isPendingRoute || pathname.startsWith('/login'))) {
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
     * - any files with extensions (e.g. .svg, .png)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
