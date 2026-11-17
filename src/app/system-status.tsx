import { connection } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { readSupabaseConfig } from "@/lib/supabase/config";

type Status =
  | { kind: "unconfigured" }
  | { kind: "invalid"; message: string }
  | { kind: "error"; message: string }
  | { kind: "ok"; storeName: string | null };

/** データベースのエラーを、設定の見直しポイントがわかる言葉に変える */
function explainDbError(error: { message: string; code?: string }): string {
  const m = error.message;
  if (/invalid api key|jwt|jws|unauthorized|no api key/i.test(m)) {
    return `キーが正しくありません。SUPABASE_SECRET_KEY に Secret key（または service_role キー）が入っているか確認してください。（${m}）`;
  }
  if (error.code === "42P01" || /does not exist|could not find the table/i.test(m)) {
    return `テーブルが見つかりません。Supabase の SQL Editor でセットアップ用SQLを実行してください。（${m}）`;
  }
  if (/fetch failed|enotfound|getaddrinfo/i.test(m)) {
    return `Supabase に接続できません。SUPABASE_URL が正しいか確認してください。（${m}）`;
  }
  if (error.code === "42501" || /permission denied/i.test(m)) {
    return `データベースの権限がありません。キーが Secret key（または service_role キー）か確認してください。（${m}）`;
  }
  return m;
}

async function checkDatabase(): Promise<Status> {
  const config = readSupabaseConfig();
  if (!config.ok) {
    return config.reason === "missing" ? { kind: "unconfigured" } : { kind: "invalid", message: config.message };
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return { kind: "invalid", message: "SUPABASE_URL の形式が正しくありません。" };

  try {
    const { data, error } = await supabase
      .from("stores")
      .select("name")
      .eq("public_slug", "demo")
      .maybeSingle();
    if (error) return { kind: "error", message: explainDbError(error) };
    return { kind: "ok", storeName: data?.name ?? null };
  } catch (e) {
    return { kind: "error", message: explainDbError({ message: e instanceof Error ? e.message : String(e) }) };
  }
}

/** データベースにつながっているかを表示する（設定の確認用） */
export async function SystemStatus({ compact = false }: { compact?: boolean }) {
  // アクセスのたびに最新の状態を確認する（ビルド時に結果を固定しない）
  await connection();
  const status = await checkDatabase();

  const view = {
    unconfigured: {
      dot: "stripe bg-white",
      title: "データベース未設定",
      body: "環境変数 SUPABASE_URL と SUPABASE_SECRET_KEY を設定してください。",
    },
    invalid: {
      dot: "bg-danger",
      title: "設定に誤りがあります",
      body: status.kind === "invalid" ? status.message : "",
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

  // 小さな1行表示：問題がなければ状態だけ、問題があれば直し方も出す
  if (compact) {
    return (
      <div className="flex items-start gap-2 text-[11px] text-gray">
        <span className={`mt-0.5 size-2.5 shrink-0 border border-ink ${view.dot}`} aria-hidden />
        <p className="break-all">
          <span className="num font-semibold tracking-[0.12em]">SYSTEM</span>　{view.title}
          {status.kind !== "ok" && <span className="mt-0.5 block text-danger">{view.body}</span>}
        </p>
      </div>
    );
  }

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
