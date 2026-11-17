import type { ReactNode } from "react";
import { LogoMark } from "@/components/logo";

/** 応募者向けページの共通の枠（店舗名を主役にし、Zicci は小さく） */
export function ApplicantShell({
  storeName,
  address,
  children,
}: {
  storeName?: string;
  address?: string | null;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col px-5 pt-4 pb-10">
      <header className="border-b border-ink pb-3">
        <p className="num text-[10px] font-semibold tracking-[0.2em] text-gray">INTERVIEW BOOKING</p>
        <p className="mt-1 text-lg font-bold">{storeName ?? " "}</p>
        {address && <p className="text-xs text-gray">{address}</p>}
      </header>
      {children}
      <footer className="mt-auto flex items-center gap-1.5 pt-10 text-[10px] text-gray">
        <LogoMark size={12} />
        <span className="num tracking-[0.12em]">POWERED BY ZICCI</span>
      </footer>
    </main>
  );
}
