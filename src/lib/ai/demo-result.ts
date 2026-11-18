import { normalizeReadResult, type RawReadPerson, type ReadPerson } from "./normalize";

/**
 * イベントのデモ用：AI 読み取りの結果をあらかじめ決めておく。
 *
 * 環境変数 SHIFT_READER_DEMO=1 のときだけ使われ、どんな写真を送っても、この内容が返る。
 * デモで使うシフト表の画像は、この内容に合わせて作る。
 * 日付ではなく曜日（月〜日）で決めているので、どの週を選んでも使える。
 *
 * ⚠️ イベントが終わったら、必ず SHIFT_READER_DEMO を削除すること（本物の写真を読まなくなるため）。
 */

/** 月〜日の順。null は休み。end が null の日は「17-L（ラストまで）」のように終了が書かれていない日 */
type Day = [start: string, end: string | null] | null;

export const DEMO_SHEET: { name: string; week: [Day, Day, Day, Day, Day, Day, Day] }[] = [
  { name: "田中", week: [["10:00", "16:00"], null, ["11:00", "15:00"], ["10:00", "16:00"], ["10:00", "16:00"], null, null] },
  { name: "佐藤", week: [["13:00", "22:00"], ["14:00", "18:00"], null, ["13:00", "22:00"], ["17:00", null], ["10:00", "22:00"], null] },
  { name: "鈴木", week: [null, ["10:00", "15:00"], ["10:00", "15:00"], null, ["10:00", "15:00"], ["10:00", "18:00"], ["10:00", "18:00"]] },
  { name: "高橋", week: [["17:00", "22:00"], ["17:00", "22:00"], null, ["17:00", "22:00"], null, ["11:00", "17:00"], ["11:00", "17:00"]] },
  { name: "伊藤", week: [["09:00", "14:00"], ["09:00", "14:00"], ["09:00", "14:00"], null, ["09:00", "14:00"], null, ["12:00", "20:00"]] },
];

const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];

/** 選ばれた週（月曜始まりの7日）に当てはめた読み取り結果 */
export function demoReadResult(weekDays: string[]): { people: ReadPerson[]; notes: string[] } {
  const notes: string[] = [];
  const raw: RawReadPerson[] = DEMO_SHEET.map((p) => ({
    name: p.name,
    shifts: p.week.flatMap((day, i) => {
      if (!day) return [];
      const [start, end] = day;
      if (end === null) {
        notes.push(`${p.name}さんの${WEEKDAYS[i]}曜日は「${Number(start.slice(0, 2))}-L」で終了時刻が書かれていないため、省きました。`);
        return [];
      }
      return [{ date: weekDays[i], start, end }];
    }),
  }));
  const normalized = normalizeReadResult(raw, weekDays);
  return { people: normalized.people, notes: [...notes, ...normalized.notes] };
}
