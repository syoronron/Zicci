import { addDays } from "@/lib/time";

/**
 * 面接後の進み具合（マイルストーン）。
 * 応募者のページと店舗の画面で、同じルールで表示する。
 */
export type ReservationStatus = "booked" | "interviewed" | "passed" | "rejected" | "canceled";

export const STATUS_LABEL: Record<ReservationStatus, string> = {
  booked: "面接前",
  interviewed: "選考中",
  passed: "採用",
  rejected: "見送り",
  canceled: "辞退",
};

export function isStatus(v: unknown): v is ReservationStatus {
  return typeof v === "string" && v in STATUS_LABEL;
}

export type Milestone = { key: string; label: string; state: "done" | "current" | "todo" };

/** ①予約完了 → ②面接 → ③選考中 → ④結果のお知らせ */
export function milestones(status: ReservationStatus): Milestone[] {
  const order = ["booked", "interview", "selection", "result"] as const;
  const labels = { booked: "予約完了", interview: "面接", selection: "選考中", result: "結果のお知らせ" };
  // いまどこまで進んだか（完了した段階の数）
  const reached = { booked: 1, interviewed: 3, passed: 4, rejected: 4, canceled: 1 }[status];
  return order.map((key, i) => ({
    key,
    label: labels[key],
    state: i < reached ? "done" : i === reached ? "current" : "todo",
  }));
}

/** 面接日（日本時間）と日数から、結果連絡の期限を出す */
export function resultDueDate(interviewDate: string, days: number): string {
  return addDays(interviewDate, days);
}

export type DueInfo = { daysLeft: number; level: "overdue" | "today" | "soon" | "ok"; label: string };

/** 結果連絡の期限が、今日から見てどうなっているか */
export function dueInfo(due: string, today: string): DueInfo {
  const daysLeft = Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (daysLeft < 0) return { daysLeft, level: "overdue", label: `期限を${-daysLeft}日過ぎています` };
  if (daysLeft === 0) return { daysLeft, level: "today", label: "今日が期限です" };
  if (daysLeft === 1) return { daysLeft, level: "soon", label: "明日が期限です" };
  return { daysLeft, level: "ok", label: `期限まであと${daysLeft}日` };
}
