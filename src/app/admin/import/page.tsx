import { connection } from "next/server";
import { PageHeader, SetupNotice } from "@/components/page-header";
import { requireAdminPage } from "@/lib/auth";
import { isShiftReaderEnabled } from "@/lib/ai/shift-reader";
import { getStore, isDatabaseConfigured, listEmployees, listShifts } from "@/lib/data/store";
import { addDays, formatDateShort, formatTime, mondayOf, todayJst } from "@/lib/time";
import { ImportWizard, type WizardShift, type WizardWeek } from "./import-wizard";

/** AI 読み取りに時間がかかることがあるため、このページの処理時間の上限を延ばす */
export const maxDuration = 60;

/** 取り込める週（今週から4週先まで） */
const WEEKS_AHEAD = 4;

export default async function ImportPage() {
  await connection();
  await requireAdminPage();
  if (!isDatabaseConfigured()) return <SetupNotice />;
  const store = await getStore();
  if (!store) return null;

  const first = mondayOf(todayJst());
  const weeks: WizardWeek[] = Array.from({ length: WEEKS_AHEAD }, (_, i) => {
    const from = addDays(first, i * 7);
    const days = Array.from({ length: 7 }, (_, d) => addDays(from, d));
    return {
      from,
      label: `${i === 0 ? "今週" : i === 1 ? "来週" : `${i}週間後`}　${formatDateShort(from)}〜${formatDateShort(days[6])}`,
      days: days.map((d) => ({ date: d, label: formatDateShort(d) })),
    };
  });

  const [employees, shifts] = await Promise.all([
    listEmployees(store.id),
    listShifts(store.id, first, addDays(first, WEEKS_AHEAD * 7 - 1)),
  ]);
  const existing: WizardShift[] = shifts.map((s) => ({
    employeeId: s.employee_id,
    date: s.date,
    start: formatTime(s.start),
    end: formatTime(s.end),
  }));

  return (
    <>
      <PageHeader eyebrow="IMPORT" title="シフト表から入力">
        紙のシフト表の写真から、面接担当の勤務を入力します。
      </PageHeader>
      <ImportWizard
        weeks={weeks}
        employees={employees.map((e) => ({ id: e.id, name: e.name, interviewer: e.is_interviewer }))}
        existing={existing}
        aiEnabled={isShiftReaderEnabled()}
      />
    </>
  );
}
