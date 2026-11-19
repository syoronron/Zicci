import "server-only";

import { listReservations, type Store } from "@/lib/data/store";
import { bookingUrl } from "@/lib/site-url";
import { addDays, formatPhone, formatTime, jstToDate, todayJst, toJst } from "@/lib/time";
import type { CalendarReservation } from "./reservation-calendar";

/**
 * 予約カレンダーと「結果の連絡を待っている人」に使うデータ。
 * 31日前以降に面接がある予約（先月面接して選考中の人も含める）。
 */
export async function loadReservations(store: Store) {
  const today = todayJst();
  const [reservations, url] = await Promise.all([
    listReservations(store.id, jstToDate(addDays(today, -31), 0).toISOString()),
    bookingUrl(store.public_slug),
  ]);
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
      evaluation: r.evaluation,
      hasRecord: r.has_record,
    };
  });

  // 結果の連絡を待っている人（期限の近い順）
  const waiting = calendar
    .filter((r) => r.status === "interviewed" && r.resultDue)
    .sort((a, b) => (a.resultDue ?? "").localeCompare(b.resultDue ?? ""));

  return { today, calendar, waiting, bookingUrl: url };
}
