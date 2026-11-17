import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { SystemStatus } from "./system-status";

const steps = [
  { shape: "square", title: "シフト表を撮影", body: "紙のシフト表を撮るだけ。AIが勤務時間を読み取ります。" },
  { shape: "square", title: "面接担当を選ぶ", body: "面接できる人を選んで、シフトを確認・修正します。" },
  { shape: "stripe", title: "忙しい時間を避ける", body: "繁忙時間や休憩を除いて、面接枠を自動で作ります。" },
  { shape: "circle", title: "応募者が予約", body: "公開URLから応募者が空いている日時を選びます。" },
] as const;

function Glyph({ shape }: { shape: (typeof steps)[number]["shape"] }) {
  const base = "inline-block size-6 shrink-0 border border-ink";
  if (shape === "circle") return <span className={`${base} rounded-full bg-white`} aria-hidden />;
  if (shape === "stripe") return <span className={`${base} stripe bg-white`} aria-hidden />;
  return <span className={`${base} bg-white`} aria-hidden />;
}

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
      <header className="flex items-center justify-between border-b border-ink pb-3">
        <Logo size={22} />
        <span className="num text-[10px] font-semibold tracking-[0.2em] text-gray">FOR RESTAURANTS</span>
      </header>

      <section className="mt-8">
        <p className="num text-[11px] font-semibold tracking-[0.2em] text-gray">シフトの余白を、面接の時間に</p>
        <h1 className="mt-3 text-[2.5rem] leading-[1.2] font-bold tracking-tight">
          マス目が、
          <br />
          出会いの
          <br />
          <span className="relative">
            時間
            <span className="absolute inset-x-0 bottom-1 h-1 bg-accent" aria-hidden />
          </span>
          になる。
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-gray">
          シフト表から面接できる時間を自動で作り、応募者が自分で予約できます。日程調整の連絡は、もういりません。
        </p>
      </section>

      <ol className="mt-8 border border-ink bg-white">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-3 border-b border-line p-4 last:border-b-0">
            <Glyph shape={step.shape} />
            <div>
              <h2 className="font-bold">
                <span className="num mr-2 text-xs text-gray">0{i + 1}</span>
                {step.title}
              </h2>
              <p className="mt-0.5 text-sm text-gray">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <Link
        href="/admin"
        className="mt-6 flex min-h-12 items-center justify-between border border-ink bg-accent px-4 font-bold"
      >
        店舗の管理画面をひらく
        <span className="num" aria-hidden>
          →
        </span>
      </Link>

      <section className="mt-8">
        <h2 className="mb-2 text-xs font-medium text-gray">システムの状態</h2>
        <Suspense fallback={<div className="border border-ink bg-white p-4 text-sm text-gray">確認中…</div>}>
          <SystemStatus />
        </Suspense>
      </section>
    </main>
  );
}
