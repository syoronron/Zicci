"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { DayTimeline } from "@/components/day-timeline";
import { dayLabel, MonthGrid } from "@/components/month-grid";
import { ShareBooking } from "@/components/share-booking";
import { addDays, formatDateShort, mondayOf } from "@/lib/time";
import { publishSlots, regenerateSlots, toggleSlot } from "../actions";

export type SlotView = {
  id: string;
  time: string;
  status: "draft" | "published" | "closed";
  reserved: boolean;
  count: number; // 対応できる人数
  names: string; // 対応できる人
};

export type DayPlan = {
  slots: SlotView[];
  blocks: { start: number; end: number }[];
  rows: { label: string; bars: { start: number; end: number }[] }[];
};

const STATUS_STYLE: Record<string, string> = {
  draft: "border-dashed border-ink bg-white",
  published: "border-ink bg-white",
  closed: "stripe-soft border-mist text-gray line-through",
  reserved: "border-ink bg-ink text-white",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "公開待ち",
  published: "公開中",
  closed: "受け付けない",
  reserved: "予約済み",
};

/**
 * 面接枠のタブ：月のカレンダーで日付を選び、その日の面接枠だけを表示する。
 * 作り直し・公開は、選んだ日の週に対して行う。
 */
export function SlotPlanner({
  month,
  initialDate,
  today,
  plans,
  info,
  bookingUrl,
  storeName,
}: {
  month: string; // 表示している月（YYYY-MM）
  initialDate: string;
  today: string;
  plans: Record<string, DayPlan>; // 表示している月のカレンダーに並ぶ日（前後の週も含む）
  info: string; // 面接の長さなどの説明
  bookingUrl: string;
  storeName: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(initialDate);
  const plan = plans[selected] ?? { slots: [], blocks: [], rows: [] };

  // 選んだ日の週
  const weekFrom = mondayOf(selected);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekFrom, i));
  const weekSlots = weekDays.flatMap((d) => plans[d]?.slots ?? []);
  const draft = weekSlots.filter((s) => s.status === "draft" && !s.reserved).length;
  const published = weekSlots.filter((s) => s.status === "published" && !s.reserved).length;
  const reserved = weekSlots.filter((s) => s.reserved).length;

  return (
    <div className="space-y-4">
      {/* カレンダー */}
      <section className="border border-ink bg-white p-2">
        <MonthGrid
          month={month}
          // 別の月はサーバーから読み直す
          onMonthChange={(m) => router.push(`/admin/slots?d=${m}-01`)}
          selected={selected}
          onSelect={setSelected}
          today={today}
          badge={(d) => {
            const slots = plans[d]?.slots ?? [];
            const open = slots.filter((s) => s.status !== "closed").length;
            if (open === 0) return null;
            const anyPublished = slots.some((s) => s.status === "published" || s.reserved);
            return { text: `${open}枠`, tone: anyPublished ? "ink" : "light" };
          }}
          mark={(d) => (plans[d]?.rows.length ?? 0) > 0}
          labelFor={(d) => `${dayLabel(d)} 面接枠${plans[d]?.slots.length ?? 0}件`}
        />
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-1 text-[11px] text-gray">
          <li className="flex items-center gap-1">
            <span className="inline-block size-2 rounded-full border border-ink" aria-hidden />
            面接担当のシフトあり
          </li>
          <li className="flex items-center gap-1">
            <span className="num bg-ink px-1 text-[9px] text-white">3枠</span>公開中を含む
          </li>
          <li className="flex items-center gap-1">
            <span className="num bg-line px-1 text-[9px]">3枠</span>公開待ちのみ
          </li>
        </ul>
      </section>

      {/* 選んだ日 */}
      <section className="border border-ink bg-white p-4">
        <h2 className="flex items-center justify-between text-sm font-bold">
          <span className="flex items-center gap-2">
            <span className="inline-block size-1.5 bg-ink" aria-hidden />
            {dayLabel(selected)}
          </span>
          <span className="num text-xs font-normal text-gray">{plan.slots.length}枠</span>
        </h2>
        {plan.rows.length === 0 && plan.slots.length === 0 ? (
          <p className="mt-3 text-sm text-gray">この日は面接担当のシフトがありません。</p>
        ) : (
          <>
            <div className="mt-3">
              <DayTimeline blocks={plan.blocks} rows={plan.rows} />
            </div>
            {plan.slots.length > 0 ? (
              <>
                <ul className="mt-4 grid grid-cols-3 gap-2">
                  {plan.slots.map((s) => {
                    const state = s.reserved ? "reserved" : s.status;
                    return (
                      <li key={s.id}>
                        <ActionForm action={toggleSlot} silentSuccess messageClassName="text-xs">
                          <input type="hidden" name="id" value={s.id} />
                          <button
                            type="submit"
                            disabled={s.reserved}
                            title={`対応できる人：${s.names}`}
                            aria-label={`${s.time} ${STATUS_LABEL[state]}。タップで切り替え`}
                            className={`flex min-h-12 w-full flex-col items-center justify-center border ${STATUS_STYLE[state]}`}
                          >
                            <span className="num text-sm font-semibold">{s.time}</span>
                            <span className="text-[10px] leading-tight opacity-80">
                              {s.reserved ? "予約済み" : STATUS_LABEL[state]}
                            </span>
                          </button>
                        </ActionForm>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-[11px] text-gray">
                  枠をタップすると「受け付けない」に切り替わります。もう一度タップすると公開待ちに戻ります。
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm text-gray">この日の面接枠はまだありません。下の「面接枠を作る」で作れます。</p>
            )}
          </>
        )}
      </section>

      {/* 選んだ日の週の操作 */}
      <section className="border border-ink bg-white p-4">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <span className="inline-block size-1.5 bg-ink" aria-hidden />
          この週の面接枠
          <span className="num font-normal text-gray">
            {formatDateShort(weekDays[0])}〜{formatDateShort(weekDays[6])}
          </span>
        </h2>
        <dl className="num mt-3 grid grid-cols-3 border border-ink text-center">
          <div className="border-r border-ink py-2">
            <dt className="text-[10px] text-gray">公開待ち</dt>
            <dd className="text-xl font-bold">{draft}</dd>
          </div>
          <div className="border-r border-ink py-2">
            <dt className="text-[10px] text-gray">公開中</dt>
            <dd className="text-xl font-bold">{published}</dd>
          </div>
          <div className="py-2">
            <dt className="text-[10px] text-gray">予約済み</dt>
            <dd className="text-xl font-bold">{reserved}</dd>
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
            <input type="hidden" name="week" value={weekFrom} />
            <SubmitButton variant="ink" className="w-full" pendingText="作成中…">
              {weekSlots.length > 0 ? "この週の面接枠を作り直す" : "この週の面接枠を作る"}
            </SubmitButton>
          </ActionForm>
          {/* 公開待ちがあるときだけ公開ボタンを出す（ActionForm は結果メッセージのため常に置く） */}
          <ActionForm action={publishSlots}>
            <input type="hidden" name="week" value={weekFrom} />
            {draft > 0 && (
              <SubmitButton variant="accent" className="w-full" pendingText="公開中…">
                公開待ちの{draft}件を公開する
              </SubmitButton>
            )}
          </ActionForm>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-gray">{info}</p>

        {published > 0 && (
          <div className="mt-4 border-t border-line pt-4">
            <p className="mb-2 text-sm font-bold">応募者に予約ページを送る</p>
            {/* 黄色は1画面に1か所：公開ボタンがないときは共有ボタンを黄色に */}
            <ShareBooking url={bookingUrl} storeName={storeName} showUrl={false} variant={draft > 0 ? "ink" : "accent"} />
          </div>
        )}
      </section>
    </div>
  );
}
