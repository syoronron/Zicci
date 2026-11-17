import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { PosterGraphic } from "@/components/poster-graphic";
import { SystemStatus } from "./system-status";

/** トップページ：1枚のポスターのように、文字は最小限 */
export default function Home() {
  return (
    <>
      {/* 背景写真（濃さ20%）。画面全体に敷き、文字やグラフィックの読みやすさを優先する */}
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
        <Image
          src="/images/top-bg.jpg"
          alt=""
          fill
          preload
          sizes="100vw"
          className="object-cover object-[45%_center] opacity-20"
        />
      </div>
      <main className="mx-auto flex h-svh min-h-[34rem] w-full max-w-md flex-col px-5 pt-4 pb-4">
        <header className="flex items-center justify-between border-b border-ink pb-3">
          <Logo size={22} />
          <span className="num text-[10px] font-semibold tracking-[0.2em] text-gray">
            FOR RESTAURANTS
          </span>
        </header>

        <h1 className="mt-[4svh] text-[clamp(2rem,10vw,2.6rem)] leading-[1.18] font-bold tracking-tight">
          面接の調整、
          <br />
          面倒じゃない
          <br />
          ですか？
        </h1>

        {/* 空いた高さいっぱいにグラフィックを置く（画面が小さければ縮む） */}
        <div className="flex min-h-0 flex-1 items-center justify-center py-[3svh]">
          <PosterGraphic className="h-full max-h-full w-full" />
        </div>

        <p className="text-lg font-bold">シフト表から、面接枠を自動で。</p>

        <Link
          href="/admin"
          className="mt-4 flex min-h-13 items-center justify-between border border-ink bg-ink px-4 font-bold text-white"
        >
          はじめる
          <span className="num" aria-hidden>
            →
          </span>
        </Link>

        <footer className="pt-4">
          <Suspense fallback={<p className="text-[11px] text-gray">…</p>}>
            <SystemStatus compact />
          </Suspense>
        </footer>
      </main>
    </>
  );
}
