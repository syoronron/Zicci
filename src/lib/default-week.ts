import "server-only";

import { listEmployees, listShifts } from "@/lib/data/store";
import { addDays, mondayOf, todayJst } from "@/lib/time";

/**
 * 週の指定がないときに最初に見せる週。
 * 今日以降で一番近い「面接担当のシフトがある週」（4週先まで）。なければ今週。
 * シフト表を来週分で読み込んだ直後に、空の今週が表示されないようにするため。
 */
export async function defaultWeekStart(storeId: string): Promise<string> {
  const today = todayJst();
  const [employees, shifts] = await Promise.all([
    listEmployees(storeId),
    listShifts(storeId, today, addDays(today, 27)),
  ]);
  const interviewers = new Set(employees.filter((e) => e.is_interviewer).map((e) => e.id));
  const first = shifts.find((s) => interviewers.has(s.employee_id));
  return mondayOf(first?.date ?? today);
}

/** 日付の指定がないときに最初に選ぶ日：今日以降で一番近い「面接担当のシフトがある日」（4週先まで）。なければ今日 */
export async function defaultDay(storeId: string): Promise<string> {
  const today = todayJst();
  const [employees, shifts] = await Promise.all([
    listEmployees(storeId),
    listShifts(storeId, today, addDays(today, 27)),
  ]);
  const interviewers = new Set(employees.filter((e) => e.is_interviewer).map((e) => e.id));
  return shifts.find((s) => interviewers.has(s.employee_id))?.date ?? today;
}
