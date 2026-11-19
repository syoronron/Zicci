import Link from "next/link";
import { connection } from "next/server";
import { requireAdminPage } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { PageHeader, Section, SetupNotice } from "@/components/page-header";
import { ShareBooking } from "@/components/share-booking";
import { bookingUrl } from "@/lib/site-url";
import { TimeSelect } from "@/components/time-select";
import { getAfterSettings, getStore, isDatabaseConfigured, listBlocks } from "@/lib/data/store";
import { formatTime, weekdayLabel } from "@/lib/time";
import { logout } from "../../login/actions";
import { addBlock, deleteBlock, updateAfterSettings, updateStore } from "../actions";

export default async function SettingsPage() {
  await connection();
  await requireAdminPage();
  if (!isDatabaseConfigured()) return <SetupNotice />;
  const store = await getStore();
  if (!store) return null;
  const [blocks, after] = await Promise.all([listBlocks(store.id), getAfterSettings(store.id)]);
  const url = await bookingUrl(store.public_slug);

  return (
    <>
      <PageHeader eyebrow="SETTINGS" title="店舗の設定">
        面接の長さや、面接を入れない時間帯を設定します。
      </PageHeader>

      <div className="space-y-4">
        <nav className="grid grid-cols-2 gap-2" aria-label="ほかの設定">
          {[
            { href: "/admin/staff", title: "スタッフ", sub: "面接担当を選ぶ" },
            { href: "/admin/guide", title: "面接の進め方", sub: "質問の流れを作る" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="flex min-h-16 flex-col justify-center border border-ink bg-white px-3 py-2">
              <span className="font-bold">{l.title}</span>
              <span className="text-xs text-gray">{l.sub}</span>
            </Link>
          ))}
        </nav>

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

        <Section title="面接後の案内">
          {after ? (
            <ActionForm action={updateAfterSettings} className="space-y-3">
              <div>
                <label className="label" htmlFor="result_days">
                  結果を連絡するまでの日数（面接日から）
                </label>
                <select id="result_days" name="result_days" className="field num" defaultValue={after.result_days}>
                  {Array.from({ length: 14 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}日以内
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="onboarding_message">
                  採用した方への入店案内（持ち物・集合場所など）
                </label>
                <textarea
                  id="onboarding_message"
                  name="onboarding_message"
                  rows={5}
                  maxLength={500}
                  defaultValue={after.onboarding_message}
                  className="field py-2"
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="thanks_message">
                  見送った方へのお礼のメッセージ
                </label>
                <textarea
                  id="thanks_message"
                  name="thanks_message"
                  rows={5}
                  maxLength={500}
                  defaultValue={after.thanks_message}
                  className="field py-2"
                  required
                />
              </div>
              <SubmitButton variant="outline" className="w-full">
                面接後の案内を保存する
              </SubmitButton>
            </ActionForm>
          ) : (
            <p className="text-sm text-gray">
              Supabase の SQL Editor で <span className="num text-ink">20261120000000_reservation_progress.sql</span>{" "}
              を実行すると、ここで設定できるようになります。
            </p>
          )}
        </Section>

        <Section title="応募者向けの予約ページ">
          <p className="mb-3 text-sm text-gray">
            このURLを、求人サイトの応募完了メッセージや、応募者への連絡に貼り付けてください。公開中の面接枠から予約できます。
          </p>
          <ShareBooking url={url} storeName={store.name} />
        </Section>

        <form action={logout}>
          <button type="submit" className="min-h-11 w-full text-sm text-gray underline underline-offset-4">
            ログアウト
          </button>
        </form>
      </div>
    </>
  );
}
