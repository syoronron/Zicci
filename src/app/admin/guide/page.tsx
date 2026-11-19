import { connection } from "next/server";
import { PageHeader, SetupNotice } from "@/components/page-header";
import { requireAdminPage } from "@/lib/auth";
import { getInterviewGuide, getStore, isDatabaseConfigured } from "@/lib/data/store";
import { GuideEditor } from "./guide-editor";

export default async function GuidePage() {
  await connection();
  await requireAdminPage();
  if (!isDatabaseConfigured()) return <SetupNotice />;
  const store = await getStore();
  if (!store) return null;
  const guide = await getInterviewGuide(store.id);

  return (
    <>
      <PageHeader eyebrow="GUIDE" title="面接の進め方">
        聞くことと伝えることを順番に並べておくと、アルバイトのスタッフでも同じ流れで面接できます。
      </PageHeader>
      {guide.needsSetup ? (
        <div className="border border-ink bg-white p-4 text-sm leading-relaxed">
          <p className="font-bold">データベースの準備が必要です</p>
          <p className="mt-1 text-gray">
            Supabase の SQL Editor で <span className="num text-ink">20261119000000_interview_guide.sql</span>{" "}
            を実行してから、このページを開き直してください。
          </p>
        </div>
      ) : (
        <GuideEditor initial={guide.items} />
      )}
    </>
  );
}
