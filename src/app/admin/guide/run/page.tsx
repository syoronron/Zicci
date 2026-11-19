import Link from "next/link";
import { PageHeader, SetupNotice } from "@/components/page-header";
import { requireAdminPage } from "@/lib/auth";
import {
  getInterviewGuide,
  getInterviewRecord,
  getReservationBrief,
  getStore,
  isDatabaseConfigured,
  listEmployees,
} from "@/lib/data/store";
import { formatDateShort, formatTime, toJst } from "@/lib/time";
import { GuideRunner } from "./guide-runner";

export default async function GuideRunPage({ searchParams }: PageProps<"/admin/guide/run">) {
  const { r } = await searchParams;
  await requireAdminPage();
  if (!isDatabaseConfigured()) return <SetupNotice />;
  const store = await getStore();
  if (!store) return null;

  const reservationId = typeof r === "string" ? r : undefined;
  const [guide, reservation, recordState, employees] = await Promise.all([
    getInterviewGuide(store.id),
    reservationId ? getReservationBrief(store.id, reservationId) : Promise.resolve(null),
    reservationId ? getInterviewRecord(store.id, reservationId) : Promise.resolve(null),
    listEmployees(store.id),
  ]);
  const items = guide.needsSetup ? [] : guide.items;
  const start = reservation ? toJst(reservation.start_at) : null;
  const canRecord = Boolean(reservation && recordState && !recordState.needsSetup && recordState.status !== "canceled");

  return (
    <>
      <PageHeader eyebrow="INTERVIEW" title={reservation ? `${reservation.name} さんの面接` : "面接の進め方（練習）"}>
        {start ? `${formatDateShort(start.date)} ${formatTime(start.minutes)}〜` : "上から順番に進めてください。"}
      </PageHeader>
      {reservation && recordState?.needsSetup && (
        <p className="mb-3 border border-dashed border-ink p-2 text-xs leading-relaxed">
          回答を記録するには、Supabase で <span className="num">20261121000000_interview_record.sql</span> を実行してください。
        </p>
      )}
      {items.length === 0 ? (
        <div className="border border-ink bg-white p-4 text-sm leading-relaxed">
          <p className="font-bold">面接の進め方がまだ作られていません</p>
          <p className="mt-1 text-gray">店長が「面接の進め方」で、質問の流れを作ってください。</p>
          <Link href="/admin/guide" className="mt-3 inline-block font-bold underline underline-offset-4">
            面接の進め方を作る
          </Link>
        </div>
      ) : (
        <GuideRunner
          items={items}
          reservationId={reservation ? reservationId : undefined}
          canRecord={canRecord}
          initialRecord={recordState && !recordState.needsSetup ? recordState.record : null}
          staffNames={employees.map((e) => e.name)}
        />
      )}
    </>
  );
}
