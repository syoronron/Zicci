/**
 * シフト表の取り込み（写真 → 確認・修正 → 登録）で使うデータの形。
 *
 * 今は人が写真を見ながら入力するが、将来 AI で読み取るときも
 * 「AI がこの形のデータを作り、人が確認・修正してから登録する」流れにする。
 * （AI の読み取り結果をそのまま登録はしない）
 */

/** 1人分の、1週間のシフト */
export type ImportPerson = {
  /** 既存のスタッフなら ID、シフト表で新しく見つかった人なら null */
  employeeId: string | null;
  name: string;
  /** 面接担当にするか（「誰が面接できますか？」の答え） */
  interviewer: boolean;
  /** その週の勤務。1日1件まで。休みの日は含めない */
  entries: { date: string; start: string; end: string }[];
};

/** 登録時にサーバーへ送る内容 */
export type ImportPayload = {
  /** 対象の週の月曜日 */
  week: string;
  /** 「誰が面接できますか？」に表示した全員（面接担当でない人も含む） */
  people: ImportPerson[];
};
