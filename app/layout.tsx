import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "NyayaAI – consumer dispute assistant (India)",
  description:
    "Explains consumer rights in India in plain language, builds your case and drafts a legal notice, citing only verified official provisions.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-slate-200 bg-white print:hidden">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-indigo-700 text-sm text-white">न्या</span>
              NyayaAI
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/assistant" className="rounded-md bg-indigo-700 px-3 py-1.5 font-medium text-white hover:bg-indigo-800">
                Open assistant
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
