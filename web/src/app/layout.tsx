import type { Metadata } from "next";
import { LocaleProvider } from "@/lib/locale-context";
import { Header } from "@/components/layout/header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Learn Codex",
  description: "13 章交互式教学，深入理解 OpenAI Codex 的 Agent 架构原理",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <LocaleProvider>
          <Header />
          <main>{children}</main>
        </LocaleProvider>
      </body>
    </html>
  );
}
