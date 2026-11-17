import "server-only";

import { headers } from "next/headers";

/** 応募者向け予約ページの完全なURL（このサイトのドメイン＋パス） */
export async function bookingUrl(slug: string): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/r/${slug}`;
}
