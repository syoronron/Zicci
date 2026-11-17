import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { PageHeader, Section, SetupNotice } from "@/components/page-header";
import { TimeSelect } from "@/components/time-select";
import { WeekNav } from "@/components/week-nav";
import { getStore, isDatabaseConfigured, listEmployees, listShifts } from "@/lib/data/store";
import { formatDateShort, formatTime, todayJst } from "@/lib/time";
import { resolveWeek } from "@/lib/week";
import { addShift, deleteShift, updateShift } from "../actions";

export default async function ShiftsPage({ searchParams }: PageProps<"/admin/shifts">) {
  const { week: weekParam } = await searchParams;
  if (!isDatabaseConfigured()) return <SetupNotice />;
  const store = await getStore();
  if (!store) return null;

  const week = resolveWeek(weekParam);
  const [employees, shifts] = await Promise.all([
    listEmployees(store.id),
    listShifts(store.id, week.from, week.to),
  ]);
  const interviewers = employees.filter((e) => e.is_interviewer);
  const nameOf = new Map(employees.map((e) => [e.id, e.name]));
  // 面接担当のシフトだけを表示する
  const visible = shifts.filter((s) => interviewers.some((e) => e.id === s.employee_id));
  const today = todayJst();
  const defaultDay = week.days.find((d) => d >= today) ?? week.from;

  return (
    <>
      <PageHeader eyebrow="SHIFTS" title="面接担当のシフト">
        面接担当に選んだ人の勤務時間を入力・修正します。
      </PageHeader>

      <div className="space-y-4">
        <WeekNav week={week} basePath="/admin/shifts" />

        {interviewers.length === 0 ? (
          <Section>
            <p className="text-sm">
              面接担当がまだいません。
              <Link href="/admin/staff" className="font-bold underline underline-offset-4">
                スタッフ
              </Link>
              で面接担当を選んでください。
            </p>
          </Section>
        ) : (
          <Section title="シフトを追加">
            <ActionForm action={addShift} className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label" htmlFor="employee_id">
                  スタッフ
                </label>
                <select id="employee_id" name="employee_id" className="field" required>
                  {interviewers.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label" htmlFor="date">
                  日付
                </label>
                <select id="date" name="date" className="field num" defaultValue={defaultDay} required>
                  {week.days.map((d) => (
                    <option key={d} value={d}>
                      {formatDateShort(d)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="start">
                  開始
                </label>
                <TimeSelect id="start" name="start" defaultValue="10:00" />
              </div>
              <div>
                <label className="label" htmlFor="end">
                  終了
                </label>
                <TimeSelect id="end" name="end" defaultValue="17:00" />
              </div>
              <SubmitButton variant="accent" className="col-span-2">
                追加する
              </SubmitButton>
            </ActionForm>
          </Section>
        )}

        {week.days.map((day) => {
          const dayShifts = visible.filter((s) => s.date === day);
          return (
            <Section
              key={day}
              title={formatDateShort(day)}
              aside={<span className="num text-xs text-gray">{dayShifts.length}件</span>}
            >
              {dayShifts.length === 0 ? (
                <p className="text-sm text-gray">シフトなし</p>
              ) : (
                <ul className="space-y-3">
                  {dayShifts.map((s) => (
                    <li key={s.id} className="border-t border-line pt-3 first:border-t-0 first:pt-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {nameOf.get(s.employee_id)}
                          {s.source === "ai" && (
                            <span className="ml-2 border border-dashed border-ink px-1 text-[10px]">AI読み取り</span>
                          )}
                        </span>
                        <ActionForm action={deleteShift} confirm="このシフトを削除しますか？" silentSuccess>
                          <input type="hidden" name="id" value={s.id} />
                          <SubmitButton variant="danger" pendingText="…">
                            削除
                          </SubmitButton>
                        </ActionForm>
                      </div>
                      <ActionForm action={updateShift} className="mt-1">
                        <input type="hidden" name="id" value={s.id} />
                        <div className="flex items-center gap-2">
                        <TimeSelect name="start" defaultValue={formatTime(s.start)} label="開始" className="min-w-0 flex-1" />
                        <span className="text-gray">〜</span>
                        <TimeSelect name="end" defaultValue={formatTime(s.end)} label="終了" className="min-w-0 flex-1" />
                        <SubmitButton variant="outline" className="shrink-0 px-3!" pendingText="…">
                          保存
                        </SubmitButton>
                        </div>
                      </ActionForm>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          );
        })}

        <p className="text-sm text-gray">
          シフトを変えたら、
          <Link href={`/admin/slots?week=${week.from}`} className="font-bold text-ink underline underline-offset-4">
            面接枠
          </Link>
          で「面接枠を作り直す」を押してください。
        </p>
      </div>
    </>
  );
}
