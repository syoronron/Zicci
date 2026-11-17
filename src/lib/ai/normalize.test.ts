import { describe, expect, it } from "vitest";
import { normalizeReadResult, parseLooseTime } from "./normalize";

const week = ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29"];

describe("parseLooseTime", () => {
  it("いろいろな書き方の時刻を読める", () => {
    expect(parseLooseTime("10")).toBe(600);
    expect(parseLooseTime("10:30")).toBe(630);
    expect(parseLooseTime("１０：３０")).toBe(630);
    expect(parseLooseTime("10時")).toBe(600);
    expect(parseLooseTime("10時30分")).toBe(630);
    expect(parseLooseTime("1030")).toBe(630);
    expect(parseLooseTime("休")).toBeNull();
  });
});

describe("normalizeReadResult", () => {
  it("時刻をそろえ、15分刻みに丸め、週の外の日付を捨てる", () => {
    const r = normalizeReadResult(
      [
        {
          name: " 田中 ",
          shifts: [
            { date: "2026-11-23", start: "10", end: "16" },
            { date: "2026-11-24", start: "9:50", end: "15:08" },
            { date: "2026-12-01", start: "10", end: "16" },
          ],
        },
      ],
      week,
    );
    expect(r.people).toEqual([
      {
        name: "田中",
        entries: [
          { date: "2026-11-23", start: "10:00", end: "16:00" },
          { date: "2026-11-24", start: "09:45", end: "15:15" },
        ],
      },
    ]);
  });

  it("日をまたぐ勤務は24:00まで、読めない時刻はメモに残す", () => {
    const r = normalizeReadResult(
      [
        {
          name: "佐藤",
          shifts: [
            { date: "2026-11-23", start: "18", end: "2" },
            { date: "2026-11-24", start: "?", end: "22" },
          ],
        },
      ],
      week,
    );
    expect(r.people[0].entries).toEqual([{ date: "2026-11-23", start: "18:00", end: "24:00" }]);
    expect(r.notes.length).toBe(2);
  });

  it("同じ名前の人は1人にまとめ、同じ日の2件目はメモに残す", () => {
    const r = normalizeReadResult(
      [
        { name: "鈴木", shifts: [{ date: "2026-11-25", start: "10", end: "12" }, { date: "2026-11-25", start: "17", end: "22" }] },
        { name: "鈴木", shifts: [] },
      ],
      week,
    );
    expect(r.people).toHaveLength(1);
    expect(r.people[0].entries).toHaveLength(1);
    expect(r.notes).toHaveLength(1);
  });
});
