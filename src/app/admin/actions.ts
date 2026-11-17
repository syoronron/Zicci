"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { failure, success, type ActionState } from "@/lib/action-state";
import { db, listBlocks, listEmployees, listShifts, listSlots, requireStore } from "@/lib/data/store";
import { generateSlots } from "@/lib/slots/generate";
import { addDays, formatTime, jstToDate, parseTime, toJst } from "@/lib/time";
import { resolveWeek } from "@/lib/week";

/*
 * 店舗側の操作。
 * どの操作も「デモ店舗のデータか」をサーバー側で確認してから行う。
 * （P4 でログインを入れたら、ここで「ログイン中の店舗か」を確認する）
 */

// ---------- 入力チェック用の部品 ----------

const time = z
  .string()
  .transform((v) => parseTime(v))
  .refine((v): v is number => v !== null, "時刻の形式が正しくありません");
const uuid = z.string().uuid("不正なIDです");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付の形式が正しくありません");

type Parsed<T> = { error: string; data?: never } | { error?: never; data: T };

function parse<T extends z.ZodTypeAny>(schema: T, formData: FormData): Parsed<z.infer<T>> {
  const result = schema.safeParse(Object.fromEntries(formData));
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "入力内容を確認してください" };
  }
  return { data: result.data };
}

/** データベースのエラーを、店長に伝わる言葉に変える */
function explain(error: { code?: string; message: string }, conflictMessage?: string): string {
  switch (error.code) {
    case "23505":
      return conflictMessage ?? "同じ内容がすでに登録されています。";
    case "23P01":
      return conflictMessage ?? "時間が重なっています。";
    case "23514":
      return "入力内容が条件を満たしていません（開始時刻は終了時刻より前にしてください）。";
    default:
      console.error(error);
      return "保存に失敗しました。時間をおいてもう一度お試しください。";
  }
}

// ---------- 店舗設定 ----------

const storeSchema = z.object({
  name: z.string().trim().min(1, "店舗名を入力してください").max(50, "店舗名は50文字以内です"),
  address: z.string().trim().max(100, "住所は100文字以内です"),
  interview_minutes: z.coerce.number().refine((v) => [30, 45, 60].includes(v), "面接時間を選んでください"),
  shift_buffer_minutes: z.coerce
    .number()
    .refine((v) => [0, 10, 15, 20, 30].includes(v), "除外時間を選んでください"),
});

export async function updateStore(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parse(storeSchema, formData);
  if (parsed.error !== undefined) return failure(parsed.error);
  const store = await requireStore();
  const { error } = await db()
    .from("stores")
    .update({ ...parsed.data, address: parsed.data.address || null })
    .eq("id", store.id);
  if (error) return failure(explain(error));
  refresh();
  return success("店舗設定を保存しました。");
}

const blockSchema = z
  .object({
    weekday: z
      .string()
      .transform((v) => (v === "" ? null : Number(v)))
      .refine((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 6), "曜日を選んでください"),
    kind: z.enum(["busy", "break"], { message: "種類を選んでください" }),
    start: time,
    end: time,
  })
  .refine((v) => v.start < v.end, "開始時刻は終了時刻より前にしてください");

export async function addBlock(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parse(blockSchema, formData);
  if (parsed.error !== undefined) return failure(parsed.error);
  const store = await requireStore();
  const { weekday, kind, start, end } = parsed.data;
  const { error } = await db()
    .from("store_blocks")
    .insert({ store_id: store.id, weekday, kind, start_time: formatTime(start), end_time: formatTime(end) });
  if (error) return failure(explain(error));
  refresh();
  return success("面接NGの時間帯を追加しました。");
}

export async function deleteBlock(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parse(z.object({ id: uuid }), formData);
  if (parsed.error !== undefined) return failure(parsed.error);
  const store = await requireStore();
  const { error } = await db().from("store_blocks").delete().eq("id", parsed.data.id).eq("store_id", store.id);
  if (error) return failure(explain(error));
  refresh();
  return success("削除しました。");
}

// ---------- スタッフ ----------

const employeeSchema = z.object({
  name: z.string().trim().min(1, "名前を入力してください").max(30, "名前は30文字以内です"),
  is_interviewer: z
    .string()
    .optional()
    .transform((v) => v === "on"),
});

export async function addEmployee(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parse(employeeSchema, formData);
  if (parsed.error !== undefined) return failure(parsed.error);
  const store = await requireStore();
  const { error } = await db()
    .from("employees")
    .insert({ store_id: store.id, ...parsed.data });
  if (error) return failure(explain(error, "同じ名前のスタッフがすでに登録されています。"));
  refresh();
  return success(`${parsed.data.name}さんを追加しました。`);
}

export async function setInterviewer(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parse(z.object({ id: uuid, value: z.enum(["true", "false"]) }), formData);
  if (parsed.error !== undefined) return failure(parsed.error);
  const store = await requireStore();
  const { error } = await db()
    .from("employees")
    .update({ is_interviewer: parsed.data.value === "true" })
    .eq("id", parsed.data.id)
    .eq("store_id", store.id);
  if (error) return failure(explain(error));
  refresh();
  return success("面接担当を更新しました。面接枠に反映するには「面接枠を作り直す」を押してください。");
}

export async function deleteEmployee(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parse(z.object({ id: uuid }), formData);
  if (parsed.error !== undefined) return failure(parsed.error);
  const store = await requireStore();
  const { error } = await db().from("employees").delete().eq("id", parsed.data.id).eq("store_id", store.id);
  if (error) return failure(explain(error));
  refresh();
  return success("スタッフを削除しました。");
}

// ---------- シフト ----------

const shiftTimes = z
  .object({ start: time, end: time })
  .refine((v) => v.start < v.end, "開始時刻は終了時刻より前にしてください");

const SHIFT_CONFLICT = "この人の別のシフトと時間が重なっています。";

export async function addShift(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parse(
    z.object({ employee_id: uuid, date }).and(shiftTimes),
    formData,
  );
  if (parsed.error !== undefined) return failure(parsed.error);
  const store = await requireStore();
  const { employee_id, date: day, start, end } = parsed.data;

  // 自分の店舗のスタッフかどうか確認
  const { data: employee } = await db()
    .from("employees")
    .select("id")
    .eq("id", employee_id)
    .eq("store_id", store.id)
    .maybeSingle();
  if (!employee) return failure("スタッフが見つかりません。");

  const { error } = await db().from("shifts").insert({
    store_id: store.id,
    employee_id,
    date: day,
    start_time: formatTime(start),
    end_time: formatTime(end),
    source: "manual",
  });
  if (error) return failure(explain(error, SHIFT_CONFLICT));
  refresh();
  return success("シフトを追加しました。");
}

export async function updateShift(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parse(z.object({ id: uuid }).and(shiftTimes), formData);
  if (parsed.error !== undefined) return failure(parsed.error);
  const store = await requireStore();
  const { id, start, end } = parsed.data;
  const { error } = await db()
    .from("shifts")
    .update({ start_time: formatTime(start), end_time: formatTime(end), source: "manual" })
    .eq("id", id)
    .eq("store_id", store.id);
  if (error) return failure(explain(error, SHIFT_CONFLICT));
  refresh();
  return success("シフトを更新しました。");
}

export async function deleteShift(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parse(z.object({ id: uuid }), formData);
  if (parsed.error !== undefined) return failure(parsed.error);
  const store = await requireStore();
  const { error } = await db().from("shifts").delete().eq("id", parsed.data.id).eq("store_id", store.id);
  if (error) return failure(explain(error));
  refresh();
  return success("シフトを削除しました。");
}

// ---------- 面接枠 ----------

export async function regenerateSlots(_: ActionState, formData: FormData): Promise<ActionState> {
  const week = resolveWeek(String(formData.get("week") ?? ""));
  const store = await requireStore();
  const [blocks, employees, shifts, existing] = await Promise.all([
    listBlocks(store.id),
    listEmployees(store.id),
    listShifts(store.id, week.from, week.to),
    listSlots(store.id, week.from, week.to),
  ]);
  const interviewerIds = new Set(employees.filter((e) => e.is_interviewer).map((e) => e.id));

  const slots = generateSlots({
    from: week.from,
    to: week.to,
    interviewMinutes: store.interview_minutes,
    bufferMinutes: store.shift_buffer_minutes,
    blocks,
    // 予約済みの枠は残すので、その時間には新しい枠を作らない
    occupied: existing
      .filter((s) => s.reserved)
      .map((s) => {
        const start = toJst(s.start_at);
        const end = toJst(s.end_at);
        return { date: start.date, start: start.minutes, end: end.date === start.date ? end.minutes : 24 * 60 };
      }),
    shifts: shifts
      .filter((s) => interviewerIds.has(s.employee_id))
      .map((s) => ({ employeeId: s.employee_id, date: s.date, start: s.start, end: s.end })),
    notBefore: toJst(new Date()),
  });

  const { data, error } = await db().rpc("regenerate_slots", {
    p_store_id: store.id,
    p_from: jstToDate(week.from, 0).toISOString(),
    p_to: jstToDate(addDays(week.to, 1), 0).toISOString(),
    p_slots: slots.map((s) => ({
      start_at: jstToDate(s.date, s.start).toISOString(),
      end_at: jstToDate(s.date, s.end).toISOString(),
      interviewer_ids: s.interviewerIds,
    })),
  });
  if (error) return failure(explain(error));
  refresh();
  if (interviewerIds.size === 0) {
    return failure("面接担当のスタッフがいません。「スタッフ」で面接担当を選んでください。");
  }
  return success(
    data === 0
      ? "作れる面接枠がありませんでした。面接担当のシフトや繁忙時間を確認してください。"
      : `面接枠を${data}件作りました（まだ公開されていません）。`,
  );
}

export async function toggleSlot(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parse(z.object({ id: uuid }), formData);
  if (parsed.error !== undefined) return failure(parsed.error);
  const store = await requireStore();
  const { data: slot, error: readError } = await db()
    .from("interview_slots")
    .select("id, status, reservations(id)")
    .eq("id", parsed.data.id)
    .eq("store_id", store.id)
    .maybeSingle();
  if (readError) return failure(explain(readError));
  if (!slot) return failure("面接枠が見つかりません。");
  const r = slot.reservations as unknown;
  if (Array.isArray(r) ? r.length > 0 : r != null) return failure("予約済みの枠は変更できません。");

  const next = slot.status === "closed" ? "draft" : "closed";
  const { error } = await db()
    .from("interview_slots")
    .update({ status: next })
    .eq("id", slot.id)
    .eq("store_id", store.id);
  if (error) return failure(explain(error));
  refresh();
  return success(next === "closed" ? "この枠を受け付けない設定にしました。" : "この枠を公開待ちに戻しました。");
}

export async function publishSlots(_: ActionState, formData: FormData): Promise<ActionState> {
  const week = resolveWeek(String(formData.get("week") ?? ""));
  const store = await requireStore();
  const { data, error } = await db()
    .from("interview_slots")
    .update({ status: "published" })
    .eq("store_id", store.id)
    .eq("status", "draft")
    .gte("start_at", jstToDate(week.from, 0).toISOString())
    .lt("start_at", jstToDate(addDays(week.to, 1), 0).toISOString())
    .select("id");
  if (error) return failure(explain(error));
  refresh();
  return data.length === 0
    ? failure("公開待ちの面接枠がありません。")
    : success(`${data.length}件の面接枠を公開しました。`);
}
