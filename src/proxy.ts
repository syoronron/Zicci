import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/auth";

/**
 * 管理画面（/admin 以下）は、ログインしていなければログイン画面へ移動させる。
 * 管理画面のサーバーアクション（保存処理）も /admin へのリクエストなので、ここを通る。
 * さらに念のため、各サーバーアクションの中でもログインを確認している。
 */
export function proxy(request: NextRequest) {
  if (isValidAdminToken(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.next();
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
