"use client";

import Link from "next/link";
import { useEffect } from "react";

/** 予期しないエラーが起きたときの画面（真っ白にならないように） */
export function ErrorView({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = (error as { digest?: string } | null)?.digest;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-8">
      <div className="border border-ink bg-white p-4">
        <p className="flex items-center gap-2 font-bold">
          <span className="inline-block size-3 bg-danger" aria-hidden />
          うまく表示できませんでした
        </p>
        <p className="mt-2 text-sm leading-relaxed text-gray">
          一時的な問題の可能性があります。もう一度読み込んでも直らない場合は、トップページの「システムの状態」で設定を確認してください。
        </p>
        {digest && <p className="num mt-2 text-xs text-gray">エラー番号：{digest}</p>}
        <div className="mt-4 grid gap-2">
          <button type="button" onClick={() => retry()} className="min-h-12 border border-ink bg-ink font-bold text-white">
            もう一度読み込む
          </button>
          <Link href="/" className="flex min-h-12 items-center justify-center border border-ink bg-white font-bold">
            トップページへ
          </Link>
        </div>
      </div>
    </div>
  );
}
