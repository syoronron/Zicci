import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * サーバー専用の Supabase クライアント。
 *
 * 秘密鍵（SUPABASE_SECRET_KEY）を使うため、ブラウザに送られるコードからは
 * 絶対に import してはいけない。先頭の `import "server-only"` が、
 * 誤ってブラウザ側で使われたときにビルドエラーにしてくれる。
 *
 * 環境変数が未設定のときは null を返す（設定前でもアプリ自体は起動できるように）。
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) return null;

  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
