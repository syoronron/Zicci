/**
 * 日付と時刻のユーティリティ。
 *
 * - 日付は "YYYY-MM-DD" の文字列で扱う（日本時間の日付）
 * - 時刻は「0時からの経過分」の数値で扱う（例: 10:30 → 630）
 *
 * 文字列と数値で扱うことで、サーバーがどの国にあっても
 * タイムゾーンのずれが起きないようにしている。
 */

export const TIME_ZONE = "Asia/Tokyo";
const JST_OFFSET = "+09:00";

/** "10:30" や "10:30:00" → 630。形式が違えば null */
export function parseTime(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59 || (h === 24 && min !== 0)) return null;
  return h * 60 + min;
}

/** 630 → "10:30" */
export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function isDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** 日付に日数を足す */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 曜日。0=日曜 … 6=土曜 */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** その日を含む週の月曜日 */
export function mondayOf(date: string): string {
  const wd = weekdayOf(date);
  return addDays(date, wd === 0 ? -6 : 1 - wd);
}

/** 日本時間での「今日」 */
export function todayJst(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** 日本時間の日付＋時刻 → 実際の時刻（Date） */
export function jstToDate(date: string, minutes: number): Date {
  // 24:00 は翌日 0:00 として扱う
  const day = minutes >= 1440 ? addDays(date, 1) : date;
  return new Date(`${day}T${formatTime(minutes % 1440)}:00${JST_OFFSET}`);
}

/** 実際の時刻（ISO文字列など） → 日本時間の日付と時刻 */
export function toJst(value: string | Date): { date: string; minutes: number } {
  const d = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

export function weekdayLabel(weekday: number): string {
  return WEEKDAY_LABELS[weekday] ?? "";
}

/** "2026-12-02" → "12/2（火）" */
export function formatDateShort(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}/${d}（${weekdayLabel(weekdayOf(date))}）`;
}
