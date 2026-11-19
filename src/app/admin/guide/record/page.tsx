import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Section, SetupNotice } from "@/components/page-header";
import { requireAdminPage } from "@/lib/auth";
import { getInterviewRecord, getReservationBrief, getStore, isDatabaseConfigured } from "@/lib/data/store";
import { EVALUATION_LABEL, hasAnswer } from "@/lib/interview-record";
import { STATUS_LABEL } from "@/lib/progress";
import { formatDateShort, formatTime, toJst } from "@/lib/time";

/** 面接の記録（店長が確認する画面） */
export default async function RecordPage({ searchParams }: PageProps<"/admin/guide/record">) {
  const { r } = await searchParams;
  await requireAdminPage();
  if (!isDatabaseConfigured()) return <SetupNotice />;
  const store = await getStore();
  if (!store || typeof r !== "string") notFound();

  const [reservation, state] = await Promise.all([getReservationBrief(store.id, r), getInterviewRecord(store.id, r)]);
  if (!reservation || !state) notFound();
  const start = toJst(reservation.start_at);

  if (state.needsSetup) {
    return (
      <>
        <PageHeader eyebrow="RECORD" title={`${reservation.name} さんの面接の記録`} />
        <p className="border border-ink bg-white p-4 text-sm">
          Supabase で <span className="num">20261121000000_interview_record.sql</span> を実行してください。
        </p>
      </>
    );
  }

  const record = state.record;
  const updated = record?.updatedAt ? toJst(record.updatedAt) : null;

  return (
    <>
      <PageHeader eyebrow="RECORD" title={`${reservation.name} さんの面接の記録`}>
        面接 {formatDateShort(start.date)} {formatTime(start.minutes)}〜 ／ 今の段階：{STATUS_LABEL[state.status]}
      </PageHeader>

      {!record ? (
        <div className="border border-ink bg-white p-4 text-sm leading-relaxed">
          <p className="font-bold">まだ記録がありません</p>
          <p className="mt-1 text-gray">予約カレンダーの「面接を始める」から面接を進めると、回答が記録されます。</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* まとめ */}
          <section className="border-2 border-ink bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-gray">総合評価</p>
              {!record.completed && (
                <span className="border border-dashed border-ink px-1.5 py-0.5 text-[11px] font-bold">記録の途中</span>
              )}
            </div>
            <p className="mt-1 text-2xl font-bold">
              {record.evaluation ? EVALUATION_LABEL[record.evaluation] : "（未入力）"}
            </p>
            <dl className="mt-3 grid grid-cols-[6rem_1fr] gap-y-1 border-t border-line pt-3 text-sm">
              <dt className="text-gray">面接した人</dt>
              <dd>{record.interviewer || "（未入力）"}</dd>
              <dt className="text-gray">最終更新</dt>
              <dd className="num">{updated ? `${formatDateShort(updated.date)} ${formatTime(updated.minutes)}` : "—"}</dd>
            </dl>
            {record.summary && (
              <div className="mt-3 border-t border-line pt-3">
                <p className="text-xs text-gray">全体のメモ</p>
                <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">{record.summary}</p>
              </div>
            )}
          </section>

          {/* 質問ごとの回答 */}
          <Section title="質問と回答">
            <ol className="-mx-4 border-t border-line">
              {record.answers.map((a, i) => (
                <li key={a.itemId} className="border-b border-line px-4 py-3 last:border-b-0">
                  <p className="text-sm font-bold">
                    <span className="num mr-1.5 text-gray">Q{i + 1}</span>
                    {a.question}
                  </p>
                  {hasAnswer(a) ? (
                    <div className="mt-1.5 space-y-1">
                      {a.choices.length > 0 && (
                        <ul className="flex flex-wrap gap-1">
                          {a.choices.map((c) => (
                            <li key={c} className="bg-ink px-2 py-0.5 text-xs font-bold text-white">
                              {c}
                            </li>
                          ))}
                        </ul>
                      )}
                      {a.memo && <p className="text-sm leading-relaxed whitespace-pre-wrap">{a.memo}</p>}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-mist">（記録なし）</p>
                  )}
                </li>
              ))}
            </ol>
          </Section>
        </div>
      )}

      <div className="mt-4 grid gap-2">
        {state.status !== "canceled" && (
          <Link
            href={`/admin/guide/run?r=${r}`}
            className="flex min-h-12 items-center justify-center border border-ink bg-white text-sm font-bold"
          >
            {record ? "面接画面で記録を直す" : "面接を始める"}
          </Link>
        )}
        <Link href={`/admin?d=${start.date}`} className="min-h-11 text-center text-sm text-gray underline underline-offset-4">
          予約カレンダーに戻る
        </Link>
      </div>
    </>
  );
}
