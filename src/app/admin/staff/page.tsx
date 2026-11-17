import { connection } from "next/server";
import { requireAdminPage } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { PageHeader, Section, SetupNotice } from "@/components/page-header";
import { getStore, isDatabaseConfigured, listEmployees } from "@/lib/data/store";
import { addEmployee, deleteEmployee, setInterviewer } from "../actions";

export default async function StaffPage() {
  await connection();
  await requireAdminPage();
  if (!isDatabaseConfigured()) return <SetupNotice />;
  const store = await getStore();
  if (!store) return null;
  const employees = await listEmployees(store.id);
  const count = employees.filter((e) => e.is_interviewer).length;

  return (
    <>
      <PageHeader eyebrow="STAFF" title="誰が面接できますか？">
        面接を担当できる人を選んでください。複数人を選べます。誰か1人でも勤務していれば、その時間に面接枠ができます。
      </PageHeader>

      <div className="space-y-4">
        <Section title="スタッフを追加">
          <ActionForm action={addEmployee} resetOnSuccess>
            <label className="label" htmlFor="name">
              名前
            </label>
            <input id="name" name="name" className="field" placeholder="例：田中" required maxLength={30} />
            <label className="mt-3 flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" name="is_interviewer" defaultChecked className="size-5 accent-ink" />
              面接担当にする
            </label>
            <SubmitButton variant="accent" className="mt-2 w-full">
              追加する
            </SubmitButton>
          </ActionForm>
        </Section>

        <Section
          title="スタッフ一覧"
          aside={<span className="num text-xs text-gray">面接担当 {count} / {employees.length}人</span>}
        >
          {employees.length === 0 ? (
            <p className="text-sm text-gray">まだスタッフが登録されていません。</p>
          ) : (
            <ul className="-mx-4 border-t border-line">
              {employees.map((e) => (
                <li key={e.id} className="flex items-center gap-2 border-b border-line px-4 py-2 last:border-b-0">
                  <span className="flex-1 truncate font-medium">{e.name}</span>
                  <ActionForm action={setInterviewer} silentSuccess>
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="value" value={String(!e.is_interviewer)} />
                    <SubmitButton
                      variant={e.is_interviewer ? "ink" : "outline"}
                      className="min-h-10! px-3! text-xs"
                      pendingText="…"
                    >
                      {e.is_interviewer ? "面接担当" : "担当外"}
                    </SubmitButton>
                  </ActionForm>
                  <ActionForm
                    action={deleteEmployee}
                    confirm={`${e.name}さんを削除しますか？この人のシフトも削除されます。`}
                    silentSuccess
                  >
                    <input type="hidden" name="id" value={e.id} />
                    <SubmitButton variant="danger" pendingText="…">
                      削除
                    </SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
