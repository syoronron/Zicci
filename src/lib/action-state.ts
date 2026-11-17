/** サーバーアクションの結果。画面にメッセージとして表示する */
export type ActionState = { ok: boolean; message: string } | null;

export const success = (message: string): ActionState => ({ ok: true, message });
export const failure = (message: string): ActionState => ({ ok: false, message });
