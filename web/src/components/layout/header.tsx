"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/locale-context";
import { UI_TEXT } from "@/lib/i18n";
import { cn } from "@/lib/utils";


export function Header() {
  const pathname = usePathname();
  const { locale, setLocale } = useLocale();
  const t = UI_TEXT[locale];
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // 路由变化时自动关闭菜单
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // 菜单打开时阻止页面滚动
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  const links = [
    { href: "/", label: t.nav_home },
    { href: "/chapter/ch01", label: t.nav_learn, match: "/chapter" },
    { href: "/timeline", label: t.nav_path },
    { href: "/architecture", label: t.nav_arch },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
      <div className="flex h-14 items-center justify-between px-5 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-semibold text-white no-underline">
          <svg className="h-6 w-6 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-label="OpenAI">
            <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.911 6.046 6.046 0 0 0-6.51-2.9 6.065 6.065 0 0 0-10.774 2.9 5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .511 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.041l.141-.081 4.779-2.758a.779.779 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.495zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.758a.776.776 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.499 4.499 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0L3.78 13.99A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.856-5.843-3.369 2.02-1.168a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.104v-5.677a.79.79 0 0 0-.402-.681zm2.01-3.023-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.41 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.499 4.499 0 0 1 6.68 4.66zm-12.64 4.135-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.499 4.499 0 0 1 7.376-3.454l-.142.08-4.778 2.758a.779.779 0 0 0-.392.681zm1.097-2.365 2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
          </svg>
          <span className="hidden sm:inline">Learn Codex</span>
          <span className="sm:hidden">LC</span>
        </Link>

        {/* ── Desktop Nav ── */}
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => {
            const isActive = link.match
              ? pathname?.startsWith(link.match)
              : pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm no-underline transition-colors",
                  isActive
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                {link.label}
              </Link>
            );
          })}

          {/* 语言切换 */}
          <button
            onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
            className="rounded-md px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-200"
          >
            {locale === "zh" ? "EN" : "中文"}
          </button>

          {/* 分隔线 + 外链 */}
          <div className="ml-2 flex items-center gap-0.5 border-l border-zinc-800 pl-2">
            {/* GitHub */}
            <a
              href="https://github.com/1113223210-ph/Learn-Codex"
              target="_blank"
              rel="noopener noreferrer"
              title="GitHub - openai/codex"
              className="flex items-center rounded-md px-2 py-1.5 text-zinc-400 no-underline transition-colors hover:text-white"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
            </a>
          </div>
        </nav>

        {/* ── Mobile: 汉堡按钮 ── */}
        <div className="flex items-center gap-1 md:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-md text-zinc-400 transition-colors hover:text-white"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              /* X 关闭图标 */
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              /* 汉堡图标 */
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ── Mobile Menu Dropdown ── */}
      {mobileMenuOpen && (
        <div className="border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md md:hidden">
            <nav className="px-5 py-3 lg:px-8">
            {/* 导航链接 */}
            <div className="flex flex-col gap-1">
              {links.map((link) => {
                const isActive = link.match
                  ? pathname?.startsWith(link.match)
                  : pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "rounded-lg px-4 py-3 text-sm font-medium no-underline transition-colors",
                      isActive
                        ? "bg-zinc-800 text-white"
                        : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>

            {/* 分隔线 */}
            <div className="my-3 border-t border-zinc-800" />

            {/* 语言切换 + 外链 */}
            <div className="flex items-center gap-3 px-4">
              <button
                onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
                className="rounded-md px-3 py-2 text-sm font-medium text-zinc-400 transition-colors hover:text-white"
              >
                {locale === "zh" ? "EN" : "中文"}
              </button>
              <a
                href="https://github.com/1113223210-ph/Learn-Codex"
                target="_blank"
                rel="noopener noreferrer"
                title="GitHub - openai/codex"
                className="flex items-center gap-2 rounded-md py-1.5 text-sm text-zinc-400 no-underline transition-colors hover:text-white"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                GitHub
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
