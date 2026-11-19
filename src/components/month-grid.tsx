"use client";


/**
 * 月のカレンダー（月曜始まり）。カレンダーアプリのように、日付を押して選ぶ。
 * 店舗の予約・面接枠、応募者の予約ページで共通に使う。
 */

const WEEK = ["月", "火", "水", "木", "金", "土", "日"];

/** "YYYY-MM" の月の日付（前後の空きは null） */
export function monthCells(month: string): (string | null)[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // 月曜=0
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) cells.push(`${month}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function dayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日（${["日", "月", "火", "水", "木", "金", "土"][d.getUTCDay()]}）`;
}

export function MonthGrid({
  month,
  onMonthChange,
  canPrev = true,
  canNext = true,
  selected,
  onSelect,
  today,
  badge,
  mark,
  disabled,
  labelFor,
}: {
  month: string; // YYYY-MM
  onMonthChange: (month: string) => void;
  canPrev?: boolean;
  canNext?: boolean;
  selected: string | null;
  onSelect: (date: string) => void;
  today: string;
  /** 日付の下に出す件数など（なければ表示しない） */
  badge?: (date: string) => { text: string; tone: "ink" | "light" } | null;
  /** 右上の小さな印（例：空き枠がある日） */
  mark?: (date: string) => boolean;
  /** 押せない日 */
  disabled?: (date: string) => boolean;
  /** 読み上げ用の説明 */
  labelFor?: (date: string) => string;
}) {
  const [y, m] = month.split("-").map(Number);
  const navClass = "num flex size-10 items-center justify-center border border-ink disabled:border-mist disabled:text-mist";

  return (
    <div>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => onMonthChange(shiftMonth(month, -1))} disabled={!canPrev} className={navClass} aria-label="前の月">
          ←
        </button>
        <span className="num text-base font-bold" data-testid="month">
          {y}年{m}月
        </span>
        <button type="button" onClick={() => onMonthChange(shiftMonth(month, 1))} disabled={!canNext} className={navClass} aria-label="次の月">
          →
        </button>
      </div>

      <div className="mt-2 grid grid-cols-7 text-center text-[11px] text-gray">
        {WEEK.map((w, i) => (
          <span key={w} className={`py-1 ${i === 5 ? "text-[#2f5d9e]" : i === 6 ? "text-danger" : ""}`}>
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {monthCells(month).map((date, i) => {
          if (!date) return <span key={`blank-${i}`} />;
          const isSelected = date === selected;
          const isToday = date === today;
          const off = disabled?.(date) ?? false;
          const past = date < today;
          const b = badge?.(date) ?? null;
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(date)}
              disabled={off}
              aria-pressed={isSelected}
              aria-label={labelFor ? labelFor(date) : dayLabel(date)}
              className={`relative flex h-14 flex-col items-center justify-start border pt-1 ${
                isSelected ? "border-ink bg-ink text-white" : isToday ? "border-ink bg-white" : "border-line bg-white"
              } ${(past || off) && !isSelected ? "text-mist" : ""} disabled:cursor-default`}
            >
              <span className="num text-sm leading-none font-semibold">{Number(date.slice(8))}</span>
              {isToday && !isSelected && <span className="mt-0.5 text-[9px] leading-none font-bold">今日</span>}
              {mark?.(date) && (
                <span
                  className={`absolute top-1 right-1 size-2 rounded-full border ${isSelected ? "border-white" : "border-ink"}`}
                  aria-hidden
                />
              )}
              {b && (
                <span
                  className={`num absolute right-1 bottom-1 left-1 py-0.5 text-[10px] leading-none font-bold ${
                    isSelected ? "bg-white text-ink" : b.tone === "light" || past ? "bg-line text-gray" : "bg-ink text-white"
                  }`}
                >
                  {b.text}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
