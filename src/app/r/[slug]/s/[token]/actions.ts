"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { failure, type ActionState } from "@/lib/action-state";
import { db, getStoreBySlug } from "@/lib/data/store";

/**
 * 応募者が自分で、面接を辞退する／日時を変更する。
 * 面接の開始前で、まだ面接前（booked）の予約だけ。枠は空けて、ほかの人が予約できるようにする。
 */
const schema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
  token: z.guid(),
  mode: z.enum(["decline", "change"]),
});

export async function cancelByApplicant(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("ページのURLが正しくありません。");
  const { slug, token, mode } = parsed.data;
  const store = await getStoreBySlug(slug);
  if (!store) return failure("お店が見つかりません。");

  const { data, error } = await db()
    .from("reservations")
    .update({
      status: "canceled",
      slot_id: null,
      canceled_reason: mode === "change" ? "日時変更" : "辞退",
      updated_at: new Date().toISOString(),
    })
    .eq("store_id", store.id)
    .eq("status_token", token)
    .eq("status", "booked")
    .gt("interview_at", new Date().toISOString())
    .select("id");
  if (error) {
    console.error(error);
    return failure("手続きできませんでした。時間をおいてもう一度お試しいただくか、お店に直接ご連絡ください。");
  }
  if (data.length === 0) {
    refresh();
    return failure("面接の時間を過ぎたか、すでに手続き済みのため、変更できません。お店に直接ご連絡ください。");
  }
  if (mode === "change") redirect(`/r/${slug}?changed=1&from=${token}`);
  refresh();
  return { ok: true, message: "面接を辞退しました。ご連絡ありがとうございました。" };
}
