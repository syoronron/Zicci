/**
 * AI が読み取ったシフトを、Zicci の入力欄で扱える形に整える（AI を呼ばない純粋な処理）。
 *
 * - 時刻は "10" "10時" "10:00" "１０：３０" などの書き方を "10:00" 形式にそろえる
 * - 入力欄に合わせて15分刻みに丸める
 * - 日をまたぐ勤務（例：18-26）は 24:00 までにする（面接は深夜に入れないため）
 * - 対象の週以外の日付や、読み取れない値は捨てて、メモに残す
 */

export type RawReadPerson = {
  name: string;
  shifts: { date: string; start: string; end: string }[];
};

export type ReadPerson = {
  name: string;
  entries: { date: string; start: string; end: string }[];
};

/** 全角数字・全角コロンを半角に */
function toHalfWidth(s: string): string {
  return s.replace(/[０-９：]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

/** "10" "10時" "10:30" "10時30分" "1030" → 分。読めなければ null */
export function parseLooseTime(value: string): number | null {
  const s = toHalfWidth(value).trim().replace(/\s/g, "");
  let m = /^(\d{1,2})(?::|時)?(\d{2})?分?$/.exec(s);
  if (!m) m = /^(\d{1,2})(\d{2})$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h > 30 || min > 59) return null;
  return h * 60 + min;
}

function fmt(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

const round15 = (m: number) => Math.round(m / 15) * 15;

export function normalizeReadResult(
  people: RawReadPerson[],
  weekDays: string[],
): { people: ReadPerson[]; notes: string[] } {
  const notes: string[] = [];
  const result: ReadPerson[] = [];
  const seen = new Set<string>();

  for (const p of people) {
    const name = p.name.replace(/\s+/g, " ").trim().slice(0, 30);
    if (!name || seen.has(name)) continue;
    seen.add(name);

    const entries: ReadPerson["entries"] = [];
    for (const s of p.shifts) {
      if (!weekDays.includes(s.date)) continue; // 対象の週以外は使わない
      if (entries.some((e) => e.date === s.date)) {
        notes.push(`${name}さんの${s.date.slice(5).replace("-", "/")}に2つ以上の勤務があったため、1つ目だけ入れました。`);
        continue;
      }
      const start = parseLooseTime(s.start);
      let end = parseLooseTime(s.end);
      if (start === null || end === null) {
        notes.push(`${name}さんの${s.date.slice(5).replace("-", "/")}の時刻が読み取れませんでした。`);
        continue;
      }
      if (end <= start && end + 24 * 60 > start) end += 24 * 60; // 例：18-2 → 18:00〜26:00
      const s15 = Math.min(round15(start), 23 * 60 + 45);
      const e15 = Math.min(round15(end), 24 * 60);
      if (e15 <= s15) {
        notes.push(`${name}さんの${s.date.slice(5).replace("-", "/")}の時刻がおかしいため、入れませんでした。`);
        continue;
      }
      if (end > 24 * 60) notes.push(`${name}さんの${s.date.slice(5).replace("-", "/")}は日をまたぐ勤務のため、24:00までにしました。`);
      entries.push({ date: s.date, start: fmt(s15), end: fmt(e15) });
    }
    result.push({ name, entries });
  }
  return { people: result, notes };
}
