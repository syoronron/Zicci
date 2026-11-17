import { describe, expect, it } from "vitest";
import { formatPhone, jstToDate, mondayOf, parseTime, toJst } from "./time";

describe("time", () => {
  it("時刻の読み取り", () => {
    expect(parseTime("10:30")).toBe(630);
    expect(parseTime("24:00")).toBe(1440);
    expect(parseTime("24:30")).toBeNull();
    expect(parseTime("abc")).toBeNull();
  });
  it("日本時間との変換", () => {
    expect(jstToDate("2026-12-01", 600).toISOString()).toBe("2026-12-01T01:00:00.000Z");
    expect(toJst("2026-12-01T15:30:00Z")).toEqual({ date: "2026-12-02", minutes: 30 });
  });
  it("週の月曜日", () => {
    expect(mondayOf("2026-11-29")).toBe("2026-11-23"); // 日曜 → 前の月曜
    expect(mondayOf("2026-11-23")).toBe("2026-11-23");
  });
  it("電話番号の表示", () => {
    expect(formatPhone("09012345678")).toBe("090-1234-5678");
    expect(formatPhone("0312345678")).toBe("03-1234-5678");
    expect(formatPhone("0451234567")).toBe("045-123-4567");
  });
});
