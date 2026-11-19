import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getApplicantStatus, isDatabaseConfigured } from "@/lib/data/store";
import { milestones } from "@/lib/progress";
import { formatDateShort, formatTime, toJst } from "@/lib/time";
import { ApplicantShell } from "../../applicant-shell";
import { CancelButtons } from "./cancel-buttons";

export default function StatusPage(props: PageProps<"/r/[slug]/s/[token]">) {
  return (
    <Suspense fallback={<ApplicantShell>{null}</ApplicantShell>}>
      <Status {...props} />
    </Suspense>
  );
}

const fmtDate = (iso: string) => {
  const t = toJst(iso);
  return `${formatDateShort(t.date)} ${formatTime(t.minutes)}`;
};

async function Status({ params }: PageProps<"/r/[slug]/s/[token]">) {
  await connection();
  const { slug, token } = await params;
  if (!isDatabaseConfigured()) notFound();
  const s = await getApplicantStatus(slug, token);
  if (!s) notFound();

  const start = toJst(s.start_at);
  const end = toJst(s.end_at);
  const canChange = s.status === "booked" && new Date(s.start_at) > new Date();
  const steps = milestones(s.status);

  return (
    <ApplicantShell storeName={s.store.name} address={s.store.address}>
      <p className="mt-6 text-sm text-gray">{s.applicant_name} 様</p>
      <h1 className="text-2xl font-bold">応募の状況</h1>

      {s.status === "canceled" ? (
        <div className="mt-6 border border-ink bg-white p-4 text-sm leading-relaxed">
          <p className="font-bold">
            この面接は{s.canceled_reason === "日時変更" ? "日時変更のため取り消しました" : "辞退されました"}。
          </p>
          <p className="mt-1 text-gray">
            {formatDateShort(start.date)} {formatTime(start.minutes)} の予約は取り消されています。
          </p>
          <Link
            href={`/r/${s.store.public_slug}`}
            className="mt-4 flex min-h-12 items-center justify-center border border-ink bg-white font-bold"
          >
            面接の日時を選び直す
          </Link>
        </div>
      ) : (
        <>
          {/* マイルストーン */}
          <ol className="mt-6 border border-ink bg-white p-4">
            {steps.map((m, i) => (
              <li key={m.key} className="relative flex gap-3 pb-5 last:pb-0">
                {i < steps.length - 1 && (
                  <span
                    className={`absolute top-7 bottom-0 left-[13px] w-0.5 ${m.state === "done" ? "bg-ink" : "bg-line"}`}
                    aria-hidden
                  />
                )}
                <span
                  className={`num relative z-[1] flex size-7 shrink-0 items-center justify-center border text-xs font-bold ${
                    m.state === "done"
                      ? "border-ink bg-ink text-white"
                      : m.state === "current"
                        ? "border-ink bg-accent"
                        : "border-mist bg-white text-mist"
                  }`}
                >
                  {m.state === "done" ? "✓" : i + 1}
                </span>
                <div className={m.state === "todo" ? "text-mist" : ""}>
                  <p className="font-bold">{m.label}</p>
                  <p className="text-sm text-gray">
                    {m.key === "booked" && "ご予約を受け付けました"}
                    {m.key === "interview" &&
                      `${formatDateShort(start.date)} ${formatTime(start.minutes)}〜${formatTime(end.minutes || 1440)}`}
                    {m.key === "selection" &&
                      (s.result_due
                        ? `${formatDateShort(s.result_due)}までに結果をお知らせします`
                        : `面接後、${s.store.result_days}日以内に結果をお知らせします`)}
                    {m.key === "result" &&
                      (s.status === "passed"
                        ? "採用が決まりました"
                        : s.status === "rejected"
                          ? "結果をお知らせしました"
                          : "このページでお知らせします")}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          {/* 結果：採用の方への入店案内 */}
          {s.status === "passed" && (
            <section className="mt-4 border-2 border-ink bg-white p-4">
              <p className="text-lg font-bold">採用が決まりました。一緒に働けるのを楽しみにしています！</p>
              <div className="mt-4 border-t border-line pt-3">
                <p className="text-xs text-gray">初出勤の日時</p>
                <p className="num mt-0.5 text-xl font-bold">
                  {s.first_day_at ? fmtDate(s.first_day_at) : "お店からご連絡します"}
                </p>
              </div>
              <div className="mt-3 border-t border-line pt-3">
                <p className="text-xs text-gray">入店のご案内</p>
                <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">{s.store.onboarding_message}</p>
              </div>
              <div className="mt-3 border-t border-line pt-3 text-sm">
                <p className="text-xs text-gray">場所</p>
                <p className="mt-0.5 font-medium">{s.store.name}</p>
                {s.store.address && <p className="text-gray">{s.store.address}</p>}
              </div>
            </section>
          )}

          {/* 結果：見送りの方へのお礼 */}
          {s.status === "rejected" && (
            <section className="mt-4 border border-ink bg-white p-4">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{s.store.thanks_message}</p>
            </section>
          )}

          {/* 面接の前：辞退・日時変更 */}
          {canChange && (
            <section className="mt-6">
              <h2 className="text-sm font-bold">ご都合が悪くなった場合</h2>
              <p className="mt-1 text-xs text-gray">面接の開始時刻まで、こちらから手続きできます。</p>
              <CancelButtons slug={s.store.public_slug} token={token} />
            </section>
          )}

          <p className="mt-6 text-xs leading-relaxed text-gray">
            このページは、あなた専用です。ブックマークやスクリーンショットで保存しておくと、結果をいつでも確認できます。
          </p>
        </>
      )}
    </ApplicantShell>
  );
}
