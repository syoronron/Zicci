import { describe, expect, it } from "vitest";
import type { GuideItem } from "./interview-guide";
import { answersFor, emptyRecord, parseRecord, recordSchema } from "./interview-record";

const items: GuideItem[] = [
  { id: "t1", kind: "talk", text: "あいさつ", hint: "", options: [] },
  { id: "q1", kind: "question", text: "働ける曜日は？", hint: "", options: ["平日", "土日"] },
  { id: "q2", kind: "question", text: "いつから働けますか？", hint: "", options: [] },
];

describe("interview-record", () => {
  it("質問だけに回答の入れ物を作り、記録済みの回答は残す", () => {
    const record = { ...emptyRecord(), answers: [{ itemId: "q1", question: "古い文面", choices: ["土日"], memo: "" }] };
    const a = answersFor(items, record);
    expect(a.map((x) => x.itemId)).toEqual(["q1", "q2"]);
    expect(a[0]).toMatchObject({ question: "働ける曜日は？", choices: ["土日"] });
  });
  it("質問フローから消えた質問の回答も残す", () => {
    const record = { ...emptyRecord(), answers: [{ itemId: "gone", question: "消えた質問", choices: [], memo: "メモ" }] };
    expect(answersFor(items, record).at(-1)).toMatchObject({ itemId: "gone", memo: "メモ" });
  });
  it("保存できる形かを確認する", () => {
    expect(recordSchema.safeParse({ ...emptyRecord(), evaluation: "yes" }).success).toBe(true);
    expect(recordSchema.safeParse({ ...emptyRecord(), evaluation: "great" }).success).toBe(false);
    expect(parseRecord({ broken: true })).toBeNull();
  });
});
