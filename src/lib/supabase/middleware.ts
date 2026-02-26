import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Fetch role once for authenticated users (used by all checks below)
  let userRole: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    userRole = profile?.role ?? null;
  }

  const pathname = request.nextUrl.pathname;

  // ── Protect /admin routes ─────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login?redirect=/admin/dashboard', request.url));
    }
    if (userRole !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // ── Protect /rider routes ─────────────────────────────────────
  if (pathname.startsWith('/rider')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login?redirect=/rider/dashboard', request.url));
    }
    if (userRole !== 'rider') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // ── Redirect admin/rider away from storefront ─────────────────
  // Storefront paths: /, /products, /cart, /checkout, /orders
  const isStorefront =
    pathname === '/' ||
    pathname.startsWith('/products') ||
    pathname.startsWith('/cart') ||
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/orders');

  if (isStorefront && user) {
    if (userRole === 'admin') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
    if (userRole === 'rider') {
      return NextResponse.redirect(new URL('/rider/dashboard', request.url));
    }
  }

  return supabaseResponse;
}
