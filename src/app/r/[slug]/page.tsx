import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getChangePrefill, getStoreBySlug, isDatabaseConfigured, listBookableSlots } from "@/lib/data/store";
import { formatDateShort, formatPhone, formatTime, todayJst, toJst, weekdayLabel, weekdayOf } from "@/lib/time";
import { ApplicantShell } from "./applicant-shell";
import { BookingForm, type BookingDay } from "./booking-form";

export default function BookingPage({ params, searchParams }: PageProps<"/r/[slug]">) {
  return (
    <Suspense fallback={<ApplicantShell>{null}</ApplicantShell>}>
      <Booking params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Booking({
  params,
  searchParams,
}: {
  params: PageProps<"/r/[slug]">["params"];
  searchParams: PageProps<"/r/[slug]">["searchParams"];
}) {
  await connection();
  const [{ slug }, { changed, from }] = await Promise.all([params, searchParams]);
  if (!isDatabaseConfigured()) notFound();
  const store = await getStoreBySlug(slug);
  if (!store) notFound();

  const [slots, prefill] = await Promise.all([
    listBookableSlots(store.id),
    typeof from === "string" ? getChangePrefill(store.id, from) : Promise.resolve(null),
  ]);
  const days: BookingDay[] = [];
  for (const s of slots) {
    const start = toJst(s.start_at);
    const end = toJst(s.end_at);
    let day = days.find((d) => d.date === start.date);
    if (!day) {
      const [, m, d] = start.date.split("-").map(Number);
      day = {
        date: start.date,
        month: m,
        day: d,
        weekday: weekdayLabel(weekdayOf(start.date)),
        label: formatDateShort(start.date),
        slots: [],
      };
      days.push(day);
    }
    day.slots.push({ id: s.id, start: formatTime(start.minutes), end: formatTime(end.minutes || 1440) });
  }

  return (
    <ApplicantShell storeName={store.name} address={store.address}>
      {changed === "1" && (
        <p role="status" className="mt-6 border border-dashed border-ink bg-white p-3 text-sm">
          前の予約を取り消しました。新しい日時を選んでください。
          {prefill && "お名前と連絡先は、前回の内容を入れてあります。"}
        </p>
      )}
      <h1 className="mt-6 text-2xl font-bold">面接の日時を選んでください</h1>
      {days.length === 0 ? (
        <div className="mt-6 border border-ink bg-white p-4 text-sm leading-relaxed">
          <p className="font-bold">現在、予約できる面接の時間がありません</p>
          <p className="mt-1 text-gray">時間をおいてもう一度ご確認いただくか、お店に直接お問い合わせください。</p>
        </div>
      ) : (
        <BookingForm
          slug={store.public_slug}
          days={days}
          today={todayJst()}
          prefill={prefill ? { ...prefill, phone: prefill.phone ? formatPhone(prefill.phone) : "" } : undefined}
        />
      )}
    </ApplicantShell>
  );
}
