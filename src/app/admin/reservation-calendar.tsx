"use client";

import Link from "next/link";
import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { dayLabel, MonthGrid } from "@/components/month-grid";
import { TIME_OPTIONS } from "@/components/time-select";
import { EVALUATION_LABEL, type Evaluation } from "@/lib/interview-record";
import {
  dueInfo,
  milestones,
  STATUS_LABEL,
  type ReservationStatus,
} from "@/lib/progress";
import {
  cancelReservation,
  deleteCanceledReservation,
  markInterviewed,
  setFirstDay,
  setResult,
} from "./actions";

export type CalendarReservation = {
  id: string;
  date: string; // YYYY-MM-DD（日本時間）
  start: string; // HH:MM
  end: string;
  name: string;
  phone: string | null; // 表示用（ハイフン付き）
  phoneRaw: string | null; // 発信用
  email: string | null;
  interviewer: string | null;
  status: ReservationStatus;
  resultDue: string | null;
  firstDayDate: string | null;
  firstDayTime: string | null;
  statusUrl: string | null; // 応募者専用ページ
  canceledReason: string | null;
  createdAt: string; // 予約が入った日時（ISO）
  acknowledged: boolean | null; // 代表者が確認したか（null は確認の記録が使えない）
  evaluation: Evaluation | null; // 面接の総合評価
  hasRecord: boolean;
};

const shortDate = (date: string) =>
  `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`;

const BADGE: Record<ReservationStatus, string> = {
  booked: "border border-ink bg-white",
  interviewed: "bg-ink text-white",
  passed: "border border-ink bg-accent",
  rejected: "border border-mist bg-white text-gray",
  canceled: "stripe-soft border border-mist text-gray",
};

/** 予約のカレンダー。日付をタップすると、その日の予約が時間順に並ぶ */
export function ReservationCalendar({
  reservations,
  openSlots = {},
  today,
  initialDate,
}: {
  reservations: CalendarReservation[];
  /** 日付ごとの、予約が入っていない公開中の面接枠（開始時刻） */
  openSlots?: Record<string, string[]>;
  today: string;
  initialDate?: string;
}) {
  const active = reservations.filter((r) => r.status !== "canceled");
  const upcoming = active.find((r) => r.date >= today);
  const [selected, setSelected] = useState(
    initialDate ?? upcoming?.date ?? today,
  );
  const [month, setMonth] = useState(selected.slice(0, 7));

  const byDate = new Map<string, CalendarReservation[]>();
  for (const r of reservations)
    byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]);
  const dayList = (byDate.get(selected) ?? [])
    .slice()
    .sort((a, b) => a.start.localeCompare(b.start));
  const upcomingCount = active.filter((r) => r.date >= today).length;
  const openList = openSlots[selected] ?? [];

  return (
    <section className="border border-ink bg-white">
      {/* 見出し */}
      <div className="flex items-center justify-between gap-2 border-b border-ink px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <span className="inline-block size-1.5 bg-ink" aria-hidden />
          面接の予約
        </h2>
        <span className="num text-xs text-gray">
          これから {upcomingCount}件
        </span>
      </div>

      {/* カレンダー（予約の数・空き枠がある日に印） */}
      <div className="px-2 pt-2 pb-3">
        <MonthGrid
          month={month}
          onMonthChange={setMonth}
          selected={selected}
          onSelect={setSelected}
          today={today}
          badge={(date) => {
            const count = (byDate.get(date) ?? []).filter((r) => r.status !== "canceled").length;
            return count > 0 ? { text: `${count}件`, tone: "ink" } : null;
          }}
          mark={(date) => (openSlots[date]?.length ?? 0) > 0}
          labelFor={(date) =>
            `${dayLabel(date)} 予約${(byDate.get(date) ?? []).filter((r) => r.status !== "canceled").length}件 空き枠${openSlots[date]?.length ?? 0}件`
          }
        />
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-gray">
          <span className="inline-block size-2 rounded-full border border-ink" aria-hidden />
          空いている面接枠がある日
        </p>
      </div>

      {/* 選んだ日の予約 */}
      <div className="border-t border-ink px-4 py-3">
        <p className="text-sm font-bold">
          {dayLabel(selected)}
          <span className="num ml-2 text-xs font-normal text-gray">
            {dayList.filter((r) => r.status !== "canceled").length}件
          </span>
        </p>
        {dayList.length === 0 ? (
          <p className="mt-2 text-sm text-gray">この日の予約はありません。</p>
        ) : (
          <ol className="mt-3 space-y-4">
            {dayList.map((r) => (
              <ReservationItem key={r.id} r={r} today={today} />
            ))}
          </ol>
        )}

        {/* その日の、まだ予約が入っていない面接枠 */}
        <div className="mt-4 border-t border-line pt-3">
          <p className="text-xs font-bold">
            空いている面接枠 <span className="num font-normal text-gray">{openList.length}件</span>
          </p>
          {openList.length === 0 ? (
            <p className="mt-1 text-xs text-gray">この日に予約できる面接枠はありません。</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="空いている面接枠">
              {openList.map((t) => (
                <li key={t} className="num border border-ink bg-white px-2.5 py-1 text-sm font-semibold">
                  {t}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function ReservationItem({
  r,
  today,
}: {
  r: CalendarReservation;
  today: string;
}) {
  const canceled = r.status === "canceled";
  // 結果が出た人（採用・見送り）と辞退した人は、最初は折りたたんでおく
  const decided = r.status === "passed" || r.status === "rejected" || canceled;
  const [open, setOpen] = useState(!decided);
  return (
    <li
      className={`grid grid-cols-[3.5rem_1fr] gap-3 ${canceled ? "text-gray" : ""}`}
    >
      <div className="num border-r border-ink pr-2 text-right">
        <p
          className={`text-lg leading-tight font-bold ${canceled ? "line-through" : ""}`}
        >
          {r.start}
        </p>
        <p className="text-[11px] text-gray">〜{r.end}</p>
      </div>
      <div className="min-w-0">
        {decided ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex w-full flex-wrap items-center gap-2 text-left"
          >
            <span className="text-base font-bold">{r.name} さん</span>
            <span
              className={`px-1.5 py-0.5 text-[11px] font-bold ${BADGE[r.status]}`}
            >
              {STATUS_LABEL[r.status]}
            </span>
            <span className="ml-auto flex items-center gap-1 text-xs text-gray">
              {open ? "閉じる" : "開く"}
              <span className="num" aria-hidden>
                {open ? "▴" : "▾"}
              </span>
            </span>
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-bold">{r.name} さん</p>
            <span
              className={`px-1.5 py-0.5 text-[11px] font-bold ${BADGE[r.status]}`}
            >
              {STATUS_LABEL[r.status]}
            </span>
          </div>
        )}

        {/* 折りたたみ中は、結果のひとことだけ */}
        {decided && !open && (
          <p className="mt-0.5 text-xs text-gray">
            {r.status === "passed"
              ? `初出勤：${r.firstDayDate ? `${shortDate(r.firstDayDate)} ${r.firstDayTime ?? ""}` : "未定"}`
              : r.status === "rejected"
                ? "お礼のメッセージを表示中"
                : r.canceledReason === "日時変更"
                  ? "日時の変更のため取り消し（枠は空いています）"
                  : "応募者が辞退（枠は空いています）"}
            {r.evaluation && `　評価：${EVALUATION_LABEL[r.evaluation]}`}
          </p>
        )}

        {(!decided || open) && (
          <>
            <p className="text-xs text-gray">
              担当：{r.interviewer ?? "未定"}
              {r.evaluation && (
                <span className="ml-2 font-bold text-ink">
                  評価：{EVALUATION_LABEL[r.evaluation]}
                </span>
              )}
            </p>

            {/* 進み具合（4段階） */}
            {!canceled && (
              <div className="mt-2 flex gap-0.5" aria-label="進み具合">
                {milestones(r.status).map((m) => (
                  <span
                    key={m.key}
                    title={m.label}
                    className={`h-1 flex-1 ${m.state === "done" ? "bg-ink" : m.state === "current" ? "bg-accent" : "bg-line"}`}
                  />
                ))}
              </div>
            )}

            {canceled && (
              <div className="mt-1 flex items-start justify-between gap-2">
                <p className="text-sm">
                  応募者が
                  {r.canceledReason === "日時変更"
                    ? "日時の変更のため取り消しました"
                    : "辞退しました"}
                  （枠は空いています）
                </p>
                <ActionForm
                  action={deleteCanceledReservation}
                  confirm={`${r.name}さんの取り消された予約を、一覧から削除しますか？`}
                  silentSuccess
                  className="shrink-0"
                >
                  <input type="hidden" name="id" value={r.id} />
                  <SubmitButton variant="danger" pendingText="…">
                    削除
                  </SubmitButton>
                </ActionForm>
              </div>
            )}

            {/* 選考中：結果連絡の期限 */}
            {r.status === "interviewed" && r.resultDue && (
              <DueLine due={r.resultDue} today={today} />
            )}

            {/* 連絡先 */}
            {!canceled && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {r.phone && (
                  <a
                    href={`tel:${r.phoneRaw}`}
                    className="num inline-flex min-h-10 items-center border border-ink bg-white px-3 text-sm font-semibold"
                  >
                    {r.phone}
                  </a>
                )}
                {r.email && (
                  <a
                    href={`mailto:${r.email}`}
                    className="inline-flex min-h-10 items-center border border-ink bg-white px-3 text-sm"
                  >
                    メール
                  </a>
                )}
              </div>
            )}

            {/* 段階ごとの操作 */}
            {r.status === "booked" && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {r.date >= today && (
                  <Link
                    href={`/admin/guide/run?r=${r.id}`}
                    className="inline-flex min-h-10 items-center border border-ink bg-ink px-3 text-sm font-bold text-white"
                  >
                    面接を始める
                  </Link>
                )}
                {r.statusUrl && (
                  <ActionForm action={markInterviewed} silentSuccess>
                    <input type="hidden" name="id" value={r.id} />
                    <SubmitButton
                      variant="outline"
                      className="min-h-10! px-3! text-sm"
                      pendingText="…"
                    >
                      面接済みにする
                    </SubmitButton>
                  </ActionForm>
                )}
                {r.date >= today && (
                  <ActionForm
                    action={cancelReservation}
                    confirm={`${r.name}さんの予約を取り消しますか？応募者には自動で連絡されないので、必要なら電話などで伝えてください。`}
                    className="ml-auto"
                  >
                    <input type="hidden" name="id" value={r.id} />
                    <SubmitButton variant="danger" pendingText="…">
                      取り消す
                    </SubmitButton>
                  </ActionForm>
                )}
              </div>
            )}

            {r.status === "interviewed" && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <ResultButton
                  id={r.id}
                  result="passed"
                  label="採用"
                  confirm={`${r.name}さんを採用にしますか？応募者のページに入店案内が表示されます。`}
                />
                <ResultButton
                  id={r.id}
                  result="rejected"
                  label="見送り"
                  confirm={`${r.name}さんを見送りにしますか？応募者のページにお礼のメッセージが表示されます。`}
                />
              </div>
            )}

            {r.status === "passed" && (
              <ActionForm
                action={setFirstDay}
                className="mt-2 border border-ink p-2"
              >
                <input type="hidden" name="id" value={r.id} />
                <p className="text-xs font-bold">
                  初出勤の日時（応募者のページに表示）
                </p>
                <div className="mt-1 grid grid-cols-[3fr_2fr] gap-1.5">
                  <input
                    type="date"
                    name="date"
                    defaultValue={r.firstDayDate ?? ""}
                    aria-label="初出勤の日"
                    className="field num min-w-0 px-2!"
                  />
                  <select
                    name="time"
                    defaultValue={r.firstDayTime ?? ""}
                    aria-label="初出勤の時刻"
                    className="field num min-w-0 px-1.5!"
                  >
                    <option value="">時刻</option>
                    {TIME_OPTIONS.slice(0, -1).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <SubmitButton
                  variant="outline"
                  className="mt-1.5 min-h-11! w-full"
                  pendingText="保存中…"
                >
                  初出勤の日時を保存
                </SubmitButton>
              </ActionForm>
            )}

            {r.status === "rejected" && (
              <p className="mt-2 text-sm text-gray">
                応募者のページに、お礼のメッセージを表示しています。
              </p>
            )}

            {(r.status === "passed" || r.status === "rejected") && (
              <ActionForm action={setResult} silentSuccess className="mt-1">
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="result" value="interviewed" />
                <SubmitButton variant="quiet" pendingText="…">
                  選考中に戻す
                </SubmitButton>
              </ActionForm>
            )}

            {r.hasRecord && !canceled && (
              <Link
                href={`/admin/guide/record?r=${r.id}`}
                className="mt-2 flex min-h-10 items-center justify-between border border-ink bg-white px-3 text-sm font-bold"
              >
                面接の記録を見る<span className="num">→</span>
              </Link>
            )}

            {r.statusUrl && (
              <a
                href={r.statusUrl}
                target="_blank"
                rel="noopener"
                className="mt-1 inline-block text-xs text-gray underline underline-offset-4"
              >
                応募者に見えているページを確認
              </a>
            )}
          </>
        )}
      </div>
    </li>
  );
}

function ResultButton({
  id,
  result,
  label,
  confirm,
}: {
  id: string;
  result: "passed" | "rejected";
  label: string;
  confirm: string;
}) {
  return (
    <ActionForm action={setResult} confirm={confirm} silentSuccess>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="result" value={result} />
      <SubmitButton
        variant={result === "passed" ? "ink" : "outline"}
        className="min-h-11! w-full text-sm"
        pendingText="…"
      >
        {label}
      </SubmitButton>
    </ActionForm>
  );
}

function DueLine({ due, today }: { due: string; today: string }) {
  const info = dueInfo(due, today);
  const tone =
    info.level === "overdue"
      ? "bg-danger text-white"
      : info.level === "ok"
        ? "border border-line text-gray"
        : "border border-danger text-danger";
  return (
    <p className={`mt-2 inline-block px-2 py-1 text-xs font-bold ${tone}`}>
      結果連絡の期限 {shortDate(due)}　{info.label}
    </p>
  );
}
