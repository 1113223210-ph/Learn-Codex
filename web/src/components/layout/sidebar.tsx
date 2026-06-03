"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LAYERS, CHAPTER_META } from "@/lib/constants";
import { useLocale } from "@/lib/locale-context";
import { LAYER_LABELS_I18N, CHAPTER_META_I18N } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const LAYER_DOT_BG: Record<string, string> = {
  engine: "bg-blue-500",
  tools: "bg-emerald-500",
  context: "bg-purple-500",
  ecosystem: "bg-red-500",
  hidden: "bg-yellow-500",
};

export function Sidebar() {
  const pathname = usePathname();
  const { locale } = useLocale();

  return (
    <nav className="hidden w-56 shrink-0 md:block">
      <div className="sticky top-[calc(3.5rem+2rem)] space-y-5">
        {LAYERS.map((layer) => {
          const layerLabel = LAYER_LABELS_I18N[layer.id]?.[locale] ?? layer.label;
          return (
            <div key={layer.id}>
              <div className="flex items-center gap-1.5 pb-1.5">
                <span className={cn("h-2 w-2 rounded-full", LAYER_DOT_BG[layer.id])} />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  {layerLabel}
                </span>
              </div>
              <ul className="space-y-0.5">
                {layer.chapters.map((chId) => {
                  const meta = CHAPTER_META[chId];
                  const chI18n = CHAPTER_META_I18N[chId]?.[locale];
                  const href = `/chapter/${chId}`;
                  const isActive = pathname === href || pathname?.startsWith(`${href}/`);

                  return (
                    <li key={chId}>
                      <Link
                        href={href}
                        className={cn(
                          "block rounded-md px-2.5 py-1.5 text-sm transition-colors",
                          isActive
                            ? "bg-zinc-800 font-medium text-white"
                            : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300"
                        )}
                      >
                        <span className="font-mono text-xs">{chId}</span>
                        <span className="ml-1.5">{chI18n?.title ?? meta?.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
