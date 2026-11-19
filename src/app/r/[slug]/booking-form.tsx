"use client";

import { useRef, useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { MonthGrid } from "@/components/month-grid";
import { reserve } from "./actions";

export type BookingDay = {
  date: string; // YYYY-MM-DD
  month: number;
  day: number;
  weekday: string; // 月・火…
  label: string; // 12/2（火）
  slots: { id: string; start: string; end: string }[];
};

/** 日付 → 時間 → 入力 → 予約、の順に1画面で進む */
export function BookingForm({
  slug,
  days,
  prefill,
  today,
}: {
  slug: string;
  days: BookingDay[];
  /** 今日（日本時間）。カレンダーの「今日」の印に使う */
  today: string;
  /** 日時変更のときに、前回のお名前・連絡先を入れておく */
  prefill?: { name: string; phone: string; email: string };
}) {
  const [date, setDate] = useState(days[0]?.date ?? "");
  const [slotId, setSlotId] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // 空き状況が更新されて、選んでいた日や時間がなくなった場合に備える
  const day = days.find((d) => d.date === date) ?? days[0];
  const byDate = new Map(days.map((d) => [d.date, d]));
  const firstMonth = days[0]?.date.slice(0, 7) ?? "";
  const lastMonth = days.at(-1)?.date.slice(0, 7) ?? "";
  const [month, setMonth] = useState(firstMonth);
  const slot = day?.slots.find((s) => s.id === slotId) ?? null;

  if (!day) return null;

  return (
    <>
      <h2 className="mt-6 text-sm font-bold">日付を選ぶ</h2>
      <p className="mt-0.5 text-xs text-gray">数字の入っている日が、予約できる日です。</p>
      <div className="mt-2 border border-ink bg-white p-2">
        <MonthGrid
          month={month}
          onMonthChange={setMonth}
          canPrev={month > firstMonth}
          canNext={month < lastMonth}
          selected={day.date}
          onSelect={(d) => {
            setDate(d);
            setSlotId(null);
          }}
          today={today}
          disabled={(d) => !byDate.has(d)}
          badge={(d) => {
            const n = byDate.get(d)?.slots.length ?? 0;
            return n > 0 ? { text: `空${n}`, tone: "ink" } : null;
          }}
          labelFor={(d) => (byDate.has(d) ? `${byDate.get(d)!.label} 空き${byDate.get(d)!.slots.length}件` : `${d} 予約できません`)}
        />
      </div>

      <h2 className="mt-6 text-sm font-bold">
        時間を選ぶ <span className="font-normal text-gray">{day.label}</span>
      </h2>
      <ul className="mt-2 grid grid-cols-3 gap-2" aria-label="時間">
        {day.slots.map((s) => {
          const active = s.id === slot?.id;
          return (
            <li key={s.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setSlotId(s.id);
                  // 入力欄が見えるところまでスクロール
                  setTimeout(
                    () =>
                      formRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      }),
                    50,
                  );
                }}
                className={`num min-h-12 w-full border border-ink text-base font-semibold ${
                  active ? "bg-ink text-white" : "bg-white"
                }`}
              >
                {s.start}
              </button>
            </li>
          );
        })}
      </ul>

      <div ref={formRef} className="scroll-mt-4">
        {/* フォームは常に置いておく：選んだ枠がほかの人に取られて消えても、理由のメッセージが残るように */}
        <ActionForm
          action={reserve}
          className={slot ? "mt-6 border border-ink bg-white p-4" : "mt-6"}
          messageClassName="font-bold"
        >
          {slot ? (
            <>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="slot_id" value={slot.id} />
              <div className="border border-dashed border-ink px-3 py-2">
                <p className="text-[11px] text-gray">選択中</p>
                <p className="num text-xl font-bold">
                  {day.label.replace(/（.）/, "")}　{slot.start} – {slot.end}
                </p>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="label" htmlFor="name">
                    お名前 <span className="text-danger">必須</span>
                  </label>
                  <input
                    id="name"
                    name="name"
                    className="field"
                    autoComplete="name"
                    required
                    maxLength={30}
                    defaultValue={prefill?.name}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="phone">
                    電話番号 <span className="text-danger">必須</span>
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="090-1234-5678"
                    className="field num"
                    required
                    defaultValue={prefill?.phone}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="email">
                    メールアドレス（任意）
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    className="field"
                    maxLength={100}
                    defaultValue={prefill?.email}
                  />
                </div>
                {/* ロボットよけ：画面には表示しない */}
                <div className="hidden" aria-hidden>
                  <label>
                    website
                    <input name="website" tabIndex={-1} autoComplete="off" />
                  </label>
                </div>
              </div>

              <p className="mt-4 text-xs leading-relaxed text-gray">
                入力した情報は、面接に関するご連絡のためだけに使います。
              </p>
              <SubmitButton
                variant="accent"
                className="mt-3 w-full justify-between!"
                pendingText="予約しています…"
              >
                この時間で予約する<span className="num">→</span>
              </SubmitButton>
            </>
          ) : (
            <p className="border border-dashed border-mist p-4 text-center text-sm text-gray">
              時間を選ぶと、お名前と連絡先の入力欄が表示されます。
            </p>
          )}
        </ActionForm>
      </div>
    </>
  );
}
