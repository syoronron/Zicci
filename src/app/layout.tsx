import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_JP, Inter_Tight } from "next/font/google";
import "./globals.css";

const jp = IBM_Plex_Sans_JP({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-jp",
  display: "swap",
  preload: false,
});

const latin = Inter_Tight({
  weight: ["500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-latin",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Zicci｜面接日程をシフトから",
  description: "飲食店のアルバイト面接の日程調整を、シフト表から自動で作るWebアプリ。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fafaf7",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${jp.variable} ${latin.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
