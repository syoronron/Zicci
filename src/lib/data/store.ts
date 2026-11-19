import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { parseGuide, type GuideItem } from "@/lib/interview-guide";
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

// ---------------------------------------------------------------------
// 予約（P2）
// ---------------------------------------------------------------------

/** 応募者が予約できる最短の時間（これより直前の枠は表示しない）。DB 関数の既定値と同じ */
export const BOOKING_MIN_LEAD_MINUTES = 60;
/** 応募者に表示する期間 */
export const BOOKING_WINDOW_DAYS = 21;

export type PublicStore = { id: string; name: string; address: string | null; public_slug: string };

/** 応募者向け：URL の文字列から店舗を探す */
export async function getStoreBySlug(slug: string): Promise<PublicStore | null> {
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug)) return null;
  const { data, error } = await db()
    .from("stores")
    .select("id, name, address, public_slug")
    .eq("public_slug", slug)
    .maybeSingle();
  if (error) fail("店舗", error);
  return data;
}

export type BookableSlot = { id: string; start_at: string; end_at: string };

/**
 * 応募者向け：予約できる枠（公開中・未予約・担当者あり・直前でない）。
 * 個人情報や担当者名は含めない。
 */
export async function listBookableSlots(storeId: string, now: Date = new Date()): Promise<BookableSlot[]> {
  const from = new Date(now.getTime() + BOOKING_MIN_LEAD_MINUTES * 60_000);
  const to = new Date(now.getTime() + BOOKING_WINDOW_DAYS * 24 * 60 * 60_000);
  const { data, error } = await db()
    .from("interview_slots")
    .select("id, start_at, end_at, slot_interviewers(employee_id), reservations(id)")
    .eq("store_id", storeId)
    .eq("status", "published")
    .gte("start_at", from.toISOString())
    .lt("start_at", to.toISOString())
    .order("start_at");
  if (error) fail("面接枠", error);
  return data
    .filter((s) => {
      const r = s.reservations as unknown;
      const reserved = Array.isArray(r) ? r.length > 0 : r != null;
      return !reserved && (s.slot_interviewers ?? []).length > 0;
    })
    .map((s) => ({ id: s.id, start_at: s.start_at, end_at: s.end_at }));
}

/** 応募者向け：予約完了画面に出す内容（日時だけ。個人情報は返さない） */
export async function getReservationSummary(
  storeId: string,
  reservationId: string,
): Promise<{ start_at: string; end_at: string } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(reservationId)) return null;
  const { data, error } = await db()
    .from("reservations")
    .select("interview_slots(start_at, end_at)")
    .eq("id", reservationId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) fail("予約", error);
  const slot = (data?.interview_slots ?? null) as unknown as { start_at: string; end_at: string } | null;
  return slot;
}

export type Reservation = {
  id: string;
  applicant_name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
  start_at: string;
  end_at: string;
  interviewer_name: string | null;
};

/** 管理画面向け：指定時刻以降に始まる予約 */
export async function listReservations(storeId: string, fromIso: string): Promise<Reservation[]> {
  const { data, error } = await db()
    .from("reservations")
    .select(
      "id, applicant_name, phone, email, created_at, interview_slots!inner(start_at, end_at), employees(name)",
    )
    .eq("store_id", storeId)
    .gte("interview_slots.start_at", fromIso);
  if (error) fail("予約", error);
  return data
    .map((r) => {
      const slot = r.interview_slots as unknown as { start_at: string; end_at: string };
      const employee = r.employees as unknown as { name: string } | null;
      return {
        id: r.id,
        applicant_name: r.applicant_name,
        phone: r.phone,
        email: r.email,
        created_at: r.created_at,
        start_at: slot.start_at,
        end_at: slot.end_at,
        interviewer_name: employee?.name ?? null,
      };
    })
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
}

// ---------------------------------------------------------------------
// 面接の進め方（質問フロー）
// ---------------------------------------------------------------------

/** 質問フローを読む。SQL（interview_guide 列の追加）がまだなら needsSetup を返す */
export async function getInterviewGuide(
  storeId: string,
): Promise<{ needsSetup: true } | { needsSetup: false; items: GuideItem[] }> {
  const { data, error } = await db().from("stores").select("interview_guide").eq("id", storeId).maybeSingle();
  if (error) {
    if (error.code === "42703" || /interview_guide/.test(error.message)) return { needsSetup: true };
    fail("面接の進め方", error);
  }
  return { needsSetup: false, items: parseGuide(data?.interview_guide) };
}

/** 面接画面の見出し用：予約者の名前と時間（その店舗の予約だけ） */
export async function getReservationBrief(
  storeId: string,
  reservationId: string,
): Promise<{ name: string; start_at: string } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(reservationId)) return null;
  const { data, error } = await db()
    .from("reservations")
    .select("applicant_name, interview_slots(start_at)")
    .eq("id", reservationId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) fail("予約", error);
  if (!data) return null;
  const slot = data.interview_slots as unknown as { start_at: string } | null;
  return slot ? { name: data.applicant_name, start_at: slot.start_at } : null;
}
