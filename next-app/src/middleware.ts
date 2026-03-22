import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionCookie, SESSION_OPTIONS } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/help"];
const API_AUTH_PREFIX = "/api/auth";

function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith(API_AUTH_PREFIX)) return true;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const cookieName = SESSION_OPTIONS.cookieName;
  const cookie = request.cookies.get(cookieName)?.value;
  if (!cookie) {
    const login = new URL("/login", request.url);
    login.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }

  const session = await verifySessionCookie(cookie);
  if (!session) {
    const res = NextResponse.redirect(new URL("/login", request.url));
    res.cookies.delete(cookieName);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
