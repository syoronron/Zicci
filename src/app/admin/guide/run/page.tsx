import Link from "next/link";
import { PageHeader, SetupNotice } from "@/components/page-header";
import { requireAdminPage } from "@/lib/auth";
import { getInterviewGuide, getReservationBrief, getStore, isDatabaseConfigured } from "@/lib/data/store";
import { formatDateShort, formatTime, toJst } from "@/lib/time";
import { GuideRunner } from "./guide-runner";

export default async function GuideRunPage({ searchParams }: PageProps<"/admin/guide/run">) {
  const { r } = await searchParams;
  await requireAdminPage();
  if (!isDatabaseConfigured()) return <SetupNotice />;
  const store = await getStore();
  if (!store) return null;

  const [guide, reservation] = await Promise.all([
    getInterviewGuide(store.id),
    typeof r === "string" ? getReservationBrief(store.id, r) : Promise.resolve(null),
  ]);
  const items = guide.needsSetup ? [] : guide.items;
  const start = reservation ? toJst(reservation.start_at) : null;

  return (
    <>
      <PageHeader eyebrow="INTERVIEW" title={reservation ? `${reservation.name} さんの面接` : "面接の進め方"}>
        {start ? `${formatDateShort(start.date)} ${formatTime(start.minutes)}〜` : "上から順番に進めてください。"}
      </PageHeader>
      {items.length === 0 ? (
        <div className="border border-ink bg-white p-4 text-sm leading-relaxed">
          <p className="font-bold">面接の進め方がまだ作られていません</p>
          <p className="mt-1 text-gray">店長が「面接の進め方」で、質問の流れを作ってください。</p>
          <Link href="/admin/guide" className="mt-3 inline-block font-bold underline underline-offset-4">
            面接の進め方を作る
          </Link>
        </div>
      ) : (
        <GuideRunner items={items} reservationId={reservation ? (r as string) : undefined} />
      )}
    </>
  );
}
