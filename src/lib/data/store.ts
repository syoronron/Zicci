import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { addDays, jstToDate, parseTime } from "@/lib/time";

/**
 * 店舗データの読み込み（サーバー専用）。
 * ログイン機能（P4）ができるまでは、デモ店舗（public_slug = "demo"）だけを扱う。
 */
export const DEMO_STORE_SLUG = "demo";

export type Store = {
  id: string;
  name: string;
  address: string | null;
  public_slug: string;
  interview_minutes: number;
  shift_buffer_minutes: number;
};

export type Block = {
  id: string;
  weekday: number | null;
  start: number;
  end: number;
  kind: "busy" | "break";
};

export type Employee = { id: string; name: string; is_interviewer: boolean };

export type Shift = {
  id: string;
  employee_id: string;
  date: string;
  start: number;
  end: number;
  source: "ai" | "manual";
};

export type SlotStatus = "draft" | "published" | "closed";

export type Slot = {
  id: string;
  start_at: string;
  end_at: string;
  status: SlotStatus;
  interviewer_ids: string[];
  reserved: boolean;
};

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("データベースが設定されていません。");
  }
}

export function db(): SupabaseClient {
  const client = getSupabaseAdmin();
  if (!client) throw new DatabaseNotConfiguredError();
  return client;
}

export function isDatabaseConfigured(): boolean {
  return getSupabaseAdmin() !== null;
}

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what}の読み込みに失敗しました: ${error.message}`);
}

const toMinutes = (v: string) => parseTime(v) ?? 0;

export async function getStore(): Promise<Store | null> {
  const { data, error } = await db()
    .from("stores")
    .select("id, name, address, public_slug, interview_minutes, shift_buffer_minutes")
    .eq("public_slug", DEMO_STORE_SLUG)
    .maybeSingle();
  if (error) fail("店舗", error);
  return data;
}

/** 店舗が見つからなければエラー（サーバーアクション用） */
export async function requireStore(): Promise<Store> {
  const store = await getStore();
  if (!store) throw new Error("デモ店舗が見つかりません。seed.sql を実行してください。");
  return store;
}

export async function listBlocks(storeId: string): Promise<Block[]> {
  const { data, error } = await db()
    .from("store_blocks")
    .select("id, weekday, start_time, end_time, kind")
    .eq("store_id", storeId)
    .order("weekday", { ascending: true, nullsFirst: true })
    .order("start_time");
  if (error) fail("繁忙時間", error);
  return data.map((b) => ({
    id: b.id,
    weekday: b.weekday,
    start: toMinutes(b.start_time),
    end: toMinutes(b.end_time),
    kind: b.kind,
  }));
}

export async function listEmployees(storeId: string): Promise<Employee[]> {
  const { data, error } = await db()
    .from("employees")
    .select("id, name, is_interviewer")
    .eq("store_id", storeId)
    .order("created_at");
  if (error) fail("スタッフ", error);
  return data;
}

/** from〜to（両端を含む）のシフト */
export async function listShifts(storeId: string, from: string, to: string): Promise<Shift[]> {
  const { data, error } = await db()
    .from("shifts")
    .select("id, employee_id, date, start_time, end_time, source")
    .eq("store_id", storeId)
    .gte("date", from)
    .lte("date", to)
    .order("date")
    .order("start_time");
  if (error) fail("シフト", error);
  return data.map((s) => ({
    id: s.id,
    employee_id: s.employee_id,
    date: s.date,
    start: toMinutes(s.start_time),
    end: toMinutes(s.end_time),
    source: s.source,
  }));
}

/** from〜to（両端を含む）の日に始まる面接枠 */
export async function listSlots(storeId: string, from: string, to: string): Promise<Slot[]> {
  const { data, error } = await db()
    .from("interview_slots")
    .select("id, start_at, end_at, status, slot_interviewers(employee_id), reservations(id)")
    .eq("store_id", storeId)
    .gte("start_at", jstToDate(from, 0).toISOString())
    .lt("start_at", jstToDate(addDays(to, 1), 0).toISOString())
    .order("start_at");
  if (error) fail("面接枠", error);
  return data.map((s) => {
    const r = s.reservations as unknown;
    const reserved = Array.isArray(r) ? r.length > 0 : r != null;
    return {
      id: s.id,
      start_at: s.start_at,
      end_at: s.end_at,
      status: s.status,
      interviewer_ids: (s.slot_interviewers ?? []).map((x: { employee_id: string }) => x.employee_id),
      reserved,
    };
  });
}
