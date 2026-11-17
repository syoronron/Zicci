/** Zicci のマーク：斜線の □（店の忙しい時間）と黄色の □（決まった面接）が重なる */
export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 50 50" aria-hidden>
      <defs>
        <pattern id="logo-stripe" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="5" stroke="#141414" strokeWidth="1.2" />
        </pattern>
      </defs>
      <rect x="1.5" y="1.5" width="29" height="29" fill="#fff" stroke="#141414" strokeWidth="2.4" />
      <rect x="1.5" y="1.5" width="29" height="29" fill="url(#logo-stripe)" />
      <rect x="19.5" y="19.5" width="29" height="29" fill="#FFC800" stroke="#141414" strokeWidth="2.4" />
    </svg>
  );
}

export function Logo({ size = 24 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={size} />
      <span className="num text-xl font-extrabold tracking-[-0.04em]">Zicci</span>
    </span>
  );
}
