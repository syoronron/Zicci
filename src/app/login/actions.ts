"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { failure, type ActionState } from "@/lib/action-state";
import { ADMIN_COOKIE, ADMIN_COOKIE_MAX_AGE, adminPassword, checkPassword, createAdminToken } from "@/lib/auth";
import { LOGIN_LIMITS, lockedMinutes, recordFailure, recordSuccess } from "@/lib/login-throttle";

/** ログイン後の移動先。/admin 以下だけを許可する（外部サイトへの移動を防ぐ） */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin";
}

export async function login(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!adminPassword()) {
    return failure("管理画面のパスワードがまだ設定されていません。");
  }
  // 接続元ごとに失敗回数を数える
  const h = await headers();
  const client = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
  const locked = lockedMinutes(client);
  if (locked) {
    return failure(`パスワードを続けて間違えたため、${locked}分ほどログインできません。時間をおいてお試しください。`);
  }

  const password = String(formData.get("password") ?? "");
  if (!checkPassword(password)) {
    // 総当たりを遅らせるため、失敗時は少し待つ
    await new Promise((r) => setTimeout(r, 800));
    if (recordFailure(client)) {
      return failure(
        `パスワードを${LOGIN_LIMITS.MAX_FAILURES}回続けて間違えたため、${LOGIN_LIMITS.LOCK_MINUTES}分間ログインできなくなりました。`,
      );
    }
    return failure("パスワードが違います。");
  }
  recordSuccess(client);
  const token = createAdminToken();
  if (!token) return failure("ログインできませんでした。");

  const store = await cookies();
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_COOKIE_MAX_AGE,
  });
  redirect(safeNext(formData.get("next")));
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  redirect("/login");
}
