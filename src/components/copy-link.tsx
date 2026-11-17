"use client";

import { useState } from "react";

/** 予約ページのURLを表示し、ワンタップでコピーできるようにする */
export function CopyLink({ url, path }: { url: string; path: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div>
      <p className="num border border-ink bg-paper px-3 py-2 text-sm break-all">{url}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              window.prompt("このURLをコピーしてください", url);
            }
          }}
          className="min-h-11 border border-ink bg-ink text-sm font-bold text-white"
        >
          {copied ? "コピーしました" : "URLをコピー"}
        </button>
        <a
          href={path}
          target="_blank"
          rel="noopener"
          className="flex min-h-11 items-center justify-center border border-ink bg-white text-sm font-bold"
        >
          ページを開く
        </a>
      </div>
    </div>
  );
}
