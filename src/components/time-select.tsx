import { formatTime } from "@/lib/time";

/** 0:00〜24:00 を15分刻みで */
const OPTIONS = Array.from({ length: 24 * 4 + 1 }, (_, i) => formatTime(i * 15));

/**
 * 時刻の選択欄。
 * ブラウザ標準の時刻入力は端末の言語設定で「10:00 AM」などと表示が変わり、
 * 幅が狭いと見切れるため、15分刻みのセレクトにしている（スマホでは回転式で選べる）。
 */
export function TimeSelect({
  name,
  defaultValue,
  id,
  label,
  className = "",
}: {
  name: string;
  defaultValue: string;
  id?: string;
  /** 画面に見出しがないときの読み上げ用ラベル */
  label?: string;
  className?: string;
}) {
  return (
    <select
      id={id}
      name={name}
      defaultValue={defaultValue}
      aria-label={label}
      className={`field num ${className}`}
      required
    >
      {OPTIONS.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}
