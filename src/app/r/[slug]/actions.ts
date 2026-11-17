"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { failure, type ActionState } from "@/lib/action-state";
import { BOOKING_MIN_LEAD_MINUTES, db } from "@/lib/data/store";

/** 全角の数字・記号を半角にし、ハイフンや空白を取り除く */
function normalizePhone(value: string): string {
  return value
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s\-‐－ー―()（）]/g, "");
}

const schema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/, "ページのURLが正しくありません"),
  slot_id: z.string().uuid("時間を選んでください"),
  name: z.string().trim().min(1, "お名前を入力してください").max(30, "お名前は30文字以内で入力してください"),
  phone: z
    .string()
    .transform(normalizePhone)
    .refine((v) => /^0\d{9,10}$/.test(v), "電話番号は 090-1234-5678 のような形で入力してください"),
  email: z
    .string()
    .trim()
    .max(100, "メールアドレスが長すぎます")
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "メールアドレスの形式が正しくありません"),
  // ロボットによる自動送信よけ（画面には表示しない欄。人が入力することはない）
  website: z.string().max(0).optional(),
});

const MESSAGES: Record<string, string> = {
  slot_taken: "申し訳ありません。この時間はたった今、ほかの方の予約が入りました。別の時間を選んでください。",
  slot_unavailable: "この時間は予約を受け付けていません。別の時間を選んでください。",
  slot_too_soon: "この時間は開始が近いため、予約できません。別の時間を選んでください。",
  store_not_found: "お店が見つかりません。URLを確認してください。",
};

export async function reserve(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "入力内容を確認してください");
  const { slug, slot_id, name, phone, email } = parsed.data;

  const { data, error } = await db().rpc("create_reservation", {
    p_store_slug: slug,
    p_slot_id: slot_id,
    p_name: name,
    p_phone: phone,
    p_email: email,
    p_min_lead: `${BOOKING_MIN_LEAD_MINUTES} minutes`,
  });

  if (error) {
    const key = Object.keys(MESSAGES).find((k) => error.message.includes(k));
    if (key) {
      refresh(); // 空き状況を最新にする
      return failure(MESSAGES[key]);
    }
    console.error(error);
    return failure("予約できませんでした。時間をおいてもう一度お試しください。");
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.reservation_id) return failure("予約できませんでした。時間をおいてもう一度お試しください。");
  redirect(`/r/${slug}/done?r=${row.reservation_id}`);
}
