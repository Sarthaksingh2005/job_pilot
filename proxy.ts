import { NextRequest, NextResponse } from "next/server";

// Routes that require authentication
const protectedRoutes = ["/find-jobs", "/dashboard", "/profile"];
// Routes that should never be protected (even if they match protected pattern)
const publicRoutes = ["/login", "/", "/api"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Don't protect public routes
  if (publicRoutes.some((route) => route === "/" ? pathname === "/" : pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check if this is a protected route
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // Check for auth session cookie (set by InsForge on login)
  // InsForge/Supabase sets cookies with names starting with "sb-"
  const allCookieNames = request.cookies.getAll().map((c) => c.name);
  const hasAuthCookie = allCookieNames.some(
    (name) =>
      name.startsWith("sb-") ||
      name === "auth" ||
      name === "session" ||
      name.includes("auth-token") ||
      name.includes("access-token")
  );

  if (!hasAuthCookie) {
    // Redirect to login
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!api|_next/static|_next/image|favicon.ico|images).*)",
  ],
};
