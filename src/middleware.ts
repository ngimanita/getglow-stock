import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SESSION_COOKIE = 'gg_session';
const OWNER_ONLY_PATHS = ['/receive-lot', '/price-compare', '/settings'];

function secretKey() {
  return new TextEncoder().encode(process.env.SESSION_SECRET);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === '/login' || pathname.startsWith('/api/auth') || pathname.startsWith('/_next')) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  let role: string | null = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secretKey());
      role = typeof payload.role === 'string' ? payload.role : null;
    } catch {
      role = null;
    }
  }

  if (!role) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (role !== 'owner' && OWNER_ONLY_PATHS.some((p) => pathname.startsWith(p))) {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest).*)'],
};
