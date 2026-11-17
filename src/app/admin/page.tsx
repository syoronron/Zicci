import Link from "next/link";
import { connection } from "next/server";
import { PageHeader, Section, SetupNotice } from "@/components/page-header";
import { getStore, isDatabaseConfigured, listEmployees, listShifts, listSlots } from "@/lib/data/store";
import { formatDateShort } from "@/lib/time";
import { resolveWeek } from "@/lib/week";

export default async function AdminHome() {
  await connection();
  if (!isDatabaseConfigured()) return <SetupNotice />;
  const store = await getStore();
  if (!store) return <p className="text-sm">デモ店舗が見つかりません。seed.sql を実行してください。</p>;

  const week = resolveWeek(undefined);
  const [employees, shifts, slots] = await Promise.all([
    listEmployees(store.id),
    listShifts(store.id, week.from, week.to),
    listSlots(store.id, week.from, week.to),
  ]);
  const interviewers = employees.filter((e) => e.is_interviewer);
  const interviewerShifts = shifts.filter((s) => interviewers.some((e) => e.id === s.employee_id));
  const published = slots.filter((s) => s.status === "published").length;
  const draft = slots.filter((s) => s.status === "draft").length;

  const steps = [
    {
      done: interviewers.length > 0,
      title: "面接担当を選ぶ",
      detail: `面接担当 ${interviewers.length}人`,
      href: "/admin/staff",
    },
    {
      done: interviewerShifts.length > 0,
      title: "シフトを入力する",
      detail: `今週のシフト ${interviewerShifts.length}件`,
      href: "/admin/shifts",
    },
    {
      done: slots.length > 0,
      title: "面接枠を作る",
      detail: `公開待ち ${draft}件`,
      href: "/admin/slots",
    },
    {
      done: published > 0,
      title: "面接枠を公開する",
      detail: `公開中 ${published}件`,
      href: "/admin/slots",
    },
  ];

  return (
    <>
      <PageHeader eyebrow="HOME" title={store.name}>
        今週（{formatDateShort(week.from)}〜{formatDateShort(week.to)}）の準備状況
      </PageHeader>

      <ol className="border border-ink bg-white">
        {steps.map((step, i) => (
          <li key={step.title} className="border-b border-line last:border-b-0">
            <Link href={step.href} className="flex min-h-16 items-center gap-3 px-4 py-3">
              <span
                className={`num flex size-7 shrink-0 items-center justify-center border border-ink text-xs font-bold ${
                  step.done ? "bg-ink text-white" : "bg-white"
                }`}
              >
                {step.done ? "✓" : i + 1}
              </span>
              <span className="flex-1">
                <span className="block font-bold">{step.title}</span>
                <span className="num block text-xs text-gray">{step.detail}</span>
              </span>
              <span className="num text-gray" aria-hidden>
                →
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <div className="mt-4">
        <Section title="面接の予約">
          <p className="text-sm text-gray">応募者からの予約は、ここに表示されます（次のステップで追加します）。</p>
        </Section>
      </div>
    </>
  );
}
