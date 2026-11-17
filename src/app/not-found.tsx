import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col px-5 pt-4 pb-8">
      <header className="border-b border-ink pb-3">
        <Logo size={22} />
      </header>
      <p className="num mt-12 text-[11px] font-semibold tracking-[0.2em] text-gray">404</p>
      <h1 className="mt-1 text-2xl font-bold">ページが見つかりません</h1>
      <p className="mt-2 text-sm leading-relaxed text-gray">
        URLが間違っているか、ページが削除された可能性があります。お店から届いたURLをもう一度ご確認ください。
      </p>
      <Link href="/" className="mt-8 flex min-h-12 items-center justify-center border border-ink bg-white text-sm font-bold">
        トップページへ
      </Link>
    </main>
  );
}
