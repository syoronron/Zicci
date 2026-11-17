import "server-only";

/**
 * ログインの連続失敗を制限する（短いパスワードを当てずっぽうで試されにくくするため）。
 *
 * 同じ接続元（IPアドレス）から MAX_FAILURES 回続けて間違えると、LOCK_MINUTES 分ログインできなくなる。
 * 記録はサーバーのメモリにだけ置く簡易版。Vercel ではサーバーが複数台・入れ替わりがあるため完全ではないが、
 * 失敗時の待ち時間と合わせて、試作段階の総当たり対策としては十分な効果がある。
 */
const MAX_FAILURES = 5;
const LOCK_MINUTES = 10;

type Entry = { failures: number; lockedUntil: number };
const entries = new Map<string, Entry>();

/** ロック中なら残り分数を返す */
export function lockedMinutes(key: string, now = Date.now()): number | null {
  const entry = entries.get(key);
  if (!entry || entry.lockedUntil <= now) return null;
  return Math.ceil((entry.lockedUntil - now) / 60_000);
}

/** 失敗を記録する。ロックがかかったら true */
export function recordFailure(key: string, now = Date.now()): boolean {
  const entry = entries.get(key) ?? { failures: 0, lockedUntil: 0 };
  if (entry.lockedUntil && entry.lockedUntil <= now) {
    entry.failures = 0;
    entry.lockedUntil = 0;
  }
  entry.failures += 1;
  if (entry.failures >= MAX_FAILURES) entry.lockedUntil = now + LOCK_MINUTES * 60_000;
  entries.set(key, entry);
  // 記録が増えすぎないように古いものを掃除する
  if (entries.size > 5000) {
    for (const [k, v] of entries) if (v.lockedUntil <= now && v.failures < MAX_FAILURES) entries.delete(k);
  }
  return entry.lockedUntil > now;
}

export function recordSuccess(key: string): void {
  entries.delete(key);
}

export const LOGIN_LIMITS = { MAX_FAILURES, LOCK_MINUTES };
