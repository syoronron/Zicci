import { requireAdminPage } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { DayTimeline } from "@/components/day-timeline";
import { PageHeader, Section, SetupNotice } from "@/components/page-header";
import { ShareBooking } from "@/components/share-booking";
import { WeekNav } from "@/components/week-nav";
import { bookingUrl } from "@/lib/site-url";
import {
  getStore,
  isDatabaseConfigured,
  listBlocks,
  listEmployees,
  listShifts,
  listSlots,
  type Slot,
} from "@/lib/data/store";
import { formatDateShort, formatTime, toJst, weekdayOf } from "@/lib/time";
import { defaultWeekStart } from "@/lib/default-week";
import { resolveWeek } from "@/lib/week";
import { publishSlots, regenerateSlots, toggleSlot } from "../actions";

const STATUS_STYLE: Record<string, string> = {
  draft: "border-dashed border-ink bg-white",
  published: "border-ink bg-white",
  closed: "stripe-soft border-mist text-gray line-through",
  reserved: "border-ink bg-ink text-white",
};

export default async function SlotsPage({ searchParams }: PageProps<"/admin/slots">) {
  const { week: weekParam } = await searchParams;
  await requireAdminPage();
  if (!isDatabaseConfigured()) return <SetupNotice />;
  const store = await getStore();
  if (!store) return null;

  // 週の指定がなければ、一番近い「面接担当のシフトがある週」を表示する
  const week = resolveWeek(weekParam ?? (await defaultWeekStart(store.id)));
  const [blocks, employees, shifts, slots] = await Promise.all([
    listBlocks(store.id),
    listEmployees(store.id),
    listShifts(store.id, week.from, week.to),
    listSlots(store.id, week.from, week.to),
  ]);
  const interviewers = employees.filter((e) => e.is_interviewer);
  const nameOf = new Map(employees.map((e) => [e.id, e.name]));
  const count = (st: Slot["status"]) => slots.filter((s) => s.status === st && !s.reserved).length;
  const draft = count("draft");
  const published = count("published");
  const reserved = slots.filter((s) => s.reserved).length;
  const url = await bookingUrl(store.public_slug);

  return (
    <>
      <PageHeader eyebrow="STEP 2・3" title="面接枠">
        ① 面接枠を作る → ② 内容を確認して公開 → ③ 予約ページを応募者に送る、の順に進めます。
      </PageHeader>

      <div className="space-y-4">
        <WeekNav week={week} basePath="/admin/slots" />

        <Section>
          <dl className="num grid grid-cols-3 border border-ink text-center">
            <div className="border-r border-ink py-2">
              <dt className="text-[10px] text-gray">公開待ち</dt>
              <dd className="text-2xl font-bold">{draft}</dd>
            </div>
            <div className="border-r border-ink py-2">
              <dt className="text-[10px] text-gray">公開中</dt>
              <dd className="text-2xl font-bold">{published}</dd>
            </div>
            <div className="py-2">
              <dt className="text-[10px] text-gray">予約済み</dt>
              <dd className="text-2xl font-bold">{reserved}</dd>
            </div>
          </dl>
          <div className="mt-3 grid gap-2">
            <ActionForm
              action={regenerateSlots}
              confirm={
                published > 0
                  ? "公開中の枠も含めて作り直します（予約済みの枠はそのまま残ります）。作り直した枠はもう一度公開が必要です。よろしいですか？"
                  : undefined
              }
            >
              <input type="hidden" name="week" value={week.from} />
              <SubmitButton variant="ink" className="w-full" pendingText="作成中…">
                面接枠を作り直す
              </SubmitButton>
            </ActionForm>
            {/* 公開待ちがあるときだけ公開ボタンを出す（ActionForm は結果メッセージのため常に置く） */}
            <ActionForm action={publishSlots}>
              <input type="hidden" name="week" value={week.from} />
              {draft > 0 && (
                <SubmitButton variant="accent" className="w-full" pendingText="公開中…">
                  公開待ちの{draft}件を公開する
                </SubmitButton>
              )}
            </ActionForm>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-gray">
            面接 {store.interview_minutes}分 ／ 出勤直後・退勤直前の {store.shift_buffer_minutes}分は除外 ／ 面接担当{" "}
            {interviewers.length}人
          </p>
        </Section>

        {published > 0 && (
          <Section title="応募者に共有する">
            <p className="mb-3 text-sm text-gray">
              公開中の{published}件は、予約ページから予約できます。URLを応募者に送ってください。
            </p>
            {/* 黄色は1画面に1か所：公開ボタンがないときは共有ボタンを黄色に */}
            <ShareBooking url={url} storeName={store.name} showUrl={false} variant={draft > 0 ? "ink" : "accent"} />
          </Section>
        )}

        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray" aria-label="凡例">
          {[
            ["draft", "公開待ち"],
            ["published", "公開中"],
            ["closed", "受け付けない"],
            ["reserved", "予約済み"],
          ].map(([k, label]) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className={`inline-block size-3 border ${STATUS_STYLE[k]}`} />
              {label}
            </li>
          ))}
        </ul>

        {week.days.map((day) => {
          const wd = weekdayOf(day);
          const daySlots = slots.filter((s) => toJst(s.start_at).date === day);
          const dayBlocks = blocks.filter((b) => b.weekday === null || b.weekday === wd);
          const rows = interviewers
            .map((e) => ({
              label: e.name,
              bars: shifts.filter((s) => s.employee_id === e.id && s.date === day),
            }))
            .filter((r) => r.bars.length > 0);
          if (rows.length === 0 && daySlots.length === 0) {
            return (
              <Section key={day} title={formatDateShort(day)}>
                <p className="text-sm text-gray">面接担当のシフトがありません</p>
              </Section>
            );
          }
          return (
            <Section
              key={day}
              title={formatDateShort(day)}
              aside={<span className="num text-xs text-gray">{daySlots.length}枠</span>}
            >
              <DayTimeline blocks={dayBlocks} rows={rows} />
              {daySlots.length > 0 ? (
                <ul className="mt-4 grid grid-cols-3 gap-2">
                  {daySlots.map((s) => {
                    const state = s.reserved ? "reserved" : s.status;
                    const names = s.interviewer_ids.map((id) => nameOf.get(id)).filter(Boolean).join("・");
                    return (
                      <li key={s.id}>
                        <ActionForm action={toggleSlot} silentSuccess messageClassName="text-xs">
                          <input type="hidden" name="id" value={s.id} />
                          <button
                            type="submit"
                            disabled={s.reserved}
                            title={`対応できる人：${names}`}
                            aria-label={`${formatTime(toJst(s.start_at).minutes)} ${
                              { draft: "公開待ち", published: "公開中", closed: "受け付けない", reserved: "予約済み" }[state]
                            }。タップで切り替え`}
                            className={`flex min-h-12 w-full flex-col items-center justify-center border ${STATUS_STYLE[state]}`}
                          >
                            <span className="num text-sm font-semibold">{formatTime(toJst(s.start_at).minutes)}</span>
                            <span className="text-[10px] leading-tight opacity-80">
                              {s.reserved ? "予約済み" : `${s.interviewer_ids.length}名対応`}
                            </span>
                          </button>
                        </ActionForm>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-gray">この日は面接枠がありません</p>
              )}
            </Section>
          );
        })}

        <p className="text-xs leading-relaxed text-gray">
          枠をタップすると「受け付けない」に切り替わります。もう一度タップすると公開待ちに戻ります。
        </p>
      </div>
    </>
  );
}
