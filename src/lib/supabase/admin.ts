import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readSupabaseConfig } from "./config";

/**
 * サーバー専用の Supabase クライアント。
 *
 * 秘密鍵（SUPABASE_SECRET_KEY）を使うため、ブラウザに送られるコードからは
 * 絶対に import してはいけない。先頭の `import "server-only"` が、
 * 誤ってブラウザ側で使われたときにビルドエラーにしてくれる。
 *
 * 環境変数が未設定・不正なときは null を返す（設定前でもアプリ自体は起動できるように）。
 * 理由は readSupabaseConfig() で確認できる。
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const config = readSupabaseConfig();
  if (!config.ok) return null;
  try {
    return createClient(config.url, config.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } catch {
    return null;
  }
}
