"use client";

import { ActionForm, SubmitButton } from "@/components/action-form";
import { cancelByApplicant } from "./actions";

/** 応募者による日時変更・辞退（どちらも確認してから） */
export function CancelButtons({ slug, token }: { slug: string; token: string }) {
  return (
    <div className="mt-3 grid gap-2">
      <ActionForm
        action={cancelByApplicant}
        confirm="今の予約を取り消して、日時を選び直しますか？（今の時間は、ほかの方が予約できるようになります）"
      >
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="mode" value="change" />
        <SubmitButton variant="outline" className="w-full" pendingText="手続き中…">
          日時を変更する
        </SubmitButton>
      </ActionForm>
      <ActionForm action={cancelByApplicant} confirm="面接を辞退しますか？この操作は取り消せません。">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="mode" value="decline" />
        <SubmitButton variant="danger" className="w-full" pendingText="手続き中…">
          面接を辞退する
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
