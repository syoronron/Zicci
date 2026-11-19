import { connection } from "next/server";
import { PageHeader, SetupNotice } from "@/components/page-header";
import { requireAdminPage } from "@/lib/auth";
import { getStore, isDatabaseConfigured } from "@/lib/data/store";
import { loadReservations } from "../reservation-data";
import { ReservationCalendar } from "../reservation-calendar";
import { WaitingList } from "../waiting-list";

/** 予約・面接：予約カレンダーと、結果の連絡を待っている人 */
export default async function ReservationsPage({ searchParams }: PageProps<"/admin/reservations">) {
  const { d } = await searchParams;
  await connection();
  await requireAdminPage();
  if (!isDatabaseConfigured()) return <SetupNotice />;
  const store = await getStore();
  if (!store) return null;
  const { today, calendar, waiting } = await loadReservations(store);

  return (
    <>
      <PageHeader eyebrow="STEP 4・5" title="予約・面接">
        日付を選ぶと、その日の予約が出ます。「面接を始める」から面接を進め、終わったら結果を決めましょう。
      </PageHeader>
      <div className="space-y-4">
        <WaitingList waiting={waiting} today={today} />
        <ReservationCalendar
          reservations={calendar}
          today={today}
          initialDate={typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined}
        />
      </div>
    </>
  );
}
