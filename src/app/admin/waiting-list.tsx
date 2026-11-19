import Link from "next/link";
import { dueInfo } from "@/lib/progress";
import { formatDateShort } from "@/lib/time";
import type { CalendarReservation } from "./reservation-calendar";

/** 結果の連絡を待っている人（期限の近い順。期限が近い・過ぎた人は赤） */
export function WaitingList({ waiting, today }: { waiting: CalendarReservation[]; today: string }) {
  if (waiting.length === 0) return null;
  return (
    <section className="border border-ink bg-white">
      <h2 className="flex items-center justify-between border-b border-ink px-4 py-3 text-sm font-bold">
        <span className="flex items-center gap-2">
          <span className="inline-block size-1.5 bg-ink" aria-hidden />
          結果の連絡を待っている人
        </span>
        <span className="num text-xs font-normal text-gray">{waiting.length}人</span>
      </h2>
      <ul>
        {waiting.map((r) => {
          const info = dueInfo(r.resultDue!, today);
          return (
            <li key={r.id} className="border-b border-line last:border-b-0">
              <Link href={`/admin/reservations?d=${r.date}`} className="flex min-h-14 items-center gap-3 px-4 py-2">
                <span className="flex-1">
                  <span className="block font-bold">{r.name} さん</span>
                  <span className="num block text-xs text-gray">
                    面接 {formatDateShort(r.date)} ／ 期限 {formatDateShort(r.resultDue!)}
                  </span>
                </span>
                <span
                  className={`shrink-0 px-2 py-1 text-xs font-bold ${
                    info.level === "overdue"
                      ? "bg-danger text-white"
                      : info.level === "ok"
                        ? "border border-line text-gray"
                        : "border border-danger text-danger"
                  }`}
                >
                  {info.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
