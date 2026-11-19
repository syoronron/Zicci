"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/** 画面下のタブ（片手・親指で届く位置） */
/**
 * 左端はホーム（予約・面接）。その右に採用の手順、シフト → 面接枠の作業順で並べる。
 * also：そのタブの中として扱うページ（そのページを開いているときもタブを選択状態にする）
 */
const tabs = [
  { href: "/admin", label: "ホーム", icon: "reserve", also: ["/admin/guide/run", "/admin/guide/record"] },
  { href: "/admin/hiring", label: "採用", icon: "home", also: [] },
  { href: "/admin/shifts", label: "シフト", icon: "shift", also: ["/admin/import"] },
  { href: "/admin/slots", label: "面接枠", icon: "slot", also: ["/admin/qr"] },
  { href: "/admin/settings", label: "設定", icon: "settings", also: ["/admin/staff", "/admin/guide"] },
] as const;

function isActive(tab: (typeof tabs)[number], pathname: string): boolean {
  if (tab.href === "/admin") return pathname === "/admin" || tab.also.some((p) => pathname.startsWith(p));
  if (pathname.startsWith(tab.href)) return true;
  // 「面接の進め方」の編集は設定、面接中・記録は予約・面接
  if (tab.href === "/admin/settings" && /^\/admin\/guide\/(run|record)/.test(pathname)) return false;
  return tab.also.some((p) => pathname.startsWith(p));
}

function Icon({ name, active }: { name: (typeof tabs)[number]["icon"]; active: boolean }) {
  const fill = active ? "#141414" : "none";
  const s = { stroke: "#141414", strokeWidth: 1.5 };
  switch (name) {
    case "home":
      // 採用：手順の一覧（✓ の四角と線）
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
          <rect x="2" y="2.5" width="5" height="5" fill={fill} {...s} />
          <rect x="2" y="12.5" width="5" height="5" fill="none" {...s} />
          <line x1="10" y1="5" x2="18" y2="5" {...s} />
          <line x1="10" y1="15" x2="18" y2="15" {...s} />
        </svg>
      );
    case "reserve":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
          <rect x="2" y="4" width="16" height="14" fill="none" {...s} />
          <line x1="2" y1="8" x2="18" y2="8" {...s} />
          <line x1="6" y1="2" x2="6" y2="5" {...s} />
          <line x1="14" y1="2" x2="14" y2="5" {...s} />
          <rect x="10" y="11" width="5" height="4" fill={active ? "#141414" : "none"} {...s} />
        </svg>
      );
    case "shift":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
          <rect x="2" y="2" width="7" height="7" fill={fill} {...s} />
          <rect x="11" y="2" width="7" height="7" fill="none" {...s} />
          <rect x="2" y="11" width="7" height="7" fill="none" {...s} />
          <rect x="11" y="11" width="7" height="7" fill={fill} {...s} />
        </svg>
      );
    case "slot":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
          <circle cx="10" cy="10" r="8" fill={fill} {...s} />
        </svg>
      );
    case "settings":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
          <line x1="2" y1="5" x2="18" y2="5" {...s} />
          <line x1="2" y1="15" x2="18" y2="15" {...s} />
          <rect x="5" y="2.5" width="5" height="5" fill={active ? "#141414" : "#fff"} {...s} />
          <rect x="10" y="12.5" width="5" height="5" fill={active ? "#141414" : "#fff"} {...s} />
        </svg>
      );
  }
}

/** 押したタブの上に出る、読み込み中の線 */
function PendingBar() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={`absolute inset-x-3 top-0 h-0.5 bg-ink transition-opacity ${pending ? "animate-pulse opacity-100" : "opacity-0"}`}
    />
  );
}

export function AdminNav() {
  const pathname = usePathname();
  const week = useSearchParams().get("week");
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-ink bg-white pb-[env(safe-area-inset-bottom)] print:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {tabs.map((tab) => {
          const active = isActive(tab, pathname);
          // シフトと面接枠の間では、見ている週を引き継ぐ
          const keepWeek = week && (tab.href === "/admin/shifts" || tab.href === "/admin/slots");
          return (
            <li key={tab.href}>
              <Link
                href={keepWeek ? `${tab.href}?week=${week}` : tab.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] ${
                  active ? "font-bold" : "text-gray"
                }`}
              >
                <PendingBar />
                <Icon name={tab.icon} active={active} />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
