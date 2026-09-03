import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  const { pathname, search } = request.nextUrl;
  if (!token) {
    const login = new URL("/login", request.url);
    login.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }
  if (pathname.startsWith("/admin") && token.role !== "admin") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (pathname.startsWith("/dashboard") && token.role !== "emprendedor") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (pathname.startsWith("/mis-pedidos") && token.role !== "cliente") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/dashboard/:path*",
    "/mis-pedidos/:path*",
    "/checkout",
  ],
};
