import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { AdminNav } from "./admin-nav";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-ink bg-paper/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
          <Link href="/admin" aria-label="ホームへ">
            <Logo size={22} />
          </Link>
          <span className="num text-[10px] font-semibold tracking-[0.2em] text-gray">STORE</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-5 pb-28">
        <Suspense fallback={<p className="text-sm text-gray">読み込み中…</p>}>{children}</Suspense>
      </main>
      <Suspense>
        <AdminNav />
      </Suspense>
    </div>
  );
}
