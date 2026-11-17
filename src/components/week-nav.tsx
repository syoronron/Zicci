import Link from "next/link";
import { addDays, formatDateShort } from "@/lib/time";
import type { Week } from "@/lib/week";

/** 週の切り替え（前の週 / 次の週） */
export function WeekNav({ week, basePath }: { week: Week; basePath: string }) {
  const prev = addDays(week.from, -7);
  const next = addDays(week.from, 7);
  const linkClass = "flex size-11 items-center justify-center border border-ink bg-white num text-lg";
  return (
    <div className="flex items-center justify-between gap-2">
      <Link href={`${basePath}?week=${prev}`} className={linkClass} aria-label="前の週">
        ←
      </Link>
      <p className="num text-center text-sm font-semibold">
        {formatDateShort(week.from)} 〜 {formatDateShort(week.to)}
      </p>
      <Link href={`${basePath}?week=${next}`} className={linkClass} aria-label="次の週">
        →
      </Link>
    </div>
  );
}
