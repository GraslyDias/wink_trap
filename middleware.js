import { NextResponse } from 'next/server'

export function middleware(request) {
  // Simply pass through all requests
  return NextResponse.next()
}

// Only run middleware on specific paths (keeping this for future use)
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
} 