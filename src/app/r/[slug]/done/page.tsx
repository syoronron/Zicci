import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getReservationSummary, getStatusToken, getStoreBySlug, isDatabaseConfigured } from "@/lib/data/store";
import { formatDateShort, formatTime, toJst } from "@/lib/time";
import { ApplicantShell } from "../applicant-shell";

export default function DonePage(props: PageProps<"/r/[slug]/done">) {
  return (
    <Suspense fallback={<ApplicantShell>{null}</ApplicantShell>}>
      <Done {...props} />
    </Suspense>
  );
}

async function Done({ params, searchParams }: PageProps<"/r/[slug]/done">) {
  await connection();
  const [{ slug }, { r }] = await Promise.all([params, searchParams]);
  if (!isDatabaseConfigured() || typeof r !== "string") notFound();
  const store = await getStoreBySlug(slug);
  if (!store) notFound();
  const [summary, token] = await Promise.all([getReservationSummary(store.id, r), getStatusToken(store.id, r)]);
  if (!summary) notFound();

  const start = toJst(summary.start_at);
  const end = toJst(summary.end_at);

  return (
    <ApplicantShell storeName={store.name} address={store.address}>
      <div className="mt-10 flex items-center gap-3">
        {/* 決まった面接＝黄色の □（ロゴと同じ図形） */}
        <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden>
          <rect x="1" y="1" width="38" height="38" fill="#FFC800" stroke="#141414" strokeWidth="1.5" />
          <path d="M11 20.5 L17.5 27 L29.5 14" fill="none" stroke="#141414" strokeWidth="2.5" />
        </svg>
        <h1 className="text-2xl font-bold">予約が完了しました</h1>
      </div>

      <div className="mt-6 border border-ink bg-white p-4">
        <p className="text-xs text-gray">面接の日時</p>
        <p className="num mt-1 text-2xl font-bold">{formatDateShort(start.date)}</p>
        <p className="num text-3xl font-bold tracking-tight">
          {formatTime(start.minutes)} – {formatTime(end.minutes || 1440)}
        </p>
        <dl className="mt-4 border-t border-line pt-3 text-sm">
          <dt className="text-xs text-gray">場所</dt>
          <dd className="mt-0.5 font-medium">{store.name}</dd>
          {store.address && <dd className="text-gray">{store.address}</dd>}
        </dl>
      </div>

      <ul className="mt-6 space-y-2 text-sm leading-relaxed text-gray">
        <li>・面接の結果は、下の「応募状況のページ」でお知らせします。ページをブックマークしておいてください。</li>
        <li>・当日は、お店のスタッフにお名前をお伝えください。</li>
        <li>・日時の変更や辞退も、応募状況のページから手続きできます。</li>
      </ul>

      {token ? (
        <Link
          href={`/r/${store.public_slug}/s/${token}`}
          className="mt-8 flex min-h-12 items-center justify-between border border-ink bg-ink px-4 font-bold text-white"
        >
          応募状況のページを開く<span className="num">→</span>
        </Link>
      ) : (
        <Link
          href={`/r/${store.public_slug}`}
          className="mt-8 flex min-h-12 items-center justify-center border border-ink bg-white text-sm font-bold"
        >
          予約ページに戻る
        </Link>
      )}
    </ApplicantShell>
  );
}
