"use server";

import { headers } from "next/headers";
import { isAdmin } from "@/lib/auth";
import { readShiftSheet, type ReadShiftResult } from "@/lib/ai/shift-reader";
import { listEmployees, requireStore } from "@/lib/data/store";
import { resolveWeek } from "@/lib/week";

/*
 * シフト表の写真を AI で読み取る（管理画面にログインした人だけ）。
 * クレジットの使いすぎを防ぐため、写真の大きさと回数を制限する。
 */

const MAX_BYTES = 2.5 * 1024 * 1024; // 端末側で縮小してから送るので、通常は 0.5MB 前後
const MAX_PER_HOUR = 20; // 1時間あたりの読み取り回数（接続元ごと）
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

const usage = new Map<string, number[]>();

function allow(key: string, now = Date.now()): boolean {
  const recent = (usage.get(key) ?? []).filter((t) => now - t < 60 * 60_000);
  if (recent.length >= MAX_PER_HOUR) {
    usage.set(key, recent);
    return false;
  }
  usage.set(key, [...recent, now]);
  return true;
}

export async function readShiftPhoto(formData: FormData): Promise<ReadShiftResult> {
  if (!(await isAdmin())) {
    return { ok: false, message: "ログインの有効期限が切れました。ページを再読み込みしてください。" };
  }

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return { ok: false, message: "写真を選んでください。" };
  const type = TYPES.find((t) => t === photo.type);
  if (!type) return { ok: false, message: "写真の形式に対応していません（JPEG・PNG・WebP）。" };
  if (photo.size > MAX_BYTES) return { ok: false, message: "写真が大きすぎます。" };

  const h = await headers();
  const client = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
  if (!allow(client)) {
    return { ok: false, message: `AI読み取りは1時間に${MAX_PER_HOUR}回までです。時間をおいてお試しください。` };
  }

  const week = resolveWeek(String(formData.get("week") ?? ""));
  const store = await requireStore();
  const employees = await listEmployees(store.id);

  return readShiftSheet({
    imageBase64: Buffer.from(await photo.arrayBuffer()).toString("base64"),
    mediaType: type,
    weekDays: week.days,
    knownNames: employees.map((e) => e.name),
  });
}
