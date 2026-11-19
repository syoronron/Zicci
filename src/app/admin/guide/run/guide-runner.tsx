"use client";

import Link from "next/link";
import { useState } from "react";
import type { GuideItem } from "@/lib/interview-guide";

/** 面接の現場で使う画面：1項目ずつ大きく表示して、順番に進める */
export function GuideRunner({ items }: { items: GuideItem[] }) {
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const item = items[index];
  const isLast = index === items.length - 1;

  if (finished) {
    return (
      <div className="border border-ink bg-white p-4">
        <p className="flex items-center gap-2 text-lg font-bold">
          <span className="inline-block size-4 bg-ink" aria-hidden />
          面接おつかれさまでした
        </p>
        <p className="mt-2 text-sm text-gray">気づいたことは、忘れないうちに店長に伝えてください。</p>
        <div className="mt-4 grid gap-2">
          <Link href="/admin" className="flex min-h-12 items-center justify-center border border-ink bg-ink font-bold text-white">
            ホームに戻る
          </Link>
          <button
            type="button"
            onClick={() => {
              setFinished(false);
              setIndex(0);
            }}
            className="min-h-11 text-sm text-gray underline underline-offset-4"
          >
            最初から見る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 進み具合 */}
      <div>
        <div className="flex items-baseline justify-between text-xs text-gray">
          <span>
            {item.kind === "question" ? "質問する" : "伝える"}
          </span>
          <span className="num">
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
      <section className="min-h-64 border border-ink bg-white p-5">
        <p className={`inline-block px-2 py-0.5 text-xs font-bold ${item.kind === "question" ? "bg-ink text-white" : "border border-ink"}`}>
          {item.kind === "question" ? "質問" : "伝えること"}
        </p>
        <p className="mt-4 text-xl leading-relaxed font-bold">{item.text}</p>
        {item.hint && (
          <div className="mt-5 border-l-4 border-ink bg-paper px-3 py-2">
            <p className="text-[11px] font-bold text-gray">確認ポイント</p>
            <p className="mt-0.5 text-sm">{item.hint}</p>
          </div>
        )}
        {item.options.length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] font-bold text-gray">回答の例</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {item.options.map((o) => (
                <li key={o} className="border border-line px-2 py-1 text-sm">
                  {o}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* 次に話すこと（少しだけ見せる） */}
      {!isLast && (
        <p className="truncate text-xs text-gray">
          次：{items[index + 1].text}
        </p>
      )}

      <div className="grid grid-cols-[1fr_2fr] gap-2">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="min-h-14 border border-ink bg-white font-bold disabled:border-mist disabled:text-mist"
        >
          ← 前へ
        </button>
        <button
          type="button"
          onClick={() => (isLast ? setFinished(true) : setIndex((i) => i + 1))}
          className="flex min-h-14 items-center justify-between border border-ink bg-accent px-4 font-bold"
        >
          {isLast ? "面接を終える" : "次へ"}
          <span className="num">→</span>
        </button>
      </div>
    </div>
  );
}
