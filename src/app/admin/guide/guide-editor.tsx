"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useState } from "react";
import { GUIDE_LIMITS, GUIDE_TEMPLATE, type GuideItem, type GuideKind } from "@/lib/interview-guide";
import { saveInterviewGuide } from "../actions";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random()}`;

const splitOptions = (s: string) =>
  s
    .split(/[、,，\n]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, GUIDE_LIMITS.options);

const KIND_LABEL: Record<GuideKind, string> = { question: "質問", talk: "伝えること" };

/** 面接の進め方（質問フロー）の編集 */
export function GuideEditor({ initial }: { initial: GuideItem[] }) {
  const [items, setItems] = useState<GuideItem[]>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [optionDrafts, setOptionDrafts] = useState<Record<string, string>>({});
  const [state, formAction, pending] = useActionState(saveInterviewGuide, null);
  const dirty = JSON.stringify(items) !== saved;

  // 保存に成功したら「保存済み」の基準を更新する
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state?.ok) setSaved(JSON.stringify(items));
  }

  // 保存していない変更があるときは、ページを離れる前に確認する
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const update = (id: string, patch: Partial<GuideItem>) =>
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const move = (index: number, delta: number) =>
    setItems((xs) => {
      const to = index + delta;
      if (to < 0 || to >= xs.length) return xs;
      const next = [...xs];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });

  const add = (kind: GuideKind) =>
    setItems((xs) =>
      xs.length >= GUIDE_LIMITS.items ? xs : [...xs, { id: newId(), kind, text: "", hint: "", options: [] }],
    );

  const save = () => {
    const fd = new FormData();
    fd.set("items", JSON.stringify(items));
    startTransition(() => formAction(fd));
  };

  return (
    <div className="space-y-3 pb-20">
      {items.length === 0 && (
        <div className="border border-ink bg-white p-4">
          <p className="font-bold">まだ項目がありません</p>
          <p className="mt-1 text-sm text-gray">
            飲食店のアルバイト面接でよく使う流れ（13項目）を入れて、お店に合わせて書き換えるのがおすすめです。
          </p>
          <button
            type="button"
            onClick={() => setItems(GUIDE_TEMPLATE.map((x) => ({ ...x, id: newId() })))}
            className="mt-3 flex min-h-12 w-full items-center justify-between border border-ink bg-ink px-4 font-bold text-white"
          >
            飲食店向けのひな形を入れる<span className="num">→</span>
          </button>
        </div>
      )}

      <ol className="space-y-3">
        {items.map((item, i) => (
          <li key={item.id} className="border border-ink bg-white p-3">
            <div className="flex items-center gap-2">
              <span className="num flex size-7 shrink-0 items-center justify-center bg-ink text-xs font-bold text-white">
                {i + 1}
              </span>
              <div className="grid grid-cols-2 border border-ink text-xs" role="group" aria-label="種類">
                {(["question", "talk"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={item.kind === k}
                    onClick={() => update(item.id, { kind: k })}
                    className={`min-h-9 px-2.5 ${item.kind === k ? "bg-ink font-bold text-white" : "bg-white"}`}
                  >
                    {KIND_LABEL[k]}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex">
                <IconButton label="上へ" onClick={() => move(i, -1)} disabled={i === 0}>
                  ↑
                </IconButton>
                <IconButton label="下へ" onClick={() => move(i, 1)} disabled={i === items.length - 1}>
                  ↓
                </IconButton>
                <IconButton
                  label="削除"
                  onClick={() => {
                    if (!item.text || window.confirm("この項目を削除しますか？")) {
                      setItems((xs) => xs.filter((x) => x.id !== item.id));
                    }
                  }}
                >
                  ×
                </IconButton>
              </div>
            </div>

            <label className="mt-3 block">
              <span className="label">{item.kind === "question" ? "聞くこと" : "伝えること"}</span>
              <textarea
                value={item.text}
                maxLength={GUIDE_LIMITS.text}
                rows={2}
                onChange={(e) => update(item.id, { text: e.target.value })}
                placeholder={item.kind === "question" ? "例：働ける曜日と時間帯を教えてください。" : "例：時給は〇〇円です。"}
                className="field min-h-16 py-2"
              />
            </label>
            <label className="mt-2 block">
              <span className="label">確認ポイント（任意）</span>
              <input
                value={item.hint}
                maxLength={GUIDE_LIMITS.hint}
                onChange={(e) => update(item.id, { hint: e.target.value })}
                placeholder="例：忙しい時間に入れるか"
                className="field"
              />
            </label>
            {item.kind === "question" && (
              <label className="mt-2 block">
                <span className="label">回答の選択肢（任意・「、」で区切る）</span>
                <input
                  value={optionDrafts[item.id] ?? item.options.join("、")}
                  onChange={(e) => {
                    setOptionDrafts((d) => ({ ...d, [item.id]: e.target.value }));
                    update(item.id, { options: splitOptions(e.target.value) });
                  }}
                  placeholder="例：週1〜2日、週3〜4日、週5日以上"
                  className="field"
                />
              </label>
            )}
          </li>
        ))}
      </ol>

      {items.length < GUIDE_LIMITS.items && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => add("question")} className="min-h-12 border border-ink bg-white text-sm font-bold">
            ＋ 質問を追加
          </button>
          <button type="button" onClick={() => add("talk")} className="min-h-12 border border-ink bg-white text-sm font-bold">
            ＋ 伝えることを追加
          </button>
        </div>
      )}

      {items.length > 0 && !dirty && (
        <Link
          href="/admin/guide/run"
          className="flex min-h-12 items-center justify-center border border-ink bg-white text-sm font-bold"
        >
          面接画面で流れを確かめる
        </Link>
      )}

      {/* 保存ボタン（画面下のタブの上に固定） */}
      <div className="fixed inset-x-0 bottom-14 z-10 border-t border-ink bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto max-w-md px-4 py-2">
          {state && !dirty && (
            <p role="status" className={`mb-1 text-xs ${state.ok ? "text-gray" : "font-medium text-danger"}`}>
              {state.message}
            </p>
          )}
          {state && !state.ok && dirty && (
            <p role="status" className="mb-1 text-xs font-medium text-danger">
              {state.message}
            </p>
          )}
          <button
            type="button"
            onClick={save}
            disabled={!dirty || pending}
            className="flex min-h-12 w-full items-center justify-between border border-ink bg-accent px-4 font-bold disabled:bg-white disabled:text-gray"
          >
            {pending ? "保存しています…" : dirty ? "変更を保存する" : "保存済み"}
            <span className="num text-xs font-normal">{items.length}項目</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="num flex size-9 items-center justify-center border border-line text-base disabled:text-mist"
    >
      {children}
    </button>
  );
}
