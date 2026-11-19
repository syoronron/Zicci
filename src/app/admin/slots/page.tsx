import { PageHeader, SetupNotice } from "@/components/page-header";
import { requireAdminPage } from "@/lib/auth";
import {
  getStore,
  isDatabaseConfigured,
  listBlocks,
  listEmployees,
  listShifts,
  listSlots,
} from "@/lib/data/store";
import { defaultDay } from "@/lib/default-week";
import { bookingUrl } from "@/lib/site-url";
import { addDays, formatTime, isDateString, mondayOf, todayJst, toJst, weekdayOf } from "@/lib/time";
import { SlotPlanner, type DayPlan } from "./slot-planner";

export default async function SlotsPage({ searchParams }: PageProps<"/admin/slots">) {
  const { d, week } = await searchParams;
  await requireAdminPage();
  if (!isDatabaseConfigured()) return <SetupNotice />;
  const store = await getStore();
  if (!store) return null;

  // 選ぶ日：?d= → 以前の ?week=（その週の月曜） → 一番近い面接担当のシフトがある日
  const selected =
    typeof d === "string" && isDateString(d)
      ? d
      : typeof week === "string" && isDateString(week)
        ? week
        : await defaultDay(store.id);
  const month = selected.slice(0, 7);
  // カレンダーに並ぶ範囲（月の1日を含む週の月曜 〜 月末を含む週の日曜）
  const from = mondayOf(`${month}-01`);
  const lastDay = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const to = addDays(mondayOf(lastDay), 6);

  const [blocks, employees, shifts, slots, url] = await Promise.all([
    listBlocks(store.id),
    listEmployees(store.id),
    listShifts(store.id, from, to),
    listSlots(store.id, from, to),
    bookingUrl(store.public_slug),
  ]);
  const interviewers = employees.filter((e) => e.is_interviewer);
  const nameOf = new Map(employees.map((e) => [e.id, e.name]));

  // 日ごとの表示内容
  const plans: Record<string, DayPlan> = {};
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const wd = weekdayOf(day);
    plans[day] = {
      slots: slots
        .filter((s) => toJst(s.start_at).date === day)
        .map((s) => ({
          id: s.id,
          time: formatTime(toJst(s.start_at).minutes),
          status: s.status,
          reserved: s.reserved,
          count: s.interviewer_ids.length,
          names: s.interviewer_ids.map((id) => nameOf.get(id)).filter(Boolean).join("・"),
        })),
      blocks: blocks.filter((b) => b.weekday === null || b.weekday === wd).map((b) => ({ start: b.start, end: b.end })),
      rows: interviewers
        .map((e) => ({
          label: e.name,
          bars: shifts.filter((s) => s.employee_id === e.id && s.date === day).map((s) => ({ start: s.start, end: s.end })),
        }))
        .filter((r) => r.bars.length > 0),
    };
  }

  return (
    <>
      <PageHeader eyebrow="STEP 2・3" title="面接枠">
        日付を押すと、その日の面接枠が出ます。作る → 公開 → 予約ページを送る、の順に進めます。
      </PageHeader>
      <SlotPlanner
        key={selected}
        month={month}
        initialDate={selected}
        today={todayJst()}
        plans={plans}
        info={`面接 ${store.interview_minutes}分 ／ 出勤直後・退勤直前の ${store.shift_buffer_minutes}分は除外 ／ 面接担当 ${interviewers.length}人`}
        bookingUrl={url}
        storeName={store.name}
      />
    </>
  );
}
