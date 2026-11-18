import { describe, expect, it } from "vitest";
import { demoReadResult } from "./demo-result";

const week = ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29"];

describe("demoReadResult", () => {
  it("選んだ週の日付に当てはめ、終了が書かれていない日はメモにする", () => {
    const r = demoReadResult(week);
    expect(r.people.map((p) => p.name)).toEqual(["早川", "渡邉", "渡辺", "安部", "佐野"]);
    expect(r.people[0].entries).toEqual([
      { date: "2026-11-23", start: "10:00", end: "16:00" },
      { date: "2026-11-25", start: "11:00", end: "15:00" },
      { date: "2026-11-26", start: "10:00", end: "16:00" },
      { date: "2026-11-27", start: "10:00", end: "16:00" },
    ]);
    // 渡邉さんの金曜（17-L）は入らない
    expect(r.people[1].entries.some((e) => e.date === "2026-11-27")).toBe(false);
    expect(r.notes).toEqual(["渡邉さんの金曜日は「17-L」で終了時刻が書かれていないため、省きました。"]);
  });
});
