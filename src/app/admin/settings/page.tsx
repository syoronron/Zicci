import { connection } from "next/server";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { PageHeader, Section, SetupNotice } from "@/components/page-header";
import { TimeSelect } from "@/components/time-select";
import { getStore, isDatabaseConfigured, listBlocks } from "@/lib/data/store";
import { formatTime, weekdayLabel } from "@/lib/time";
import { addBlock, deleteBlock, updateStore } from "../actions";

export default async function SettingsPage() {
  await connection();
  if (!isDatabaseConfigured()) return <SetupNotice />;
  const store = await getStore();
  if (!store) return null;
  const blocks = await listBlocks(store.id);

  return (
    <>
      <PageHeader eyebrow="SETTINGS" title="店舗の設定">
        面接の長さや、面接を入れない時間帯を設定します。
      </PageHeader>

      <div className="space-y-4">
        <Section title="店舗情報と面接のルール">
          <ActionForm action={updateStore} className="space-y-3">
            <div>
              <label className="label" htmlFor="name">
                店舗名
              </label>
              <input id="name" name="name" className="field" defaultValue={store.name} required maxLength={50} />
            </div>
            <div>
              <label className="label" htmlFor="address">
                住所（応募者に表示）
              </label>
              <input id="address" name="address" className="field" defaultValue={store.address ?? ""} maxLength={100} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="interview_minutes">
                  面接の長さ
                </label>
                <select
                  id="interview_minutes"
                  name="interview_minutes"
                  className="field num"
                  defaultValue={store.interview_minutes}
                >
                  {[30, 45, 60].map((m) => (
                    <option key={m} value={m}>
                      {m}分
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="shift_buffer_minutes">
                  出勤直後・退勤直前
                </label>
                <select
                  id="shift_buffer_minutes"
                  name="shift_buffer_minutes"
                  className="field num"
                  defaultValue={store.shift_buffer_minutes}
                >
                  {[0, 10, 15, 20, 30].map((m) => (
                    <option key={m} value={m}>
                      {m === 0 ? "除外しない" : `${m}分は除外`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <SubmitButton variant="accent" className="w-full">
              保存する
            </SubmitButton>
          </ActionForm>
        </Section>

        <Section title="面接を入れない時間帯">
          <p className="mb-3 text-sm text-gray">ランチ・ディナーのピークや休憩時間など。</p>
          {blocks.length === 0 ? (
            <p className="text-sm text-gray">まだ登録されていません。</p>
          ) : (
            <ul className="-mx-4 border-y border-line">
              {blocks.map((b) => (
                <li key={b.id} className="flex items-center gap-3 border-b border-line px-4 py-2 last:border-b-0">
                  <span
                    className={`inline-block size-4 shrink-0 border border-ink ${b.kind === "busy" ? "stripe" : "bg-white"}`}
                    aria-hidden
                  />
                  <span className="w-12 text-sm">{b.weekday === null ? "毎日" : `${weekdayLabel(b.weekday)}曜`}</span>
                  <span className="num flex-1 font-semibold">
                    {formatTime(b.start)}〜{formatTime(b.end)}
                  </span>
                  <span className="text-xs text-gray">{b.kind === "busy" ? "繁忙" : "休憩"}</span>
                  <ActionForm action={deleteBlock} confirm="この時間帯を削除しますか？" silentSuccess>
                    <input type="hidden" name="id" value={b.id} />
                    <SubmitButton variant="danger" pendingText="…">
                      削除
                    </SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          )}

          <ActionForm action={addBlock} className="mt-4 grid grid-cols-2 gap-3" resetOnSuccess>
            <div>
              <label className="label" htmlFor="weekday">
                曜日
              </label>
              <select id="weekday" name="weekday" className="field" defaultValue="">
                <option value="">毎日</option>
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <option key={d} value={d}>
                    {weekdayLabel(d)}曜のみ
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="kind">
                種類
              </label>
              <select id="kind" name="kind" className="field" defaultValue="busy">
                <option value="busy">繁忙時間</option>
                <option value="break">休憩時間</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="block-start">
                開始
              </label>
              <TimeSelect id="block-start" name="start" defaultValue="15:00" />
            </div>
            <div>
              <label className="label" htmlFor="block-end">
                終了
              </label>
              <TimeSelect id="block-end" name="end" defaultValue="16:00" />
            </div>
            <SubmitButton variant="outline" className="col-span-2">
              時間帯を追加する
            </SubmitButton>
          </ActionForm>
        </Section>

        <Section title="応募者向けの予約ページ">
          <p className="num text-sm break-all">/r/{store.public_slug}</p>
          <p className="mt-1 text-xs text-gray">応募者の予約ページは次のステップで作ります。</p>
        </Section>
      </div>
    </>
  );
}
