import Link from "next/link";
import { connection } from "next/server";
import QRCode from "qrcode";
import { LogoMark } from "@/components/logo";
import { SetupNotice } from "@/components/page-header";
import { requireAdminPage } from "@/lib/auth";
import { getStore, isDatabaseConfigured } from "@/lib/data/store";
import { bookingUrl } from "@/lib/site-url";
import { PrintButton } from "./print-button";

/** 店頭やチラシに貼る、予約ページのQRコードのポスター（A4で印刷） */
export default async function QrPosterPage() {
  await connection();
  await requireAdminPage();
  if (!isDatabaseConfigured()) return <SetupNotice />;
  const store = await getStore();
  if (!store) return null;

  const url = await bookingUrl(store.public_slug);
  // QR はサーバーの中で作る（外部のサービスは使わない）
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#141414", light: "#ffffff" } });

  return (
    <>
      <div className="mb-4 print:hidden">
        <p className="num text-[11px] font-semibold tracking-[0.2em] text-gray">QR POSTER</p>
        <h1 className="mt-1 text-2xl font-bold">印刷用ポスター</h1>
        <p className="mt-2 text-sm text-gray">店頭の掲示や求人チラシに。A4の紙に印刷して使えます。</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <PrintButton />
          <Link href="/admin" className="flex min-h-12 items-center justify-center border border-ink bg-white text-sm font-bold">
            戻る
          </Link>
        </div>
      </div>

      {/* ポスター本体（印刷されるのはここだけ） */}
      <article className="mx-auto flex aspect-[210/297] w-full flex-col border border-ink bg-white p-[7%] text-center print:aspect-auto print:h-[277mm] print:max-w-none print:border-0 print:p-[12mm]">
        <p className="text-left text-[clamp(0.6rem,2.4vw,0.9rem)] font-semibold tracking-[0.2em] text-gray print:text-sm">
          STAFF WANTED
        </p>
        <h2 className="mt-[4%] text-[clamp(1.6rem,8vw,3rem)] leading-tight font-bold print:text-5xl">
          アルバイト面接の
          <br />
          ご予約はこちら
        </h2>
        <p className="mt-[3%] text-[clamp(0.8rem,3.5vw,1.25rem)] font-bold print:text-2xl">{store.name}</p>
        <div
          className="mx-auto mt-[6%] w-[62%] border-[3px] border-ink p-[3%] [&>svg]:h-auto [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <p className="mt-[5%] text-[clamp(0.8rem,3.4vw,1.25rem)] font-bold print:text-xl">
          スマホのカメラで読み取ると、面接の日時を選べます
        </p>
        <p className="num mt-[2%] text-[clamp(0.55rem,2.2vw,0.85rem)] break-all text-gray print:text-sm">{url}</p>
        <div className="mt-auto flex items-center justify-between border-t border-ink pt-[3%] text-left">
          <span className="text-[clamp(0.55rem,2.2vw,0.85rem)] text-gray print:text-sm">{store.address ?? ""}</span>
          <span className="flex items-center gap-1.5 text-[clamp(0.5rem,2vw,0.75rem)] text-gray print:text-xs">
            <LogoMark size={14} />
            Zicci
          </span>
        </div>
      </article>
    </>
  );
}
