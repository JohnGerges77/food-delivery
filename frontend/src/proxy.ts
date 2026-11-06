import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const match = /^\/(en|ar)(?=\/|$)/.exec(pathname);
  const publicPath = match ? pathname.slice(match[0].length) || "/" : pathname;
  const isRestaurantPage = !/^\/(dashboard|admin)(?:\/|$)/.test(publicPath);
  if (isRestaurantPage && !match) {
    const preferred = request.cookies.get("savora_public_locale")?.value === "en" ? "en" : "ar";
    const url = request.nextUrl.clone();
    url.pathname = `/${preferred}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }
  const response = intlMiddleware(request);
  if (isRestaurantPage && match) {
    response.cookies.set("savora_public_locale", match[1], {
      path: "/", sameSite: "lax", httpOnly: true,
      secure: request.nextUrl.protocol === "https:", maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
