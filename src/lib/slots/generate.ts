import { addDays, weekdayOf } from "@/lib/time";

/**
 * 面接枠の自動生成ロジック（データベースに依存しない純粋な計算）。
 *
 * 考え方：
 *   面接担当者ごとに
 *     「勤務時間」から「出勤直後・退勤直前の除外時間」を削り、
 *     さらに「繁忙時間・休憩時間」を引いた残りが、その人の面接可能時間。
 *   その時間を面接の長さで区切り、1人でも対応できれば面接枠にする。
 */

/** 分単位の時間帯 [start, end) */
export type Interval = { start: number; end: number };

export type ShiftInput = {
  employeeId: string;
  date: string; // YYYY-MM-DD
  start: number; // 分
  end: number; // 分
};

export type BlockInput = {
  weekday: number | null; // null = 毎日
  start: number;
  end: number;
};

export type GenerateInput = {
  from: string; // 対象期間の初日（この日を含む）
  to: string; // 対象期間の最終日（この日を含む）
  interviewMinutes: number;
  bufferMinutes: number;
  shifts: ShiftInput[]; // 面接担当者のシフトだけを渡す
  blocks: BlockInput[];
  /** すでに埋まっている時間（予約済みの枠）。この時間とは重ならないように作る */
  occupied?: { date: string; start: number; end: number }[];
  /** この日時（同じ日なら分）より前の枠は作らない。過去に枠を作らないため */
  notBefore?: { date: string; minutes: number };
};

export type GeneratedSlot = {
  date: string;
  start: number;
  end: number;
  interviewerIds: string[];
};

/** a から b に含まれる時間帯を取り除く */
export function subtractIntervals(a: Interval[], b: Interval[]): Interval[] {
  let result = a;
  for (const cut of b) {
    const next: Interval[] = [];
    for (const iv of result) {
      if (cut.end <= iv.start || cut.start >= iv.end) {
        next.push(iv);
        continue;
      }
      if (cut.start > iv.start) next.push({ start: iv.start, end: cut.start });
      if (cut.end < iv.end) next.push({ start: cut.end, end: iv.end });
    }
    result = next;
  }
  return result;
}

/** 枠の開始時刻をそろえる間隔。30分の倍数なら30分刻み、それ以外は15分刻み */
function stepFor(interviewMinutes: number): number {
  return interviewMinutes % 30 === 0 ? 30 : 15;
}

export function generateSlots(input: GenerateInput): GeneratedSlot[] {
  const { interviewMinutes: len, bufferMinutes: buffer } = input;
  if (len <= 0) return [];
  const step = stepFor(len);
  const slots: GeneratedSlot[] = [];

  for (let date = input.from; date <= input.to; date = addDays(date, 1)) {
    if (input.notBefore && date < input.notBefore.date) continue;

    const weekday = weekdayOf(date);
    const blocked: Interval[] = input.blocks
      .filter((b) => b.weekday === null || b.weekday === weekday)
      .map((b) => ({ start: b.start, end: b.end }))
      .concat((input.occupied ?? []).filter((o) => o.date === date).map((o) => ({ start: o.start, end: o.end })));

    // 面接担当者ごとの面接可能時間
    const available = new Map<string, Interval[]>();
    for (const s of input.shifts) {
      if (s.date !== date) continue;
      const start = s.start + buffer;
      const end = s.end - buffer;
      if (end - start < len) continue;
      const free = subtractIntervals([{ start, end }], blocked);
      available.set(s.employeeId, [...(available.get(s.employeeId) ?? []), ...free]);
    }
    if (available.size === 0) continue;

    let earliest = 0;
    if (input.notBefore && date === input.notBefore.date) {
      earliest = input.notBefore.minutes;
    }

    // 1日の中で、そろえた時刻から順に枠を探す（枠同士は重ならない）
    let t = 0;
    while (t + len <= 24 * 60) {
      if (t < earliest) {
        t += step;
        continue;
      }
      const ids: string[] = [];
      for (const [employeeId, ivs] of available) {
        if (ivs.some((iv) => iv.start <= t && t + len <= iv.end)) ids.push(employeeId);
      }
      if (ids.length > 0) {
        slots.push({ date, start: t, end: t + len, interviewerIds: ids.sort() });
        t += len;
        // 次の開始時刻を刻みにそろえる
        t = Math.ceil(t / step) * step;
      } else {
        t += step;
      }
    }
  }
  return slots;
}
