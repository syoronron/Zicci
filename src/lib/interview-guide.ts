import { z } from "zod";

/**
 * 面接の進め方（質問フロー）。
 * 店長が作っておけば、アルバイトでも順番どおりに面接を進められる。
 */

export type GuideKind = "question" | "talk";

export type GuideItem = {
  id: string;
  /** question = 応募者に聞くこと / talk = 面接担当が伝えること（あいさつ・説明） */
  kind: GuideKind;
  /** 聞くこと・話すこと（そのまま読み上げられる文） */
  text: string;
  /** 確認ポイント（何を聞き取ればよいか・注意すること） */
  hint: string;
  /** 回答の選択肢（質問のときだけ。なくてもよい） */
  options: string[];
};

export const GUIDE_LIMITS = { items: 40, text: 200, hint: 200, options: 8, option: 30 } as const;

export const guideSchema = z
  .array(
    z.object({
      id: z.string().min(1).max(64),
      kind: z.enum(["question", "talk"]),
      text: z.string().trim().min(1, "内容が空の項目があります").max(GUIDE_LIMITS.text, `内容は${GUIDE_LIMITS.text}文字以内です`),
      hint: z.string().trim().max(GUIDE_LIMITS.hint, `確認ポイントは${GUIDE_LIMITS.hint}文字以内です`),
      options: z
        .array(z.string().trim().min(1).max(GUIDE_LIMITS.option, `選択肢は${GUIDE_LIMITS.option}文字以内です`))
        .max(GUIDE_LIMITS.options, `選択肢は${GUIDE_LIMITS.options}個までです`),
    }),
  )
  .max(GUIDE_LIMITS.items, `項目は${GUIDE_LIMITS.items}個までです`);

/** データベースの値を安全に読み取る（壊れた項目は捨てる） */
export function parseGuide(value: unknown): GuideItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => {
    const r = guideSchema.element.safeParse(v);
    return r.success ? [r.data] : [];
  });
}

const t = (kind: GuideKind, text: string, hint = "", options: string[] = []): Omit<GuideItem, "id"> => ({
  kind,
  text,
  hint,
  options,
});

/** 飲食店のアルバイト面接のひな形（店舗に合わせて書き換えて使う） */
export const GUIDE_TEMPLATE: Omit<GuideItem, "id">[] = [
  t("talk", "本日はお越しいただきありがとうございます。面接を担当する〇〇です。よろしくお願いします。", "笑顔で。履歴書を受け取って、座ってもらう"),
  t("question", "まず簡単に自己紹介をお願いします。", "あいさつ・話し方・表情。お客様の前に立てそうか"),
  t("question", "このお店で働きたいと思った理由を教えてください。", "お店のことを知っているか。長く続けてくれそうか"),
  t("question", "働ける曜日と時間帯を教えてください。", "忙しい時間（ランチ・ディナー・土日）に入れるか", ["平日の昼", "平日の夜", "土日の昼", "土日の夜"]),
  t("question", "週に何日くらい働けますか？", "", ["週1〜2日", "週3〜4日", "週5日以上"]),
  t("question", "いつから働けますか？", "", ["すぐ", "2週間以内", "1か月以内", "それ以降"]),
  t("question", "飲食店で働いた経験はありますか？", "経験があれば、どんな仕事をしていたか", ["ある（ホール）", "ある（キッチン）", "ない"]),
  t("question", "通勤の方法と、かかる時間を教えてください。", "交通費の確認。遅い時間に帰れるか"),
  t("question", "学校やほかのアルバイトとの掛け持ちはありますか？", "テスト期間・長期休み・扶養の範囲で働きたいか"),
  t("question", "どのくらいの期間、働く予定ですか？", "", ["半年未満", "半年〜1年", "1年以上"]),
  t("talk", "お店の説明：時給は〇〇円、制服は貸し出し、まかないがあります。", "お店に合わせて書き換える"),
  t("question", "何か質問はありますか？", "聞かれたことと答えをメモしておく"),
  t("talk", "結果は〇日以内に、お電話でご連絡します。本日はありがとうございました。", "連絡する日を伝える"),
];
