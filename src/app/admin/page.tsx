import { connection } from "next/server";
import { PageHeader, SetupNotice } from "@/components/page-header";
import { requireAdminPage } from "@/lib/auth";
import { getStore, isDatabaseConfigured } from "@/lib/data/store";
import { loadReservations } from "./reservation-data";
import { ReservationCalendar } from "./reservation-calendar";
import { NewBookings, TodayInterviews } from "./home-highlights";
import { WaitingList } from "./waiting-list";

/** ホーム（予約・面接）：今日の面接、新しい予約、結果の連絡を待っている人、予約カレンダー */
export default async function AdminHome({ searchParams }: PageProps<"/admin">) {
  const { d } = await searchParams;
  await connection();
  await requireAdminPage();
  if (!isDatabaseConfigured()) return <SetupNotice />;
  const store = await getStore();
  if (!store) return null;
  const { today, now, calendar, waiting, todays, fresh } = await loadReservations(store);

  return (
    <>
      <PageHeader eyebrow="HOME" title="予約・面接">
        今日の面接と新しい予約を上に表示しています。カレンダーで日付を選ぶと、その日の予約が出ます。
      </PageHeader>
      <div className="space-y-4">
        <TodayInterviews list={todays} />
        <NewBookings list={fresh} now={now} />
        <WaitingList waiting={waiting} today={today} />
        <ReservationCalendar
          // 結果待ちの一覧から日付を選んだとき（?d= が変わったとき）に、その日を開き直す
          key={typeof d === "string" ? d : "today"}
          reservations={calendar}
          today={today}
          initialDate={
            typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)
              ? d
              : undefined
          }
        />
      </div>
    </>
  );
}
