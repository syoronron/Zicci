import Link from "next/link";
import { connection } from "next/server";
import { requireAdminPage } from "@/lib/auth";
import { PageHeader, Section, SetupNotice } from "@/components/page-header";
import { ShareBooking } from "@/components/share-booking";
import { bookingUrl } from "@/lib/site-url";
import {
  getStore,
  isDatabaseConfigured,
  listBookableSlots,
  listEmployees,
  listReservations,
  listShifts,
  listSlots,
} from "@/lib/data/store";
import { formatDateShort, formatPhone, formatTime, jstToDate, todayJst, toJst } from "@/lib/time";
import { ReservationCalendar, type CalendarReservation } from "./reservation-calendar";
import { resolveWeek } from "@/lib/week";

export default async function AdminHome() {
  await connection();
  await requireAdminPage();
  if (!isDatabaseConfigured()) return <SetupNotice />;
  const store = await getStore();
  if (!store) return <p className="text-sm">デモ店舗が見つかりません。seed.sql を実行してください。</p>;

  const week = resolveWeek(undefined);
  const [employees, shifts, slots, reservations, bookable, url] = await Promise.all([
    listEmployees(store.id),
    listShifts(store.id, week.from, week.to),
    listSlots(store.id, week.from, week.to),
    // 今月1日以降の予約（カレンダーで今月の過去分も見られるように）
    listReservations(store.id, jstToDate(`${todayJst().slice(0, 8)}01`, 0).toISOString()),
    listBookableSlots(store.id),
    bookingUrl(store.public_slug),
  ]);
  const today = todayJst();
  const calendar: CalendarReservation[] = reservations.map((r) => {
    const start = toJst(r.start_at);
    const end = toJst(r.end_at);
    return {
      id: r.id,
      date: start.date,
      start: formatTime(start.minutes),
      end: formatTime(end.minutes || 1440),
      name: r.applicant_name,
      phone: r.phone ? formatPhone(r.phone) : null,
      phoneRaw: r.phone,
      email: r.email,
      interviewer: r.interviewer_name,
    };
  });
  const interviewers = employees.filter((e) => e.is_interviewer);
  const interviewerShifts = shifts.filter((s) => interviewers.some((e) => e.id === s.employee_id));
  const published = slots.filter((s) => s.status === "published").length;
  const draft = slots.filter((s) => s.status === "draft").length;

  const steps = [
    {
      done: interviewers.length > 0,
      title: "面接担当を選ぶ",
      detail: `面接担当 ${interviewers.length}人`,
      href: "/admin/staff",
    },
    {
      done: interviewerShifts.length > 0,
      title: "シフトを入力する",
      detail: `今週のシフト ${interviewerShifts.length}件`,
      href: "/admin/shifts",
    },
    {
      done: slots.length > 0,
      title: "面接枠を作る",
      detail: `公開待ち ${draft}件`,
      href: "/admin/slots",
    },
    {
      done: published > 0,
      title: "面接枠を公開する",
      detail: `公開中 ${published}件`,
      href: "/admin/slots",
    },
  ];

  return (
    <>
      <PageHeader eyebrow="HOME" title={store.name}>
        今週は {formatDateShort(week.from)}〜{formatDateShort(week.to)}
      </PageHeader>

      <div className="mb-4">
        <ReservationCalendar reservations={calendar} today={today} />
      </div>

      <div className="mb-4">
        <Section
          title="予約ページ"
          aside={<span className="num text-xs text-gray">予約できる枠 {bookable.length}件</span>}
        >
          {bookable.length === 0 && (
            <p className="mb-3 text-sm font-medium text-danger">
              いま予約できる面接枠がありません。「面接枠」で枠を作って公開してから共有してください。
            </p>
          )}
          <ShareBooking url={url} storeName={store.name} variant="accent" showUrl={false} />
        </Section>
      </div>

      <h2 className="mb-2 text-sm font-bold">今週の準備状況</h2>
      <ol className="border border-ink bg-white">
        {steps.map((step, i) => (
          <li key={step.title} className="border-b border-line last:border-b-0">
            <Link href={step.href} className="flex min-h-16 items-center gap-3 px-4 py-3">
              <span
                className={`num flex size-7 shrink-0 items-center justify-center border border-ink text-xs font-bold ${
                  step.done ? "bg-ink text-white" : "bg-white"
                }`}
              >
                {step.done ? "✓" : i + 1}
              </span>
              <span className="flex-1">
                <span className="block font-bold">{step.title}</span>
                <span className="num block text-xs text-gray">{step.detail}</span>
              </span>
              <span className="num text-gray" aria-hidden>
                →
              </span>
            </Link>
          </li>
        ))}
      </ol>


    </>
  );
}
