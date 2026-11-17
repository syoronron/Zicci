import { describe, expect, it } from "vitest";
import { formatTime, parseTime } from "@/lib/time";
import { generateSlots, subtractIntervals, type GenerateInput } from "./generate";

const t = (s: string) => parseTime(s)!;
const view = (slots: ReturnType<typeof generateSlots>) =>
  slots.map((s) => `${s.date} ${formatTime(s.start)}-${formatTime(s.end)} ${s.interviewerIds.join(",")}`);

// 2026-12-01 は火曜日
const base: GenerateInput = {
  from: "2026-12-01",
  to: "2026-12-01",
  interviewMinutes: 30,
  bufferMinutes: 0,
  shifts: [],
  blocks: [],
};

describe("subtractIntervals", () => {
  it("中央を削ると2つに分かれる", () => {
    expect(subtractIntervals([{ start: 600, end: 900 }], [{ start: 690, end: 810 }])).toEqual([
      { start: 600, end: 690 },
      { start: 810, end: 900 },
    ]);
  });
  it("全体を覆うと何も残らない", () => {
    expect(subtractIntervals([{ start: 600, end: 700 }], [{ start: 500, end: 800 }])).toEqual([]);
  });
});

describe("generateSlots", () => {
  it("勤務時間を30分ごとに区切る", () => {
    const slots = generateSlots({
      ...base,
      shifts: [{ employeeId: "a", date: "2026-12-01", start: t("10:00"), end: t("11:30") }],
    });
    expect(view(slots)).toEqual([
      "2026-12-01 10:00-10:30 a",
      "2026-12-01 10:30-11:00 a",
      "2026-12-01 11:00-11:30 a",
    ]);
  });

  it("出勤直後・退勤直前の除外時間を反映し、開始は30分刻みにそろえる", () => {
    const slots = generateSlots({
      ...base,
      bufferMinutes: 15,
      shifts: [{ employeeId: "a", date: "2026-12-01", start: t("10:00"), end: t("12:00") }],
    });
    // 面接可能 10:15〜11:45 → 10:30-11:00, 11:00-11:30
    expect(view(slots)).toEqual(["2026-12-01 10:30-11:00 a", "2026-12-01 11:00-11:30 a"]);
  });

  it("繁忙時間（毎日）を避ける", () => {
    const slots = generateSlots({
      ...base,
      shifts: [{ employeeId: "a", date: "2026-12-01", start: t("11:00"), end: t("14:30") }],
      blocks: [{ weekday: null, start: t("11:30"), end: t("13:30") }],
    });
    expect(view(slots)).toEqual([
      "2026-12-01 11:00-11:30 a",
      "2026-12-01 13:30-14:00 a",
      "2026-12-01 14:00-14:30 a",
    ]);
  });

  it("曜日指定の繁忙時間は、その曜日だけに効く", () => {
    const input: GenerateInput = {
      ...base,
      from: "2026-12-01", // 火
      to: "2026-12-02", // 水
      shifts: [
        { employeeId: "a", date: "2026-12-01", start: t("15:00"), end: t("16:00") },
        { employeeId: "a", date: "2026-12-02", start: t("15:00"), end: t("16:00") },
      ],
      blocks: [{ weekday: 3, start: t("15:00"), end: t("16:00") }], // 水曜だけ
    };
    expect(view(generateSlots(input))).toEqual([
      "2026-12-01 15:00-15:30 a",
      "2026-12-01 15:30-16:00 a",
    ]);
  });

  it("複数の担当者：1人でも対応できれば枠になり、対応できる人をすべて記録する", () => {
    const slots = generateSlots({
      ...base,
      shifts: [
        { employeeId: "a", date: "2026-12-01", start: t("10:00"), end: t("11:00") },
        { employeeId: "b", date: "2026-12-01", start: t("10:30"), end: t("11:30") },
      ],
    });
    expect(view(slots)).toEqual([
      "2026-12-01 10:00-10:30 a",
      "2026-12-01 10:30-11:00 a,b",
      "2026-12-01 11:00-11:30 b",
    ]);
  });

  it("同じ人の勤務が1日に2回あっても両方使う", () => {
    const slots = generateSlots({
      ...base,
      shifts: [
        { employeeId: "a", date: "2026-12-01", start: t("09:00"), end: t("09:30") },
        { employeeId: "a", date: "2026-12-01", start: t("18:00"), end: t("18:30") },
      ],
    });
    expect(view(slots)).toEqual(["2026-12-01 09:00-09:30 a", "2026-12-01 18:00-18:30 a"]);
  });

  it("面接時間45分なら15分刻みで、枠同士は重ならない", () => {
    const slots = generateSlots({
      ...base,
      interviewMinutes: 45,
      shifts: [{ employeeId: "a", date: "2026-12-01", start: t("10:00"), end: t("12:00") }],
    });
    expect(view(slots)).toEqual(["2026-12-01 10:00-10:45 a", "2026-12-01 10:45-11:30 a"]);
  });

  it("勤務が面接時間より短ければ枠はできない", () => {
    const slots = generateSlots({
      ...base,
      bufferMinutes: 15,
      shifts: [{ employeeId: "a", date: "2026-12-01", start: t("10:00"), end: t("10:45") }],
    });
    expect(slots).toEqual([]);
  });

  it("24:00 までの勤務も扱える", () => {
    const slots = generateSlots({
      ...base,
      shifts: [{ employeeId: "a", date: "2026-12-01", start: t("23:00"), end: t("24:00") }],
    });
    expect(view(slots)).toEqual(["2026-12-01 23:00-23:30 a", "2026-12-01 23:30-24:00 a"]);
  });

  it("過去の日・過去の時刻には枠を作らない", () => {
    const slots = generateSlots({
      ...base,
      from: "2026-11-30",
      to: "2026-12-01",
      shifts: [
        { employeeId: "a", date: "2026-11-30", start: t("10:00"), end: t("11:00") },
        { employeeId: "a", date: "2026-12-01", start: t("10:00"), end: t("12:00") },
      ],
      notBefore: { date: "2026-12-01", minutes: t("10:40") },
    });
    expect(view(slots)).toEqual(["2026-12-01 11:00-11:30 a", "2026-12-01 11:30-12:00 a"]);
  });

  it("予約済みの時間を避けて、その前後に枠を詰める", () => {
    const slots = generateSlots({
      ...base,
      interviewMinutes: 45,
      shifts: [{ employeeId: "a", date: "2026-12-01", start: t("13:30"), end: t("16:00") }],
      occupied: [{ date: "2026-12-01", start: t("14:00"), end: t("14:30") }],
    });
    // 13:30-14:00 は45分に足りない → 14:30 から
    expect(view(slots)).toEqual(["2026-12-01 14:30-15:15 a", "2026-12-01 15:15-16:00 a"]);
  });

  it("期間外のシフトは無視する", () => {
    const slots = generateSlots({
      ...base,
      shifts: [{ employeeId: "a", date: "2026-12-05", start: t("10:00"), end: t("11:00") }],
    });
    expect(slots).toEqual([]);
  });
});
