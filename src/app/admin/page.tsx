import Link from "next/link";
import { connection } from "next/server";
import { requireAdminPage } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";
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
import { cancelReservation } from "./actions";
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
    // 今日以降の予約
    listReservations(store.id, jstToDate(todayJst(), 0).toISOString()),
    listBookableSlots(store.id),
    bookingUrl(store.public_slug),
  ]);
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
        <Section
          title="これからの面接"
          aside={<span className="num text-xs text-gray">{reservations.length}件</span>}
        >
          {reservations.length === 0 ? (
            <p className="text-sm text-gray">まだ予約はありません。面接枠を公開して、予約ページのURLを応募者に送りましょう。</p>
          ) : (
            <ul className="-mx-4 border-t border-line">
              {reservations.map((r) => {
                const start = toJst(r.start_at);
                return (
                  <li key={r.id} className="border-b border-line px-4 py-3 last:border-b-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="num font-bold">
                        {formatDateShort(start.date)} {formatTime(start.minutes)}
                      </p>
                      <p className="text-xs text-gray">担当：{r.interviewer_name ?? "未定"}</p>
                    </div>
                    <p className="mt-1 text-lg font-bold">{r.applicant_name} さん</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {r.phone && (
                        <a
                          href={`tel:${r.phone}`}
                          className="num inline-flex min-h-10 items-center border border-ink bg-white px-3 text-sm font-semibold"
                        >
                          {formatPhone(r.phone)}
                        </a>
                      )}
                      {r.email && (
                        <a
                          href={`mailto:${r.email}`}
                          className="inline-flex min-h-10 max-w-full items-center truncate border border-ink bg-white px-3 text-sm"
                        >
                          {r.email}
                        </a>
                      )}
                      <ActionForm
                        action={cancelReservation}
                        confirm={`${r.applicant_name}さんの予約を取り消しますか？応募者には自動で連絡されないので、必要なら電話などで伝えてください。`}
                        className="ml-auto"
                      >
                        <input type="hidden" name="id" value={r.id} />
                        <SubmitButton variant="danger" pendingText="…">
                          取り消す
                        </SubmitButton>
                      </ActionForm>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
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
