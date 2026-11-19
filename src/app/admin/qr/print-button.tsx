"use client";

/** 印刷ボタン（ブラウザの印刷画面を開く。PDF として保存もできる） */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex min-h-12 items-center justify-center border border-ink bg-accent text-sm font-bold"
    >
      印刷する・PDFで保存
    </button>
  );
}
