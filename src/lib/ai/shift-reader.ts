import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { formatDateShort } from "@/lib/time";
import { normalizeReadResult, type ReadPerson } from "./normalize";

/**
 * シフト表の写真を Claude で読み取る。
 * 結果は「下書き」で、必ず人が確認・修正してから登録する（そのまま登録はしない）。
 */

/** 使うモデル（店長が選んだ、費用の安い Haiku） */
export const SHIFT_READER_MODEL = "claude-haiku-5-5";

/** API キーが設定されていれば AI 読み取りを使える */
export function isShiftReaderEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

const ResultSchema = z.object({
  people: z
    .array(
      z.object({
        name: z.string().describe("表に書かれている従業員の名前（敬称なし）"),
        shifts: z
          .array(
            z.object({
              date: z.string().describe("勤務日。指定された日付一覧の中から YYYY-MM-DD で"),
              start: z.string().describe("開始時刻。24時間表記の HH:MM"),
              end: z.string().describe("終了時刻。24時間表記の HH:MM。日をまたぐ場合は 26:00 のように24を超えてよい"),
            }),
          )
          .describe("勤務がある日だけ。休みの日は含めない"),
      }),
    )
    .describe("表に載っている従業員全員"),
  notes: z.array(z.string()).describe("読み取りに自信がない箇所や、省いた箇所の説明（日本語・短く）"),
});

const SYSTEM = `あなたは飲食店の紙のシフト表を読み取るアシスタントです。
写真から、従業員ごとの勤務日と勤務時間を正確に書き出してください。
推測で値を埋めてはいけません。読み取れない・自信がない箇所は省いて notes に書いてください。`;

function instructions(weekDays: string[], knownNames: string[]): string {
  const days = weekDays.map((d) => `- ${d}（${formatDateShort(d)}）`).join("\n");
  const names = knownNames.length > 0 ? knownNames.join("、") : "（まだ登録なし）";
  return `この写真は、次の1週間分のシフト表です。
${days}

読み取りのルール：
- 表の列見出し（日にち・曜日）を上の日付一覧と対応させ、date は YYYY-MM-DD で書く。一覧にない日の列は無視する。
- 時刻は24時間表記の HH:MM にする。「10-16」「10〜16」は 10:00〜16:00。「9:30-14」は 09:30〜14:00。
- 「休」「×」「公」「-」や空欄は休みなので含めない。
- 終了が「L」「ラスト」「〆」などで時刻が書かれていない場合は、推測せずにその日を省き、notes に書く。
- 名前は表のとおりに書く（「さん」などの敬称は付けない）。すでに登録されているスタッフは次のとおり：${names}
  表の名前がこの中の人と同じ人を指していれば、登録されている表記に合わせる。
- 表に載っていない人は作らない。`;
}

export type ReadShiftResult =
  | { ok: true; people: ReadPerson[]; notes: string[] }
  | { ok: false; message: string };

export async function readShiftSheet(input: {
  imageBase64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  weekDays: string[];
  knownNames: string[];
}): Promise<ReadShiftResult> {
  if (!isShiftReaderEnabled()) return { ok: false, message: "AI読み取りは設定されていません。" };

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!.trim(),
    timeout: 90_000,
    maxRetries: 1,
  });

  try {
    const response = await client.messages.parse({
      model: SHIFT_READER_MODEL,
      max_tokens: 16000,
      // 手書きの読み取りは丁寧さが効くので、思考の深さは high
      output_config: { effort: "high", format: zodOutputFormat(ResultSchema) },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: input.mediaType, data: input.imageBase64 } },
            { type: "text", text: instructions(input.weekDays, input.knownNames) },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return { ok: false, message: "この写真は読み取れませんでした。手で入力してください。" };
    }
    if (response.stop_reason === "max_tokens" || !response.parsed_output) {
      return { ok: false, message: "読み取りが途中で終わりました。写真を撮り直すか、手で入力してください。" };
    }

    const normalized = normalizeReadResult(response.parsed_output.people, input.weekDays);
    return {
      ok: true,
      people: normalized.people,
      notes: [...response.parsed_output.notes, ...normalized.notes].slice(0, 20),
    };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      return { ok: false, message: "AIのAPIキーが正しくありません。Vercel の ANTHROPIC_API_KEY を確認してください。" };
    }
    if (error instanceof Anthropic.RateLimitError) {
      return { ok: false, message: "AIが混み合っています。少し待ってからもう一度お試しください。" };
    }
    if (error instanceof Anthropic.BadRequestError) {
      if (/credit balance/i.test(error.message)) {
        return { ok: false, message: "AIのクレジットが足りません。Claude Console でクレジットを確認してください。" };
      }
      console.error("shift-reader bad request", error.message);
      return { ok: false, message: "この写真はAIで読み取れませんでした（形式や大きさを確認してください）。" };
    }
    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      return { ok: false, message: "読み取りに時間がかかりすぎました。もう一度お試しください。" };
    }
    console.error("shift-reader error", error);
    return { ok: false, message: "AIの読み取りに失敗しました。時間をおいてもう一度お試しください。" };
  }
}
