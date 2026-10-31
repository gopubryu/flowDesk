import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { signInRedirectFor } from "@/lib/route-guard";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const target = signInRedirectFor(pathname, search, Boolean(getSessionCookie(request)));
  if (!target) return NextResponse.next();
  return NextResponse.redirect(new URL(target, request.url));
}

export const config = {
  // Pages only: API routes return their own 401; static assets and metadata files are skipped.
  matcher: ["/((?!api/|_next/static|_next/image|favicon\\.ico|.*\\.[^/]+$).*)"],
};
