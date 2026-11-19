"use client";

import Link from "next/link";
import { startTransition, useActionState, useMemo, useState, useTransition } from "react";
import type { ActionState } from "@/lib/action-state";
import type { GuideItem } from "@/lib/interview-guide";
import {
  answersFor,
  emptyRecord,
  EVALUATION_LABEL,
  RECORD_LIMITS,
  type Evaluation,
  type InterviewRecord,
  type RecordAnswer,
} from "@/lib/interview-record";
import { markInterviewed, saveInterviewRecord } from "../../actions";

type Phase = "steps" | "summary" | "finished";

/**
 * 面接の現場で使う画面：1項目ずつ大きく表示して、順番に進める。
 * 予約から開いたときは、回答・評価・メモを記録する（進むたびに自動保存）。
 */
export function GuideRunner({
  items,
  reservationId,
  canRecord,
  initialRecord,
  staffNames,
}: {
  items: GuideItem[];
  reservationId?: string;
  /** 予約から開いていて、記録用の SQL も実行済み */
  canRecord: boolean;
  initialRecord: InterviewRecord | null;
  staffNames: string[];
}) {
  const start = initialRecord ?? emptyRecord();
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("steps");
  const [answers, setAnswers] = useState<RecordAnswer[]>(() => answersFor(items, start));
  const [evaluation, setEvaluation] = useState<Evaluation | null>(start.evaluation);
  const [summary, setSummary] = useState(start.summary);
  const [interviewer, setInterviewer] = useState(start.interviewer);
  const [saveState, setSaveState] = useState<ActionState>(null);
  const [saving, startSaving] = useTransition();
  // 記録用の SQL がまだのとき（または練習）でも、予約から開いていれば選考中には進める
  const [markResult, markAction, marking] = useActionState(markInterviewed, null);

  const item = items[index];
  const isLast = index === items.length - 1;
  const answer = useMemo(() => answers.find((a) => a.itemId === item?.id), [answers, item]);

  const save = (completed: boolean) => {
    if (!canRecord || !reservationId) return;
    const record: InterviewRecord = { answers, evaluation, summary, interviewer, completed, updatedAt: "" };
    const fd = new FormData();
    fd.set("id", reservationId);
    fd.set("record", JSON.stringify(record));
    startSaving(async () => {
      setSaveState(await saveInterviewRecord(null, fd));
    });
  };

  const updateAnswer = (patch: Partial<RecordAnswer>) =>
    setAnswers((xs) => xs.map((a) => (a.itemId === item.id ? { ...a, ...patch } : a)));

  const go = (next: number) => {
    save(false);
    setIndex(next);
  };

  const finish = () => {
    if (canRecord) {
      save(true);
    } else if (reservationId) {
      const fd = new FormData();
      fd.set("id", reservationId);
      startTransition(() => markAction(fd));
    }
    setPhase("finished");
  };

  // ---------------- 面接の終了 ----------------
  if (phase === "finished") {
    const message = canRecord ? saveState?.message : markResult?.message;
    const busy = canRecord ? saving : marking;
    return (
      <div className="border border-ink bg-white p-4">
        <p className="flex items-center gap-2 text-lg font-bold">
          <span className="inline-block size-4 bg-ink" aria-hidden />
          面接おつかれさまでした
        </p>
        {reservationId && (
          <p
            role="status"
            className={`mt-2 border border-dashed p-2 text-sm ${saveState && !saveState.ok ? "border-danger text-danger" : "border-ink"}`}
          >
            {busy ? "保存しています…" : (message ?? "")}
          </p>
        )}
        {!reservationId && <p className="mt-2 text-sm text-gray">練習モードのため、記録は保存されていません。</p>}
        <div className="mt-4 grid gap-2">
          {canRecord && reservationId && (
            <Link
              href={`/admin/guide/record?r=${reservationId}`}
              className="flex min-h-12 items-center justify-center border border-ink bg-ink font-bold text-white"
            >
              面接の記録を見る
            </Link>
          )}
          <Link
            href={reservationId ? "/admin/reservations" : "/admin"}
            className="flex min-h-12 items-center justify-center border border-ink bg-white font-bold"
          >
            {reservationId ? "予約・面接に戻る" : "ホームに戻る"}
          </Link>
          <button
            type="button"
            onClick={() => {
              setPhase("steps");
              setIndex(0);
            }}
            className="min-h-11 text-sm text-gray underline underline-offset-4"
          >
            最初から見直す
          </button>
        </div>
      </div>
    );
  }

  // ---------------- まとめ（評価・メモ） ----------------
  if (phase === "summary") {
    const answered = answers.filter((a) => a.choices.length > 0 || a.memo.trim()).length;
    return (
      <div className="space-y-3">
        <SaveIndicator saving={saving} state={saveState} />
        <section className="border border-ink bg-white p-4">
          <p className="inline-block bg-ink px-2 py-0.5 text-xs font-bold text-white">まとめ</p>
          <p className="mt-3 text-lg font-bold">この応募者を、どう思いましたか？</p>
          <div className="mt-3 grid grid-cols-3 gap-1.5" role="group" aria-label="総合評価">
            {(Object.keys(EVALUATION_LABEL) as Evaluation[]).map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={evaluation === e}
                onClick={() => setEvaluation(evaluation === e ? null : e)}
                className={`min-h-14 border text-sm font-bold ${
                  evaluation === e ? "border-ink bg-ink text-white" : "border-ink bg-white"
                }`}
              >
                {EVALUATION_LABEL[e]}
              </button>
            ))}
          </div>

          <label className="mt-4 block">
            <span className="label">面接した人</span>
            <input
              list="staff-names"
              value={interviewer}
              maxLength={RECORD_LIMITS.interviewer}
              onChange={(e) => setInterviewer(e.target.value)}
              placeholder="名前を選ぶか、入力"
              className="field"
            />
            <datalist id="staff-names">
              {staffNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </label>

          <label className="mt-3 block">
            <span className="label">全体のメモ（店長に伝えたいこと）</span>
            <textarea
              value={summary}
              maxLength={RECORD_LIMITS.summary}
              rows={4}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="例：はきはきしていて好印象。土日も入れるとのこと。"
              className="field py-2"
            />
          </label>
          <p className="mt-2 text-xs text-gray">
            回答を記録した質問：{answered} / {answers.length}
          </p>
        </section>

        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <button
            type="button"
            onClick={() => {
              save(false);
              setPhase("steps");
            }}
            className="min-h-14 border border-ink bg-white font-bold"
          >
            ← 戻る
          </button>
          <button
            type="button"
            onClick={finish}
            className="flex min-h-14 items-center justify-between border border-ink bg-accent px-4 font-bold"
          >
            記録して面接を終える
            <span className="num">→</span>
          </button>
        </div>
      </div>
    );
  }

  // ---------------- 1項目ずつ ----------------
  return (
    <div className="space-y-3">
      {canRecord ? (
        <SaveIndicator saving={saving} state={saveState} resumed={Boolean(initialRecord)} completed={initialRecord?.completed} />
      ) : (
        !reservationId && <p className="text-xs text-gray">練習モード：入力した内容は保存されません。</p>
      )}

      {/* 進み具合 */}
      <div>
        <div className="flex items-baseline justify-between text-xs text-gray">
          <span>{item.kind === "question" ? "質問する" : "伝える"}</span>
          <span className="num" data-testid="progress">
            {index + 1} / {items.length}
          </span>
        </div>
        <div className="mt-1 flex gap-0.5" aria-hidden>
          {items.map((x, i) => (
            <span key={x.id} className={`h-1.5 flex-1 ${i <= index ? "bg-ink" : "bg-line"}`} />
          ))}
        </div>
      </div>

      {/* いまの項目 */}
      <section className="border border-ink bg-white p-5">
        <p
          className={`inline-block px-2 py-0.5 text-xs font-bold ${item.kind === "question" ? "bg-ink text-white" : "border border-ink"}`}
        >
          {item.kind === "question" ? "質問" : "伝えること"}
        </p>
        <p className="mt-4 text-xl leading-relaxed font-bold">{item.text}</p>
        {item.hint && (
          <div className="mt-5 border-l-4 border-ink bg-paper px-3 py-2">
            <p className="text-[11px] font-bold text-gray">確認ポイント</p>
            <p className="mt-0.5 text-sm">{item.hint}</p>
          </div>
        )}

        {item.kind === "question" && (
          <div className="mt-5 border-t border-line pt-4">
            {item.options.length > 0 && (
              <>
                <p className="text-[11px] font-bold text-gray">
                  {canRecord || !reservationId ? "回答（当てはまるものをタップ・複数可）" : "回答の例"}
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="回答の選択肢">
                  {item.options.map((o) => {
                    const on = answer?.choices.includes(o) ?? false;
                    return (
                      <li key={o}>
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() =>
                            updateAnswer({
                              choices: on ? (answer?.choices ?? []).filter((c) => c !== o) : [...(answer?.choices ?? []), o],
                            })
                          }
                          className={`min-h-11 border px-3 text-sm ${on ? "border-ink bg-ink font-bold text-white" : "border-ink bg-white"}`}
                        >
                          {on && "✓ "}
                          {o}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            <label className="mt-3 block">
              <span className="label">メモ（応募者の答え）</span>
              <textarea
                value={answer?.memo ?? ""}
                maxLength={RECORD_LIMITS.memo}
                rows={3}
                onChange={(e) => updateAnswer({ memo: e.target.value })}
                className="field py-2"
              />
            </label>
          </div>
        )}
      </section>

      {/* 次に話すこと（少しだけ見せる） */}
      {!isLast && <p className="truncate text-xs text-gray">次：{items[index + 1].text}</p>}

      <div className="grid grid-cols-[1fr_2fr] gap-2">
        <button
          type="button"
          onClick={() => go(Math.max(0, index - 1))}
          disabled={index === 0}
          className="min-h-14 border border-ink bg-white font-bold disabled:border-mist disabled:text-mist"
        >
          ← 前へ
        </button>
        <button
          type="button"
          onClick={() => {
            if (!isLast) return go(index + 1);
            if (canRecord) {
              save(false);
              setPhase("summary");
            } else {
              finish();
            }
          }}
          className="flex min-h-14 items-center justify-between border border-ink bg-accent px-4 font-bold"
        >
          {!isLast ? "次へ" : canRecord ? "まとめへ（評価・メモ）" : "面接を終える"}
          <span className="num">→</span>
        </button>
      </div>
    </div>
  );
}

/** 自動保存の状態（小さく表示） */
function SaveIndicator({
  saving,
  state,
  resumed,
  completed,
}: {
  saving: boolean;
  state: ActionState;
  resumed?: boolean;
  completed?: boolean;
}) {
  let text = "入力した内容は、進むたびに自動で保存されます";
  let tone = "text-gray";
  if (saving) text = "保存しています…";
  else if (state && !state.ok) {
    text = state.message;
    tone = "font-medium text-danger";
  } else if (state?.ok) text = "✓ 自動保存しました";
  else if (completed) text = "この面接は記録済みです。直すと上書きされます";
  else if (resumed) text = "前回の記録の続きから入力できます";
  return (
    <p role="status" aria-live="polite" className={`text-xs ${tone}`} data-testid="save-indicator">
      {text}
    </p>
  );
}
