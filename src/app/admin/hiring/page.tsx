import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { PageHeader, SetupNotice } from "@/components/page-header";
import { ShareBooking } from "@/components/share-booking";
import { requireAdminPage } from "@/lib/auth";
import {
  getInterviewGuide,
  getStore,
  isDatabaseConfigured,
  listBookableSlots,
  listEmployees,
  listShifts,
  listSlots,
} from "@/lib/data/store";
import { dueInfo } from "@/lib/progress";
import { addDays, formatDateShort, mondayOf, todayJst } from "@/lib/time";
import { loadReservations } from "../reservation-data";

/** 準備や予約を見る期間（今日から2週間） */
const HORIZON_DAYS = 14;

type StepState = "done" | "next" | "todo";

/**
 * 採用：店長の作業順に、5つの手順を並べる。
 * 終わった手順には ✓、まだ終わっていない最初の手順を「次はここ」として強調する。
 */
export default async function HiringPage() {
  await connection();
  await requireAdminPage();
  if (!isDatabaseConfigured()) return <SetupNotice />;
  const store = await getStore();
  if (!store) return <p className="text-sm">デモ店舗が見つかりません。seed.sql を実行してください。</p>;

  const today = todayJst();
  const until = addDays(today, HORIZON_DAYS - 1);
  const [employees, shifts, slots, bookable, guide, res] = await Promise.all([
    listEmployees(store.id),
    listShifts(store.id, today, until),
    listSlots(store.id, today, until),
    listBookableSlots(store.id),
    getInterviewGuide(store.id),
    loadReservations(store),
  ]);

  const interviewerIds = new Set(employees.filter((e) => e.is_interviewer).map((e) => e.id));
  const upcomingShifts = shifts.filter((s) => interviewerIds.has(s.employee_id));
  const interviewerShifts = upcomingShifts.length;
  // 面接枠は、一番近い面接担当のシフトがある週を開く
  const slotsHref = upcomingShifts[0] ? `/admin/slots?week=${mondayOf(upcomingShifts[0].date)}` : "/admin/slots";
  const draft = slots.filter((s) => s.status === "draft" && !s.reserved).length;
  const upcoming = res.calendar.filter((r) => r.date >= today && r.status !== "canceled");
  const todays = res.calendar
    .filter((r) => r.date === today && r.status === "booked")
    .sort((a, b) => a.start.localeCompare(b.start));
  const overdue = res.waiting.filter((r) => dueInfo(r.resultDue!, today).level !== "ok").length;
  const guideCount = guide.needsSetup ? 0 : guide.items.length;

  // どの手順まで終わっているか
  const done = {
    shift: interviewerShifts > 0,
    slots: bookable.length > 0,
    share: upcoming.length > 0,
  };
  const nextKey = !done.shift
    ? "shift"
    : !done.slots
      ? "slots"
      : !done.share
        ? "share"
        : todays.length > 0
          ? "interview"
          : res.waiting.length > 0
            ? "result"
            : null;
  const state = (key: string, isDone: boolean): StepState => (key === nextKey ? "next" : isDone ? "done" : "todo");

  return (
    <>
      <PageHeader eyebrow="HIRING" title="採用の進め方">
        {store.name}・今日は {formatDateShort(today)}
        {nextKey === null && "。準備はすべて整っています。"}
      </PageHeader>

      <ol className="space-y-3">
        {/* ① シフト表を読み込む */}
        <Step
          n={1}
          state={state("shift", done.shift)}
          title="シフト表を読み込む"
          detail={
            done.shift
              ? `これから2週間の面接担当のシフト：${interviewerShifts}件`
              : "紙のシフト表を撮影して、面接担当の勤務を入れます"
          }
        >
          <Action href="/admin/import" primary={nextKey === "shift"}>
            シフト表の写真を読み込む
          </Action>
        </Step>

        {/* ② 面接枠を作って公開する */}
        <Step
          n={2}
          state={state("slots", done.slots)}
          title="面接枠を作って公開する"
          detail={
            done.slots
              ? `応募者が予約できる枠：${bookable.length}件${draft > 0 ? `（ほかに公開待ち ${draft}件）` : ""}`
              : draft > 0
                ? `公開待ちの枠が${draft}件あります。公開すると予約できるようになります`
                : "シフトと忙しい時間から、面接枠を自動で作ります"
          }
        >
          <Action href={slotsHref} primary={nextKey === "slots"}>
            {draft > 0 && !done.slots ? "面接枠を確認して公開する" : "面接枠を作る・確認する"}
          </Action>
        </Step>

        {/* ③ 応募者に予約ページを送る */}
        <Step
          n={3}
          state={state("share", done.share)}
          title="応募者に予約ページを送る"
          detail={
            done.share ? `これからの予約：${upcoming.length}件` : "予約ページのURLを、LINEやメールで応募者に送ります"
          }
        >
          {bookable.length === 0 ? (
            <p className="text-xs text-danger">予約できる枠がないため、先に②で面接枠を公開してください。</p>
          ) : (
            <ShareBooking
              url={res.bookingUrl}
              storeName={store.name}
              variant={nextKey === "share" ? "accent" : "ink"}
              showUrl={false}
            />
          )}
        </Step>

        {/* ④ 面接する */}
        <Step
          n={4}
          state={state("interview", false)}
          title="面接する"
          detail={
            todays.length > 0
              ? `今日の面接：${todays.length}件`
              : `今日の面接はありません（これからの予約 ${upcoming.length}件）`
          }
        >
          {todays.length > 0 && (
            <ul className="mb-2 border-y border-line">
              {todays.map((r) => (
                <li key={r.id} className="flex items-center gap-3 border-b border-line py-2 last:border-b-0">
                  <span className="num w-12 text-lg font-bold">{r.start}</span>
                  <span className="min-w-0 flex-1 truncate font-bold">{r.name} さん</span>
                  <Link
                    href={`/admin/guide/run?r=${r.id}`}
                    className={`inline-flex min-h-10 shrink-0 items-center border border-ink px-3 text-sm font-bold ${
                      nextKey === "interview" ? "bg-accent" : "bg-ink text-white"
                    }`}
                  >
                    面接を始める
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Action href="/admin">予約カレンダーを見る</Action>
          {guideCount === 0 && (
            <p className="mt-2 text-xs text-gray">
              <Link href="/admin/guide" className="font-bold text-ink underline underline-offset-4">
                面接の進め方
              </Link>
              を作っておくと、アルバイトのスタッフでも面接できます。
            </p>
          )}
        </Step>

        {/* ⑤ 結果を連絡する */}
        <Step
          n={5}
          state={state("result", false)}
          title="結果を決めて連絡する"
          detail={
            res.waiting.length > 0
              ? `結果待ち：${res.waiting.length}人${overdue > 0 ? `（期限が近い・過ぎた人 ${overdue}人）` : ""}`
              : "結果を待っている人はいません"
          }
          alert={overdue > 0}
        >
          <Action href="/admin" primary={nextKey === "result"}>
            結果を決める
          </Action>
        </Step>
      </ol>
    </>
  );
}

function Step({
  n,
  state,
  title,
  detail,
  alert,
  children,
}: {
  n: number;
  state: StepState;
  title: string;
  detail: string;
  alert?: boolean;
  children: ReactNode;
}) {
  const isNext = state === "next";
  return (
    <li className={`bg-white p-4 ${isNext ? "border-2 border-ink" : "border border-ink"}`}>
      <div className="flex items-start gap-3">
        <span
          className={`num flex size-8 shrink-0 items-center justify-center border border-ink text-sm font-bold ${
            state === "done" ? "bg-ink text-white" : isNext ? "bg-accent" : "bg-white"
          }`}
          aria-label={state === "done" ? "完了" : `手順${n}`}
        >
          {state === "done" ? "✓" : n}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-bold">{title}</h2>
            {isNext && <span className="bg-ink px-1.5 py-0.5 text-[10px] font-bold text-white">次はここ</span>}
          </div>
          <p className={`mt-0.5 text-xs ${alert ? "font-bold text-danger" : "text-gray"}`}>{detail}</p>
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </li>
  );
}

/** 手順のボタン。「次はここ」の手順だけ黄色 */
function Action({ href, primary, children }: { href: string; primary?: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`flex min-h-12 items-center justify-between border border-ink px-4 text-sm font-bold ${
        primary ? "bg-accent" : "bg-white"
      }`}
    >
      {children}
      <span className="num" aria-hidden>
        →
      </span>
    </Link>
  );
}
