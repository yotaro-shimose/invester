import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sector Pulse — セクター株価ビューア",
  description: "11 GICS sector ETFs, live prices and charts via yfinance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="sticky top-0 z-20 border-b border-zinc-800/80 bg-background/80 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-4">
            <Link href="/" className="flex items-center gap-2.5 group">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 text-sm font-bold text-zinc-950">
                SP
              </span>
              <span className="text-lg font-semibold tracking-tight">
                Sector Pulse
              </span>
            </Link>
            <span className="hidden text-sm text-zinc-500 sm:inline">
              株価ビューア & ペーパートレード
            </span>
            <nav className="ml-auto flex items-center gap-1 text-sm">
              <Link
                href="/"
                className="rounded-lg px-3 py-1.5 text-zinc-300 transition hover:bg-zinc-800/60"
              >
                ダッシュボード
              </Link>
              <Link
                href="/portfolio"
                className="rounded-lg px-3 py-1.5 text-zinc-300 transition hover:bg-zinc-800/60"
              >
                ポートフォリオ
              </Link>
              <Link
                href="/strategies"
                className="rounded-lg px-3 py-1.5 text-zinc-300 transition hover:bg-zinc-800/60"
              >
                戦略
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-6">
          {children}
        </main>
        <footer className="border-t border-zinc-800/80 px-5 py-4 text-center text-xs text-zinc-600">
          Data via yfinance · 投資判断は自己責任で行ってください
        </footer>
      </body>
    </html>
  );
}
