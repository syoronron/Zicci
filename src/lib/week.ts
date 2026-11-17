import { addDays, isDateString, mondayOf, todayJst } from "@/lib/time";

export type Week = { from: string; to: string; days: string[] };

/** URL の ?week=YYYY-MM-DD から週（月曜〜日曜）を決める。不正なら今週 */
export function resolveWeek(param: string | string[] | undefined): Week {
  const value = typeof param === "string" && isDateString(param) ? param : todayJst();
  const from = mondayOf(value);
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  return { from, to: days[6], days };
}
