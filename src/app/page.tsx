import { Suspense } from "react";
import { SystemStatus } from "./system-status";

const steps = [
  { title: "シフト表を撮影", body: "紙のシフト表を撮るだけ。AIが勤務時間を読み取ります。" },
  { title: "面接担当を選ぶ", body: "面接できる人を選んで、シフトを確認・修正します。" },
  { title: "面接枠を自動作成", body: "繁忙時間や休憩を避けて、30分の面接枠を作ります。" },
  { title: "応募者が予約", body: "公開URLから応募者が空いている日時を選びます。" },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
      <header className="mb-8">
        <p className="text-sm font-semibold text-brand">アルバイト面接の日程調整</p>
        <h1 className="mt-1 text-4xl font-bold tracking-tight">Zicci</h1>
        <p className="mt-3 text-muted">
          シフト表から面接可能な時間を自動で作り、応募者が自分で予約できます。
        </p>
      </header>

      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li
            key={step.title}
            className="flex gap-3 rounded-2xl border border-border bg-surface p-4"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-foreground">
              {i + 1}
            </span>
            <div>
              <h2 className="font-semibold">{step.title}</h2>
              <p className="mt-0.5 text-sm text-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-semibold text-muted">システムの状態</h2>
        <Suspense
          fallback={
            <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
              確認中…
            </div>
          }
        >
          <SystemStatus />
        </Suspense>
      </section>
    </main>
  );
}
