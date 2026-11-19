import "server-only";

import { listBookableSlots, listReservations, type Store } from "@/lib/data/store";
import { bookingUrl } from "@/lib/site-url";
import { addDays, formatPhone, formatTime, jstToDate, todayJst, toJst } from "@/lib/time";
import type { CalendarReservation } from "./reservation-calendar";

/** 新しい予約として表示する期間（予約が入ってから） */
export const NEW_BOOKING_HOURS = 48;

/**
 * 予約カレンダーと「結果の連絡を待っている人」に使うデータ。
 * 31日前以降に面接がある予約（先月面接して選考中の人も含める）。
 */
export async function loadReservations(store: Store) {
  const today = todayJst();
  const [reservations, url, bookable] = await Promise.all([
    listReservations(store.id, jstToDate(addDays(today, -31), 0).toISOString()),
    bookingUrl(store.public_slug),
    listBookableSlots(store.id),
  ]);
  // 日付ごとの、応募者がいま予約できる面接枠（開始時刻）
  const openSlots: Record<string, string[]> = {};
  for (const slot of bookable) {
    const t = toJst(slot.start_at);
    (openSlots[t.date] ??= []).push(formatTime(t.minutes));
  }
  const origin = new URL(url).origin;

  const calendar: CalendarReservation[] = reservations.map((r) => {
    const start = toJst(r.start_at);
    const end = toJst(r.end_at);
    return {
      id: r.id,
      date: start.date,
      start: formatTime(start.minutes),
      end: formatTime(end.minutes || 1440),
      name: r.applicant_name,
      phone: r.phone ? formatPhone(r.phone) : null,
      phoneRaw: r.phone,
      email: r.email,
      interviewer: r.interviewer_name,
      status: r.status,
      resultDue: r.result_due,
      firstDayDate: r.first_day_at ? toJst(r.first_day_at).date : null,
      firstDayTime: r.first_day_at ? formatTime(toJst(r.first_day_at).minutes) : null,
      statusUrl: r.status_token ? `${origin}/r/${store.public_slug}/s/${r.status_token}` : null,
      canceledReason: r.canceled_reason,
      createdAt: r.created_at,
      acknowledged: r.acknowledged,
      evaluation: r.evaluation,
      hasRecord: r.has_record,
    };
  });

  // 結果の連絡を待っている人（期限の近い順）
  const waiting = calendar
    .filter((r) => r.status === "interviewed" && r.resultDue)
    .sort((a, b) => (a.resultDue ?? "").localeCompare(b.resultDue ?? ""));

  // 今日の面接（取り消しを除く・時間順）
  const todays = calendar
    .filter((r) => r.date === today && r.status !== "canceled")
    .sort((a, b) => a.start.localeCompare(b.start));

  // 新しい予約：代表者がまだ確認していない、これからの面接（新しい順）
  // 確認の記録（SQL 20261122000000）がまだなければ、この48時間に入った予約
  const now = Date.now();
  const canAcknowledge = reservations.some((r) => r.acknowledged !== null) || reservations.length === 0;
  const fresh = calendar
    .filter(
      (r) =>
        r.status !== "canceled" &&
        r.date >= today &&
        (r.acknowledged === null
          ? now - Date.parse(r.createdAt) <= NEW_BOOKING_HOURS * 60 * 60_000
          : r.acknowledged === false),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return { today, now, calendar, waiting, todays, fresh, canAcknowledge, openSlots, bookingUrl: url };
}
