"use client";

import Link from "next/link";
import QRCode from "qrcode";
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
  const [qr, setQr] = useState<string | null>(null); // QRコードの画像（PNG の data URL）
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

  /** QRコードを表示する／閉じる（作成は端末の中だけで行い、外部には送らない） */
  const toggleQr = async () => {
    if (qr) return setQr(null);
    try {
      setQr(await QRCode.toDataURL(url, { width: 720, margin: 2, errorCorrectionLevel: "M" }));
    } catch {
      flash("QRコードを作れませんでした。");
    }
  };

  /** QR画像を共有（スマホ）または保存（パソコン） */
  const saveQr = async () => {
    if (!qr) return;
    const blob = await (await fetch(qr)).blob();
    const file = new File([blob], `${storeName}_面接予約QR.png`, { type: "image/png" });
    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `${storeName} 面接予約`, text });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    const a = document.createElement("a");
    a.href = qr;
    a.download = file.name;
    a.click();
    flash("QRコードの画像を保存しました。");
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
      <div className="mt-2 grid grid-cols-3 gap-2">
        <button type="button" onClick={copy} className="min-h-11 border border-ink bg-white text-sm font-bold">
          URLをコピー
        </button>
        <button
          type="button"
          onClick={toggleQr}
          aria-expanded={qr !== null}
          className={`min-h-11 border border-ink text-sm font-bold ${qr ? "bg-ink text-white" : "bg-white"}`}
        >
          QRコード
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
      {qr && (
        <div className="mt-3 border border-ink bg-white p-4 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- 端末で作った QR 画像（data URL）を表示するため */}
          <img src={qr} alt={`${storeName}の面接予約ページのQRコード`} className="mx-auto w-full max-w-60" />
          <p className="mt-2 text-xs text-gray">スマホのカメラで読み取ると、予約ページが開きます</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={saveQr} className="min-h-11 border border-ink bg-white text-sm font-bold">
              QR画像を保存・共有
            </button>
            <Link
              href="/admin/qr"
              className="flex min-h-11 items-center justify-center border border-ink bg-white text-sm font-bold"
            >
              印刷用ポスター
            </Link>
          </div>
        </div>
      )}
      {notice && (
        <p role="status" className="mt-2 text-sm text-gray">
          {notice}
        </p>
      )}
    </div>
  );
}
