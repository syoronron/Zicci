import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * 管理画面の簡易パスワード（P4 で本格的なログインに置き換える予定）。
 *
 * - パスワードは環境変数 ADMIN_PASSWORD（8文字以上）で設定する
 * - ログインに成功すると、パスワードから作った「合言葉」（HMAC）を Cookie に保存する
 *   → Cookie にパスワードそのものは入らない
 *   → ADMIN_PASSWORD を変えると、全員のログインが無効になる
 */
export const ADMIN_COOKIE = "zicci_admin";
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30日

export function adminPassword(): string | null {
  const value = process.env.ADMIN_PASSWORD?.trim();
  return value && value.length >= 8 ? value : null;
}

export function adminPasswordStatus(): "ok" | "missing" | "too_short" {
  const value = process.env.ADMIN_PASSWORD?.trim();
  if (!value) return "missing";
  return value.length >= 8 ? "ok" : "too_short";
}

function tokenFor(password: string): string {
  return createHmac("sha256", password).update("zicci-admin-v1").digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkPassword(input: string): boolean {
  const password = adminPassword();
  return password !== null && safeEqual(input, password);
}

export function createAdminToken(): string | null {
  const password = adminPassword();
  return password ? tokenFor(password) : null;
}

export function isValidAdminToken(token: string | undefined): boolean {
  const password = adminPassword();
  if (!password || !token) return false;
  return safeEqual(token, tokenFor(password));
}

/** 今のリクエストがログイン済みか（サーバーコンポーネント・サーバーアクション用） */
export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return isValidAdminToken(store.get(ADMIN_COOKIE)?.value);
}

/** 管理画面のページ用：ログインしていなければログイン画面へ（proxy に加えた二重の確認） */
export async function requireAdminPage(): Promise<void> {
  if (!(await isAdmin())) redirect("/login");
}
