"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { cancelReservation } from "./actions";

export type CalendarReservation = {
  id: string;
  date: string; // YYYY-MM-DD（日本時間）
  start: string; // HH:MM
  end: string;
  name: string;
  phone: string | null; // 表示用（ハイフン付き）
  phoneRaw: string | null; // 発信用
  email: string | null;
  interviewer: string | null;
};

const WEEK = ["月", "火", "水", "木", "金", "土", "日"];

/** "YYYY-MM" の月の、カレンダーに並べる日付（月曜始まり。前後の空きは null） */
function monthCells(month: string): (string | null)[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // 月曜=0
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) cells.push(`${month}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function dayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日（${["日", "月", "火", "水", "木", "金", "土"][d.getUTCDay()]}）`;
}

/** 予約のカレンダー。日付をタップすると、その日の予約が時間順に並ぶ */
export function ReservationCalendar({ reservations, today }: { reservations: CalendarReservation[]; today: string }) {
  const upcoming = reservations.find((r) => r.date >= today);
  const [selected, setSelected] = useState(upcoming?.date ?? today);
  const [month, setMonth] = useState(selected.slice(0, 7));

  const byDate = new Map<string, CalendarReservation[]>();
  for (const r of reservations) byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]);
  const dayList = (byDate.get(selected) ?? []).slice().sort((a, b) => a.start.localeCompare(b.start));
  const upcomingCount = reservations.filter((r) => r.date >= today).length;
  const [y, m] = month.split("-").map(Number);

  return (
    <section className="border border-ink bg-white">
      {/* 見出し */}
      <div className="flex items-center justify-between gap-2 border-b border-ink px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <span className="inline-block size-1.5 bg-ink" aria-hidden />
          面接の予約
        </h2>
        <span className="num text-xs text-gray">これから {upcomingCount}件</span>
      </div>

      {/* 月の切り替え */}
      <div className="flex items-center justify-between px-2 pt-2">
        <button
          type="button"
          onClick={() => setMonth(shiftMonth(month, -1))}
          className="num flex size-10 items-center justify-center border border-ink"
          aria-label="前の月"
        >
          ←
        </button>
        <span className="num text-base font-bold" data-testid="month">
          {y}年{m}月
        </span>
        <button
          type="button"
          onClick={() => setMonth(shiftMonth(month, 1))}
          className="num flex size-10 items-center justify-center border border-ink"
          aria-label="次の月"
        >
          →
        </button>
      </div>

      {/* カレンダー */}
      <div className="px-2 pt-2 pb-3">
        <div className="grid grid-cols-7 text-center text-[11px] text-gray">
          {WEEK.map((w, i) => (
            <span key={w} className={`py-1 ${i === 5 ? "text-[#2f5d9e]" : i === 6 ? "text-danger" : ""}`}>
              {w}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {monthCells(month).map((date, i) => {
            if (!date) return <span key={`blank-${i}`} />;
            const count = byDate.get(date)?.length ?? 0;
            const isSelected = date === selected;
            const isToday = date === today;
            const past = date < today;
            return (
              <button
                key={date}
                type="button"
                onClick={() => setSelected(date)}
                aria-pressed={isSelected}
                aria-label={`${dayLabel(date)} 予約${count}件`}
                className={`relative flex h-14 flex-col items-center justify-start border pt-1 ${
                  isSelected
                    ? "border-ink bg-ink text-white"
                    : isToday
                      ? "border-ink bg-white"
                      : "border-line bg-white"
                } ${past && !isSelected ? "text-mist" : ""}`}
              >
                <span className="num text-sm leading-none font-semibold">{Number(date.slice(8))}</span>
                {isToday && !isSelected && <span className="mt-0.5 text-[9px] leading-none font-bold">今日</span>}
                {count > 0 && (
                  <span
                    className={`num absolute right-1 bottom-1 left-1 py-0.5 text-[10px] leading-none font-bold ${
                      isSelected ? "bg-white text-ink" : past ? "bg-line text-gray" : "bg-ink text-white"
                    }`}
                  >
                    {count}件
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 選んだ日の予約 */}
      <div className="border-t border-ink px-4 py-3">
        <p className="text-sm font-bold">
          {dayLabel(selected)}
          <span className="num ml-2 text-xs font-normal text-gray">{dayList.length}件</span>
        </p>
        {dayList.length === 0 ? (
          <p className="mt-2 text-sm text-gray">この日の予約はありません。</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {dayList.map((r) => (
              <li key={r.id} className="grid grid-cols-[3.5rem_1fr] gap-3">
                <div className="num border-r border-ink pr-2 text-right">
                  <p className="text-lg leading-tight font-bold">{r.start}</p>
                  <p className="text-[11px] text-gray">〜{r.end}</p>
                </div>
                <div>
                  <p className="text-base font-bold">{r.name} さん</p>
                  <p className="text-xs text-gray">担当：{r.interviewer ?? "未定"}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {r.phone && (
                      <a
                        href={`tel:${r.phoneRaw}`}
                        className="num inline-flex min-h-10 items-center border border-ink bg-white px-3 text-sm font-semibold"
                      >
                        {r.phone}
                      </a>
                    )}
                    {r.email && (
                      <a
                        href={`mailto:${r.email}`}
                        className="inline-flex min-h-10 max-w-full items-center truncate border border-ink bg-white px-3 text-sm"
                      >
                        メール
                      </a>
                    )}
                    {r.date >= today && (
                      <ActionForm
                        action={cancelReservation}
                        confirm={`${r.name}さんの予約を取り消しますか？応募者には自動で連絡されないので、必要なら電話などで伝えてください。`}
                        className="ml-auto"
                      >
                        <input type="hidden" name="id" value={r.id} />
                        <SubmitButton variant="danger" pendingText="…">
                          取り消す
                        </SubmitButton>
                      </ActionForm>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
