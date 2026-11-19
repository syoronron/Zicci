import { z } from "zod";
import type { GuideItem } from "@/lib/interview-guide";

/**
 * 面接の記録。面接中の画面で入力し、進むたびに自動で保存する。
 * 質問の文面も一緒に残すので、あとで「面接の進め方」を書き換えても記録の意味が変わらない。
 */

export type Evaluation = "yes" | "maybe" | "no";

export const EVALUATION_LABEL: Record<Evaluation, string> = {
  yes: "採用したい",
  maybe: "迷う",
  no: "見送りたい",
};

export type RecordAnswer = {
  itemId: string;
  /** 記録した時点の質問文 */
  question: string;
  /** 選んだ選択肢（複数可） */
  choices: string[];
  memo: string;
};

export type InterviewRecord = {
  answers: RecordAnswer[];
  evaluation: Evaluation | null;
  summary: string;
  interviewer: string;
  /** 「記録して面接を終える」まで進んだか */
  completed: boolean;
  updatedAt: string;
};

export const RECORD_LIMITS = { answers: 40, memo: 500, summary: 1000, interviewer: 30 } as const;

export const recordSchema = z.object({
  answers: z
    .array(
      z.object({
        itemId: z.string().min(1).max(64),
        question: z.string().max(200),
        choices: z.array(z.string().max(30)).max(8),
        memo: z.string().max(RECORD_LIMITS.memo, `メモは${RECORD_LIMITS.memo}文字以内です`),
      }),
    )
    .max(RECORD_LIMITS.answers),
  evaluation: z.enum(["yes", "maybe", "no"]).nullable(),
  summary: z.string().max(RECORD_LIMITS.summary, `全体のメモは${RECORD_LIMITS.summary}文字以内です`),
  interviewer: z.string().trim().max(RECORD_LIMITS.interviewer, `名前は${RECORD_LIMITS.interviewer}文字以内です`),
  completed: z.boolean(),
  updatedAt: z.string().max(40),
});

/** データベースの値を安全に読む（壊れていれば null） */
export function parseRecord(value: unknown): InterviewRecord | null {
  const r = recordSchema.safeParse(value);
  return r.success ? r.data : null;
}

export function emptyRecord(): InterviewRecord {
  return { answers: [], evaluation: null, summary: "", interviewer: "", completed: false, updatedAt: "" };
}

/** 今の質問フローに合わせて、回答の入れ物をそろえる（記録済みの回答は残す） */
export function answersFor(items: GuideItem[], record: InterviewRecord): RecordAnswer[] {
  const byId = new Map(record.answers.map((a) => [a.itemId, a]));
  const current = items
    .filter((i) => i.kind === "question")
    .map((i) => byId.get(i.id) ?? { itemId: i.id, question: i.text, choices: [], memo: "" })
    .map((a) => ({ ...a, question: items.find((i) => i.id === a.itemId)?.text ?? a.question }));
  // 質問フローから消えた質問の回答も、記録として残す
  const removed = record.answers.filter((a) => !items.some((i) => i.id === a.itemId));
  return [...current, ...removed];
}

/** 何か入力されている回答か */
export function hasAnswer(a: RecordAnswer): boolean {
  return a.choices.length > 0 || a.memo.trim() !== "";
}
