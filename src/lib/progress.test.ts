import { describe, expect, it } from "vitest";
import { dueInfo, milestones, resultDueDate } from "./progress";

const states = (s: Parameters<typeof milestones>[0]) => milestones(s).map((m) => m.state).join(",");

describe("progress", () => {
  it("段階ごとに、どこまで進んだかを表す", () => {
    expect(states("booked")).toBe("done,current,todo,todo");
    expect(states("interviewed")).toBe("done,done,done,current");
    expect(states("passed")).toBe("done,done,done,done");
    expect(states("rejected")).toBe("done,done,done,done");
  });
  it("結果連絡の期限", () => {
    expect(resultDueDate("2026-11-28", 3)).toBe("2026-12-01");
    expect(dueInfo("2026-11-20", "2026-11-22")).toMatchObject({ level: "overdue", label: "期限を2日過ぎています" });
    expect(dueInfo("2026-11-22", "2026-11-22").level).toBe("today");
    expect(dueInfo("2026-11-23", "2026-11-22").level).toBe("soon");
    expect(dueInfo("2026-11-25", "2026-11-22")).toMatchObject({ level: "ok", label: "期限まであと3日" });
  });
});
