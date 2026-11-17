"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/** 画面下のタブ（片手・親指で届く位置） */
const tabs = [
  { href: "/admin", label: "ホーム", icon: "home" },
  { href: "/admin/staff", label: "スタッフ", icon: "staff" },
  { href: "/admin/shifts", label: "シフト", icon: "shift" },
  { href: "/admin/slots", label: "面接枠", icon: "slot" },
  { href: "/admin/settings", label: "設定", icon: "settings" },
] as const;

function Icon({ name, active }: { name: (typeof tabs)[number]["icon"]; active: boolean }) {
  const fill = active ? "#141414" : "none";
  const s = { stroke: "#141414", strokeWidth: 1.5 };
  switch (name) {
    case "home":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
          <rect x="2" y="2" width="16" height="16" fill={fill} {...s} />
        </svg>
      );
    case "staff":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
          <circle cx="10" cy="7" r="4" fill={fill} {...s} />
          <path d="M3 18 Q3 12 10 12 Q17 12 17 18 Z" fill={fill} {...s} />
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

export function AdminNav() {
  const pathname = usePathname();
  const week = useSearchParams().get("week");
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-ink bg-white pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {tabs.map((tab) => {
          const active = tab.href === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.href);
          // シフトと面接枠の間では、見ている週を引き継ぐ
          const keepWeek = week && (tab.href === "/admin/shifts" || tab.href === "/admin/slots");
          return (
            <li key={tab.href}>
              <Link
                href={keepWeek ? `${tab.href}?week=${week}` : tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] ${
                  active ? "font-bold" : "text-gray"
                }`}
              >
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
