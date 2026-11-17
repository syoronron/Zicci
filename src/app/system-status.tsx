import { connection } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type Status =
  | { kind: "unconfigured" }
  | { kind: "error"; message: string }
  | { kind: "ok"; storeName: string | null };

async function checkDatabase(): Promise<Status> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { kind: "unconfigured" };

  const { data, error } = await supabase
    .from("stores")
    .select("name")
    .eq("public_slug", "demo")
    .maybeSingle();

  if (error) return { kind: "error", message: error.message };
  return { kind: "ok", storeName: data?.name ?? null };
}

/** データベースにつながっているかを表示する（P0 の動作確認用） */
export async function SystemStatus() {
  // アクセスのたびに最新の状態を確認する（ビルド時に結果を固定しない）
  await connection();
  const status = await checkDatabase();

  const view = {
    unconfigured: {
      dot: "stripe bg-white",
      title: "データベース未設定",
      body: "環境変数 SUPABASE_URL と SUPABASE_SECRET_KEY を設定してください。",
    },
    error: {
      dot: "bg-danger",
      title: "データベースに接続できません",
      body: status.kind === "error" ? status.message : "",
    },
    ok: {
      dot: "bg-ink",
      title: "データベース接続OK",
      body:
        status.kind === "ok" && status.storeName
          ? `デモ店舗「${status.storeName}」を確認しました。`
          : "接続できました。デモ店舗のデータ（seed.sql）はまだ入っていません。",
    },
  }[status.kind];

  return (
    <div className="flex gap-3 border border-ink bg-white p-4">
      <span className={`mt-1 size-3 shrink-0 border border-ink ${view.dot}`} aria-hidden />
      <div>
        <p className="font-semibold">{view.title}</p>
        <p className="mt-0.5 break-all text-sm text-gray">{view.body}</p>
      </div>
    </div>
  );
}
