import "server-only";

/**
 * 環境変数（SUPABASE_URL / SUPABASE_SECRET_KEY）の読み取りと点検。
 *
 * よくある入力ミス（https:// の付け忘れ、前後の空白、末尾の /rest/v1 など）は自動で直し、
 * 直せないものは理由を返す。理由はキーの中身を含まないので、画面に表示しても安全。
 */
export type SupabaseConfig =
  | { ok: true; url: string; key: string }
  | { ok: false; reason: "missing" }
  | { ok: false; reason: "invalid"; message: string };

export function readSupabaseConfig(): SupabaseConfig {
  const rawUrl = process.env.SUPABASE_URL?.trim() ?? "";
  const key = (process.env.SUPABASE_SECRET_KEY ?? "").trim().replace(/^["']|["']$/g, "");
  if (!rawUrl || !key) return { ok: false, reason: "missing" };

  let url = rawUrl.replace(/^["']|["']$/g, "");
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  url = url.replace(/\/+(rest\/v1\/?)?$/i, "");
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes(".")) throw new Error("no host");
  } catch {
    return {
      ok: false,
      reason: "invalid",
      message: "SUPABASE_URL の形式が正しくありません。https://○○○.supabase.co の形で入力してください。",
    };
  }

  const keyProblem = checkKey(key);
  if (keyProblem) return { ok: false, reason: "invalid", message: keyProblem };

  return { ok: true, url, key };
}

/** 公開用のキー（Publishable / anon）を入れてしまう間違いを見つける */
function checkKey(key: string): string | null {
  if (/\s/.test(key)) {
    return "SUPABASE_SECRET_KEY に空白や改行が含まれています。キーだけを貼り付け直してください。";
  }
  if (key.startsWith("sb_publishable_")) {
    return "SUPABASE_SECRET_KEY に Publishable key が入っています。API Keys 画面の Secret key（sb_secret_ で始まるもの）を入れてください。";
  }
  if (key.startsWith("https://")) {
    return "SUPABASE_SECRET_KEY に URL が入っています。URL と キーが逆になっていないか確認してください。";
  }
  // 旧形式のキー（JWT）の場合は、役割（role）が service_role かどうかを確認する
  const parts = key.split(".");
  if (parts.length === 3 && key.startsWith("eyJ")) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { role?: string };
      if (payload.role === "anon") {
        return "SUPABASE_SECRET_KEY に anon キーが入っています。Legacy API keys の service_role キー、または Secret key を入れてください。";
      }
    } catch {
      // 読めなければそのまま使ってみる（接続時にエラーになればそこで表示する）
    }
  }
  return null;
}
