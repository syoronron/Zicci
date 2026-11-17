"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { failure, type ActionState } from "@/lib/action-state";
import { ADMIN_COOKIE, ADMIN_COOKIE_MAX_AGE, adminPassword, checkPassword, createAdminToken } from "@/lib/auth";

/** ログイン後の移動先。/admin 以下だけを許可する（外部サイトへの移動を防ぐ） */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin";
}

export async function login(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!adminPassword()) {
    return failure("管理画面のパスワードがまだ設定されていません。");
  }
  const password = String(formData.get("password") ?? "");
  if (!checkPassword(password)) {
    // 総当たりを遅らせるため、失敗時は少し待つ
    await new Promise((r) => setTimeout(r, 800));
    return failure("パスワードが違います。");
  }
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
