"use client";

import { useState } from "react";

/**
 * 予約ページの共有ボタン。
 * スマホでは LINE・メールなどの共有画面を開く（Web Share API）。
 * 共有画面に対応していない環境（パソコンなど）では URL をコピーする。
 */
export function ShareBooking({
  url,
  storeName,
  variant = "ink",
  showUrl = true,
}: {
  url: string;
  storeName: string;
  /** accent は黄色（1画面に1か所だけ） */
  variant?: "accent" | "ink";
  showUrl?: boolean;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const text = `${storeName}の面接日時は、こちらからお選びください。`;

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 2500);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      flash("URLをコピーしました。LINEやメールに貼り付けて送ってください。");
    } catch {
      window.prompt("このURLをコピーしてください", url);
    }
  };

  const share = async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `${storeName} 面接予約`, text, url });
        return;
      } catch (e) {
        // 共有画面を閉じただけなら何もしない
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    await copy();
  };

  const main =
    variant === "accent" ? "border border-ink bg-accent text-ink" : "border border-ink bg-ink text-white";

  return (
    <div>
      {showUrl && <p className="num mb-2 border border-ink bg-paper px-3 py-2 text-sm break-all">{url}</p>}
      <button
        type="button"
        onClick={share}
        className={`flex min-h-12 w-full items-center justify-between px-4 font-bold ${main}`}
      >
        予約ページを共有する
        <span className="text-xs font-medium">LINE・メールなど</span>
      </button>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" onClick={copy} className="min-h-11 border border-ink bg-white text-sm font-bold">
          URLをコピー
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener"
          className="flex min-h-11 items-center justify-center border border-ink bg-white text-sm font-bold"
        >
          ページを確認
        </a>
      </div>
      {notice && (
        <p role="status" className="mt-2 text-sm text-gray">
          {notice}
        </p>
      )}
    </div>
  );
}
