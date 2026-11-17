"use client";

import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type { ActionState } from "@/lib/action-state";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

const PendingContext = createContext(false);

/**
 * サーバーアクションを呼ぶフォーム。
 * 結果のメッセージ（成功・失敗）をフォームの下に表示する。
 *
 * React の標準動作では、送信後にフォームの入力値が自動で初期化される。
 * 編集フォームでは入力した値が消えて見えてしまうため、自前で送信し、
 * 初期化は resetOnSuccess を指定したとき（追加フォーム）だけ行う。
 */
export function ActionForm({
  action,
  children,
  className,
  confirm,
  messageClassName,
  silentSuccess,
  resetOnSuccess,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  /** 送信前に確認ダイアログを出す文言 */
  confirm?: string;
  messageClassName?: string;
  /** 成功メッセージを出さない（一覧の中の小さなボタンなど） */
  silentSuccess?: boolean;
  /** 成功したら入力欄を初期値に戻す（追加フォーム用） */
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return; // 二重送信を防ぐ
        if (confirm && !window.confirm(confirm)) return;
        const formData = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(() => formAction(formData));
      }}
    >
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
      {state && !(silentSuccess && state.ok) && (
        <p
          role="status"
          className={`mt-2 text-sm ${state.ok ? "text-gray" : "font-medium text-danger"} ${messageClassName ?? ""}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}

const variants = {
  /** 黄色：1画面に1か所だけ使う決定ボタン */
  accent: "bg-accent text-ink border border-ink",
  ink: "bg-ink text-white border border-ink",
  outline: "bg-white text-ink border border-ink",
  quiet: "bg-transparent text-gray underline underline-offset-4",
  danger: "bg-transparent text-danger underline underline-offset-4",
} as const;

export function SubmitButton({
  children,
  variant = "ink",
  className = "",
  name,
  value,
  pendingText = "処理中…",
}: {
  children: ReactNode;
  variant?: keyof typeof variants;
  className?: string;
  name?: string;
  value?: string;
  pendingText?: string;
}) {
  const pending = useContext(PendingContext);
  const size = variant === "quiet" || variant === "danger" ? "min-h-11 px-2 text-sm" : "min-h-12 px-4 font-bold";
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={`inline-flex items-center justify-center gap-2 ${size} ${variants[variant]} transition-opacity disabled:opacity-50 ${className}`}
    >
      {pending ? pendingText : children}
    </button>
  );
}
