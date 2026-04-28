import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Skip Basic Auth for NextAuth OAuth routes so Google/GitHub login still works
  if (request.nextUrl.pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  const user = process.env.BASIC_AUTH_USER ?? 'admin';
  const pass = process.env.BASIC_AUTH_PASSWORD ?? 'password123';
  const expected = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');

  const authHeader = request.headers.get('authorization');
  if (authHeader !== expected) {
    return new NextResponse('Authentication Required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/:path*',
};
