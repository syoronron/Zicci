import Link from "next/link";
import { STATUS_LABEL } from "@/lib/progress";
import { formatDateShort } from "@/lib/time";
import type { CalendarReservation } from "./reservation-calendar";

const NEW_BOOKING_HOURS = 48; // reservation-data.ts と同じ（表示用）


/** 「3時間前」「昨日」のような、予約が入った時期 */
function ago(iso: string, now: number): string {
  const min = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}時間前`;
  return `${Math.floor(h / 24)}日前`;
}

/** ホームのいちばん上：今日の面接 */
export function TodayInterviews({ list }: { list: CalendarReservation[] }) {
  return (
    <section className="border-2 border-ink bg-white">
      <h2 className="flex items-center justify-between border-b border-ink px-4 py-3 text-sm font-bold">
        <span className="flex items-center gap-2">
          <span className="inline-block size-1.5 bg-ink" aria-hidden />
          今日の面接
        </span>
        <span className="num text-xs font-normal text-gray">{list.length}件</span>
      </h2>
      {list.length === 0 ? (
        <p className="px-4 py-3 text-sm text-gray">今日の面接はありません。</p>
      ) : (
        <ul>
          {list.map((r) => (
            <li key={r.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
              <span className="num w-12 shrink-0 text-lg leading-tight font-bold">{r.start}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{r.name} さん</span>
                <span className="block text-xs text-gray">担当：{r.interviewer ?? "未定"}</span>
              </span>
              {r.status === "booked" ? (
                <Link
                  href={`/admin/guide/run?r=${r.id}`}
                  className="inline-flex min-h-11 shrink-0 items-center border border-ink bg-accent px-3 text-sm font-bold"
                >
                  面接を始める
                </Link>
              ) : (
                <Link
                  href={`/admin?d=${r.date}`}
                  className="inline-flex min-h-11 shrink-0 items-center border border-ink bg-white px-3 text-xs font-bold"
                >
                  {STATUS_LABEL[r.status]}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** ホームの上：この48時間に入った予約（新しい順） */
export function NewBookings({ list, now }: { list: CalendarReservation[]; now: number }) {
  return (
    <section className="border border-ink bg-white">
      <h2 className="flex items-center justify-between border-b border-ink px-4 py-3 text-sm font-bold">
        <span className="flex items-center gap-2">
          <span className="inline-block size-1.5 bg-ink" aria-hidden />
          新しい予約
          <span className="text-xs font-normal text-gray">（この{NEW_BOOKING_HOURS}時間）</span>
        </span>
        <span className="num text-xs font-normal text-gray">{list.length}件</span>
      </h2>
      {list.length === 0 ? (
        <p className="px-4 py-3 text-sm text-gray">新しい予約はありません。</p>
      ) : (
        <ul>
          {list.map((r) => (
            <li key={r.id} className="border-b border-line last:border-b-0">
              <Link href={`/admin?d=${r.date}`} className="flex min-h-14 items-center gap-3 px-4 py-2">
                <span className="bg-ink px-1.5 py-0.5 text-[10px] font-bold text-white">NEW</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{r.name} さん</span>
                  <span className="num block text-xs text-gray">
                    面接 {formatDateShort(r.date)} {r.start}〜
                  </span>
                </span>
                <span className="shrink-0 text-xs text-gray">{ago(r.createdAt, now)}に予約</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
