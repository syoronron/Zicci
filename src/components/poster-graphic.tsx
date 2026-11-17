/**
 * トップページのポスター用グラフィック。
 * シフト表のマス目（□）、忙しい時間（斜線）、面接枠（○）、決まった面接（黄色の●）、
 * そして時計と時間軸。デザイン設計（design/concept-a4.html）のヒーローと同じ構成。
 */
const INK = "#141414";
const MIST = "#C9C9C4";
const YELLOW = "#FFC800";

// 0=空き 1=勤務 2=繁忙 3=面接枠 4=決まった面接
const GRID = [
  [1, 1, 2, 1, 0, 1],
  [1, 3, 2, 3, 1, 0],
  [0, 1, 2, 4, 3, 1],
  [1, 3, 1, 2, 1, 3],
  [1, 1, 0, 2, 3, 1],
];

export function PosterGraphic({ className }: { className?: string }) {
  const ox = 8;
  const oy = 128;
  const c = 34;
  const g = 7;
  const cx = 262;
  const cy = 98;
  const r = 90;
  const axisY = oy + GRID.length * (c + g) + 4;
  const rad = (deg: number) => (deg * Math.PI) / 180;

  return (
    <svg viewBox="0 4 360 348" preserveAspectRatio="xMidYMid meet" className={className} role="img" aria-label="シフト表のマス目から面接の時間が生まれるイメージ">
      <defs>
        <pattern id="poster-stripe" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="5" stroke={INK} strokeWidth="1" />
        </pattern>
      </defs>

      {/* 時計 */}
      <circle cx={cx} cy={cy} r={r} fill="#fff" stroke={INK} strokeWidth="1" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = rad(i * 30);
        const inner = r - (i % 3 === 0 ? 12 : 7);
        return (
          <line
            key={i}
            x1={cx + Math.sin(a) * inner}
            y1={cy - Math.cos(a) * inner}
            x2={cx + Math.sin(a) * r}
            y2={cy - Math.cos(a) * r}
            stroke={INK}
            strokeWidth="1"
          />
        );
      })}
      {/* 14:00 を指す針 */}
      <line x1={cx} y1={cy} x2={cx + Math.sin(rad(60)) * 50} y2={cy - Math.cos(rad(60)) * 50} stroke={INK} strokeWidth="2.2" />
      <line x1={cx} y1={cy} x2={cx} y2={cy - 72} stroke={INK} strokeWidth="1.2" />
      <rect x={cx - 3} y={cy - 3} width="6" height="6" fill={INK} />

      {/* シフト表のマス目 */}
      {GRID.flatMap((row, ri) =>
        row.map((v, ci) => {
          const x = ox + ci * (c + g);
          const y = oy + ri * (c + g);
          const key = `${ri}-${ci}`;
          if (v === 0)
            return (
              <rect key={key} x={x + 0.5} y={y + 0.5} width={c - 1} height={c - 1} fill="none" stroke={MIST} strokeDasharray="2 3" />
            );
          if (v === 3 || v === 4)
            return (
              <circle key={key} cx={x + c / 2} cy={y + c / 2} r={c / 2 - 0.5} fill={v === 4 ? YELLOW : "#fff"} stroke={INK} strokeWidth="1" />
            );
          return (
            <g key={key}>
              <rect x={x + 0.5} y={y + 0.5} width={c - 1} height={c - 1} fill="#fff" stroke={INK} strokeWidth="1" />
              {v === 2 && <rect x={x + 1} y={y + 1} width={c - 2} height={c - 2} fill="url(#poster-stripe)" />}
            </g>
          );
        }),
      )}

      {/* 時間軸 */}
      <line x1={ox} y1={axisY} x2={352} y2={axisY} stroke={INK} strokeWidth="1" />
      {Array.from({ length: 13 }, (_, i) => {
        const x = ox + (i * (352 - ox)) / 12;
        return <line key={i} x1={x} y1={axisY - (i % 3 === 0 ? 6 : 3)} x2={x} y2={axisY} stroke={INK} strokeWidth="1" />;
      })}

      {/* 小さなアクセント */}
      <rect x="302" y="246" width="14" height="14" fill={INK} />
      <rect x="10" y="92" width="12" height="12" fill="none" stroke={INK} />
      <circle cx="38" cy="98" r="6" fill="none" stroke={INK} />
    </svg>
  );
}
