import { describe, expect, it } from "vitest";
import { GUIDE_TEMPLATE, guideSchema, parseGuide } from "./interview-guide";

describe("interview-guide", () => {
  it("ひな形はそのまま保存できる", () => {
    const items = GUIDE_TEMPLATE.map((x, i) => ({ ...x, id: `t${i}` }));
    expect(guideSchema.safeParse(items).success).toBe(true);
  });
  it("内容が空の項目は保存できない", () => {
    const r = guideSchema.safeParse([{ id: "a", kind: "question", text: " ", hint: "", options: [] }]);
    expect(r.success).toBe(false);
  });
  it("データベースの壊れた値は捨てて読む", () => {
    expect(parseGuide([{ id: "a", kind: "talk", text: "こんにちは", hint: "", options: [] }, { bad: true }, "x"])).toHaveLength(1);
    expect(parseGuide(null)).toEqual([]);
  });
});
