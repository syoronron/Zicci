"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { failure, success, type ActionState } from "@/lib/action-state";
import { isAdmin } from "@/lib/auth";
import { guideSchema } from "@/lib/interview-guide";
import { recordSchema } from "@/lib/interview-record";
import {
  db,
  getAfterSettings,
  listBlocks,
  listEmployees,
  listShifts,
  listSlots,
  requireStore,
} from "@/lib/data/store";
import { resultDueDate } from "@/lib/progress";
import { generateSlots } from "@/lib/slots/generate";
import { addDays, formatTime, jstToDate, parseTime, toJst } from "@/lib/time";
import { resolveWeek } from "@/lib/week";

/*
 * 店舗側の操作。
 * どの操作も「デモ店舗のデータか」をサーバー側で確認してから行う。
 * （P4 でログインを入れたら、ここで「ログイン中の店舗か」を確認する）
 */

const LOGIN_REQUIRED = "ログインの有効期限が切れました。ページを再読み込みして、もう一度ログインしてください。";

// ---------- 入力チェック用の部品 ----------

const time = z
  .string()
  .transform((v) => parseTime(v))
  .refine((v): v is number => v !== null, "時刻の形式が正しくありません");
const uuid = z.guid("不正なIDです");
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
  if (!(await isAdmin())) return failure(LOGIN_REQUIRED);
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
  if (!(await isAdmin())) return failure(LOGIN_REQUIRED);
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
  if (!(await isAdmin())) return failure(LOGIN_REQUIRED);
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
  if (!(await isAdmin())) return failure(LOGIN_REQUIRED);
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
  if (!(await isAdmin())) return failure(LOGIN_REQUIRED);
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
  if (!(await isAdmin())) return failure(LOGIN_REQUIRED);
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
  if (!(await isAdmin())) return failure(LOGIN_REQUIRED);
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
  if (!(await isAdmin())) return failure(LOGIN_REQUIRED);
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
  if (!(await isAdmin())) return failure(LOGIN_REQUIRED);
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
  if (!(await isAdmin())) return failure(LOGIN_REQUIRED);
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
  if (!(await isAdmin())) return failure(LOGIN_REQUIRED);
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
  if (!(await isAdmin())) return failure(LOGIN_REQUIRED);
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
    : success(`${data.length}件の面接枠を公開しました。下の「予約ページを共有する」から応募者に送ってください。`);
}

// ---------- 予約 ----------

export async function cancelReservation(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return failure(LOGIN_REQUIRED);
  const parsed = parse(z.object({ id: uuid }), formData);
  if (parsed.error !== undefined) return failure(parsed.error);
  const store = await requireStore();
  const { data, error } = await db()
    .from("reservations")
    .delete()
    .eq("id", parsed.data.id)
    .eq("store_id", store.id)
    .select("id");
  if (error) return failure(explain(error));
  if (data.length === 0) return failure("予約が見つかりません。");
  refresh();
  return success("予約を取り消しました。この枠はふたたび予約できる状態に戻りました。");
}

// ---------- シフト表の取り込み（写真を見ながら入力 → 確認 → 登録） ----------

const importSchema = z.object({
  week: date,
  people: z
    .array(
      z.object({
        employeeId: uuid.nullable(),
        name: z.string().trim().min(1, "名前が空の人がいます").max(30, "名前は30文字以内です"),
        interviewer: z.boolean(),
        entries: z.array(z.object({ date, start: time, end: time, ai: z.boolean().optional() })).max(7),
      }),
    )
    .min(1, "スタッフがいません")
    .max(100),
});

/**
 * 面接担当に選んだ人の、その週のシフトをまとめて置き換える。
 * データベースを変更する前にすべての入力を確認し、問題があれば何も変更しない。
 */
export async function importShifts(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return failure(LOGIN_REQUIRED);

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return failure("送信内容を読み取れませんでした。もう一度お試しください。");
  }
  const parsed = importSchema.safeParse(raw);
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "入力内容を確認してください");

  const week = resolveWeek(parsed.data.week);
  if (week.from !== parsed.data.week) return failure("対象の週が正しくありません。");

  // ---- 1. 変更前の確認（ここで問題があれば、何も変更しない） ----
  const names = new Set<string>();
  for (const p of parsed.data.people) {
    if (names.has(p.name)) return failure(`「${p.name}」さんが2回登録されています。`);
    names.add(p.name);
    const days = new Set<string>();
    for (const e of p.entries) {
      if (!week.days.includes(e.date)) return failure(`${p.name}さんのシフトに、対象の週以外の日付があります。`);
      if (days.has(e.date)) return failure(`${p.name}さんの同じ日に2つのシフトがあります。`);
      days.add(e.date);
      if (e.start >= e.end) {
        return failure(`${p.name}さんの${e.date.slice(5).replace("-", "/")}：開始時刻は終了時刻より前にしてください。`);
      }
    }
  }

  const store = await requireStore();
  const employees = await listEmployees(store.id);
  const byId = new Map(employees.map((e) => [e.id, e]));
  const byName = new Map(employees.map((e) => [e.name, e]));
  for (const p of parsed.data.people) {
    if (p.employeeId && !byId.has(p.employeeId)) return failure("スタッフが見つかりません。画面を再読み込みしてください。");
  }

  // ---- 2. スタッフの追加と、面接担当の設定 ----
  const client = db();
  const ids = new Map<string, string>(); // name → employee id
  for (const p of parsed.data.people) {
    const existing = p.employeeId ? byId.get(p.employeeId) : byName.get(p.name);
    if (existing) {
      ids.set(p.name, existing.id);
      if (existing.is_interviewer !== p.interviewer) {
        const { error } = await client
          .from("employees")
          .update({ is_interviewer: p.interviewer })
          .eq("id", existing.id)
          .eq("store_id", store.id);
        if (error) return failure(explain(error));
      }
    } else {
      const { data, error } = await client
        .from("employees")
        .insert({ store_id: store.id, name: p.name, is_interviewer: p.interviewer })
        .select("id")
        .single();
      if (error) return failure(explain(error, `「${p.name}」さんはすでに登録されています。`));
      ids.set(p.name, data.id);
    }
  }

  // ---- 3. 面接担当のシフトを、その週の分だけ置き換える ----
  const targets = parsed.data.people.filter((p) => p.interviewer);
  const targetIds = targets.map((p) => ids.get(p.name)!);
  if (targetIds.length > 0) {
    const { error: deleteError } = await client
      .from("shifts")
      .delete()
      .eq("store_id", store.id)
      .in("employee_id", targetIds)
      .gte("date", week.from)
      .lte("date", week.to);
    if (deleteError) return failure(explain(deleteError));

    const rows = targets.flatMap((p) =>
      p.entries.map((e) => ({
        store_id: store.id,
        employee_id: ids.get(p.name)!,
        date: e.date,
        start_time: formatTime(e.start),
        end_time: formatTime(e.end),
        source: e.ai ? ("ai" as const) : ("manual" as const),
      })),
    );
    if (rows.length > 0) {
      const { error } = await client.from("shifts").insert(rows);
      if (error) return failure(explain(error, SHIFT_CONFLICT));
    }
  }

  refresh();
  const count = targets.reduce((n, p) => n + p.entries.length, 0);
  return success(`面接担当${targets.length}人・シフト${count}件を登録しました。`);
}

// ---------- 面接の進め方（質問フロー） ----------

export async function saveInterviewGuide(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return failure(LOGIN_REQUIRED);
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("items") ?? ""));
  } catch {
    return failure("送信内容を読み取れませんでした。もう一度お試しください。");
  }
  const parsed = guideSchema.safeParse(raw);
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "入力内容を確認してください");

  const store = await requireStore();
  const { error } = await db().from("stores").update({ interview_guide: parsed.data }).eq("id", store.id);
  if (error) {
    if (error.code === "42703" || /interview_guide/.test(error.message)) {
      return failure("データベースの準備ができていません。Supabase で面接の進め方用の SQL を実行してください。");
    }
    return failure(explain(error));
  }
  refresh();
  return success(`面接の進め方を保存しました（${parsed.data.length}項目）。`);
}

// ---------- 面接後の進み具合 ----------

const SETUP_NEEDED = "データベースの準備ができていません。Supabase で面接後の進み具合用の SQL を実行してください。";

/** 面接済み（選考中）にして、結果連絡の期限を決める */
export async function markInterviewed(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return failure(LOGIN_REQUIRED);
  const parsed = parse(z.object({ id: uuid }), formData);
  if (parsed.error !== undefined) return failure(parsed.error);
  const store = await requireStore();
  const settings = await getAfterSettings(store.id);
  if (!settings) return failure(SETUP_NEEDED);

  const { data: r, error: readError } = await db()
    .from("reservations")
    .select("id, interview_at, status")
    .eq("id", parsed.data.id)
    .eq("store_id", store.id)
    .maybeSingle();
  if (readError) return failure(explain(readError));
  if (!r) return failure("予約が見つかりません。");
  if (r.status !== "booked") return failure("この予約は、すでに面接済みか辞退されています。");

  const due = resultDueDate(toJst(r.interview_at).date, settings.result_days);
  const { error } = await db()
    .from("reservations")
    .update({ status: "interviewed", result_due: due, updated_at: new Date().toISOString() })
    .eq("id", r.id)
    .eq("store_id", store.id)
    .eq("status", "booked");
  if (error) return failure(explain(error));
  refresh();
  return success(`選考中にしました。結果連絡の期限は ${due.slice(5).replace("-", "/")} です。`);
}

/** 採用・見送りを決める（決めた結果は、応募者のページにすぐ表示される） */
export async function setResult(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return failure(LOGIN_REQUIRED);
  const parsed = parse(z.object({ id: uuid, result: z.enum(["passed", "rejected", "interviewed"]) }), formData);
  if (parsed.error !== undefined) return failure(parsed.error);
  const store = await requireStore();
  const settings = await getAfterSettings(store.id);
  if (!settings) return failure(SETUP_NEEDED);

  const { data: r, error: readError } = await db()
    .from("reservations")
    .select("id, interview_at, status, result_due")
    .eq("id", parsed.data.id)
    .eq("store_id", store.id)
    .maybeSingle();
  if (readError) return failure(explain(readError));
  if (!r) return failure("予約が見つかりません。");
  if (r.status === "canceled") return failure("辞退された予約は変更できません。");

  const { result } = parsed.data;
  const patch: Record<string, unknown> = { status: result, updated_at: new Date().toISOString() };
  // 「面接済み」を飛ばして結果を決めた場合も、期限は記録しておく
  if (!r.result_due) patch.result_due = resultDueDate(toJst(r.interview_at).date, settings.result_days);
  if (result !== "passed") patch.first_day_at = null;

  const { error } = await db()
    .from("reservations")
    .update(patch)
    .eq("id", r.id)
    .eq("store_id", store.id)
    .neq("status", "canceled");
  if (error) return failure(explain(error));
  refresh();
  return success(
    {
      passed: "採用にしました。応募者のページに入店案内が表示されます。初出勤の日時も入れてください。",
      rejected: "見送りにしました。応募者のページにお礼のメッセージが表示されます。",
      interviewed: "選考中に戻しました。",
    }[result],
  );
}

/** 採用した人の初出勤の日時（応募者のページの入店案内に表示） */
export async function setFirstDay(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return failure(LOGIN_REQUIRED);
  const parsed = parse(
    z.object({ id: uuid, date: z.union([date, z.literal("")]), time: z.union([time, z.literal("")]) }),
    formData,
  );
  if (parsed.error !== undefined) return failure(parsed.error);
  const { id, date: day, time: minutes } = parsed.data;
  if ((day === "") !== (minutes === "")) return failure("日付と時刻の両方を入れてください。");
  const store = await requireStore();
  const firstDay = day === "" || minutes === "" ? null : jstToDate(day, minutes).toISOString();
  const { data, error } = await db()
    .from("reservations")
    .update({ first_day_at: firstDay, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("store_id", store.id)
    .eq("status", "passed")
    .select("id");
  if (error) return failure(explain(error));
  if (data.length === 0) return failure("採用した予約だけに設定できます。");
  refresh();
  return success(firstDay ? "初出勤の日時を保存しました。応募者のページに表示されます。" : "初出勤の日時を消しました。");
}

const afterSchema = z.object({
  result_days: z.coerce.number().int().min(1, "1〜14日で選んでください").max(14, "1〜14日で選んでください"),
  onboarding_message: z.string().trim().min(1, "入店案内を入力してください").max(500, "入店案内は500文字以内です"),
  thanks_message: z.string().trim().min(1, "お礼のメッセージを入力してください").max(500, "お礼のメッセージは500文字以内です"),
});

/** 面接後の案内（結果連絡までの日数・入店案内・お礼の文） */
export async function updateAfterSettings(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return failure(LOGIN_REQUIRED);
  const parsed = parse(afterSchema, formData);
  if (parsed.error !== undefined) return failure(parsed.error);
  const store = await requireStore();
  const { error } = await db().from("stores").update(parsed.data).eq("id", store.id);
  if (error) {
    if (error.code === "42703") return failure(SETUP_NEEDED);
    return failure(explain(error));
  }
  refresh();
  return success("面接後の案内を保存しました。");
}

/** 応募者が辞退・日時変更で取り消した予約を、一覧から削除する（取り消し済みの予約だけ） */
export async function deleteCanceledReservation(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return failure(LOGIN_REQUIRED);
  const parsed = parse(z.object({ id: uuid }), formData);
  if (parsed.error !== undefined) return failure(parsed.error);
  const store = await requireStore();
  const { data, error } = await db()
    .from("reservations")
    .delete()
    .eq("id", parsed.data.id)
    .eq("store_id", store.id)
    .eq("status", "canceled")
    .select("id");
  if (error) return failure(explain(error));
  if (data.length === 0) return failure("取り消し済みの予約だけ削除できます。");
  refresh();
  return success("取り消された予約を削除しました。");
}

// ---------- 面接の記録 ----------

/**
 * 面接中の回答・評価・メモを保存する（面接画面で進むたびに自動で呼ばれる）。
 * 最後（completed）なら、面接前の予約を選考中に進めて、結果連絡の期限も決める。
 */
export async function saveInterviewRecord(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return failure(LOGIN_REQUIRED);
  const id = z.guid().safeParse(formData.get("id"));
  if (!id.success) return failure("予約が見つかりません。");
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("record") ?? ""));
  } catch {
    return failure("記録を読み取れませんでした。");
  }
  const parsed = recordSchema.safeParse(raw);
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "入力内容を確認してください");
  const record = { ...parsed.data, updatedAt: new Date().toISOString() };

  const store = await requireStore();
  const { data: r, error: readError } = await db()
    .from("reservations")
    .select("id, status, interview_at")
    .eq("id", id.data)
    .eq("store_id", store.id)
    .maybeSingle();
  if (readError) {
    if (readError.code === "42703") return failure(SETUP_NEEDED);
    return failure(explain(readError));
  }
  if (!r) return failure("予約が見つかりません。");
  if (r.status === "canceled") return failure("取り消された予約には記録できません。");

  const patch: Record<string, unknown> = { interview_record: record, updated_at: record.updatedAt };
  let due: string | null = null;
  if (record.completed && r.status === "booked") {
    const settings = await getAfterSettings(store.id);
    if (settings) {
      due = resultDueDate(toJst(r.interview_at).date, settings.result_days);
      patch.status = "interviewed";
      patch.result_due = due;
    }
  }
  const { error } = await db().from("reservations").update(patch).eq("id", r.id).eq("store_id", store.id);
  if (error) {
    if (error.code === "42703") return failure("データベースの準備ができていません。Supabase で面接の記録用の SQL を実行してください。");
    return failure(explain(error));
  }
  if (record.completed) refresh();
  return success(
    !record.completed
      ? "自動保存しました"
      : due
        ? `記録を保存し、選考中にしました。結果連絡の期限は ${due.slice(5).replace("-", "/")} です。`
        : "記録を保存しました。",
  );
}

// ---------- 新しい予約の「代表者の確認」 ----------

/** 新しい予約を確認済みにする（ids は1件でも複数でも可）。確認するとホームの「新しい予約」から外れる */
export async function acknowledgeReservations(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return failure(LOGIN_REQUIRED);
  const ids = formData.getAll("id").map(String);
  const parsed = z.array(uuid).min(1, "予約を選んでください").max(100).safeParse(ids);
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "予約が見つかりません。");
  const store = await requireStore();
  const { data, error } = await db()
    .from("reservations")
    .update({ acknowledged_at: new Date().toISOString() })
    .eq("store_id", store.id)
    .in("id", parsed.data)
    .is("acknowledged_at", null)
    .select("id");
  if (error) {
    if (error.code === "42703") {
      return failure("データベースの準備ができていません。Supabase で「代表者の確認」用の SQL を実行してください。");
    }
    return failure(explain(error));
  }
  refresh();
  return success(data.length > 1 ? `${data.length}件の予約を確認済みにしました。` : "確認済みにしました。");
}
