"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CHAPTER_ORDER, CHAPTER_META, LAYERS, LAYER_COLORS } from "@/lib/constants";
import { CHAPTER_META_I18N, LAYER_LABELS_I18N } from "@/lib/i18n";
import { useLocale } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

export function ChapterSidebar() {
  const pathname = usePathname();
  const { locale } = useLocale();

  return (
    <nav className="flex flex-col gap-5 pb-8">
      <div className="px-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
        13 章源码深潜
      </div>

      {LAYERS.map((layer) => {
        const layerLabel = LAYER_LABELS_I18N[layer.id]?.[locale] ?? layer.label;
        return (
          <div key={layer.id}>
            {/* 层标题 */}
            <div
              className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: layer.color }}
            >
              {layerLabel}
            </div>

            {/* 章节列表 */}
            <div className="flex flex-col gap-0.5">
              {layer.chapters.map((chId) => {
                const ch = CHAPTER_META[chId];
                const chI18n = CHAPTER_META_I18N[chId]?.[locale];
                const idx = CHAPTER_ORDER.indexOf(chId as typeof CHAPTER_ORDER[number]);
                const isActive = pathname === `/chapter/${chId}`;
                const layerColor = LAYER_COLORS[ch.layer];

                return (
                  <Link
                    key={chId}
                    href={`/chapter/${chId}`}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm no-underline transition-all",
                      isActive
                        ? "bg-zinc-800 text-white"
                        : "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-200"
                    )}
                  >
                    {/* 颜色点 */}
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full transition-all",
                        isActive ? "opacity-100" : "opacity-40 group-hover:opacity-80"
                      )}
                      style={{ backgroundColor: layerColor }}
                    />
                    {/* 章节号 */}
                    <span
                      className={cn(
                        "w-5 shrink-0 font-mono text-[10px] transition-colors",
                        isActive ? "text-zinc-400" : "text-zinc-700 group-hover:text-zinc-500"
                      )}
                    >
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    {/* 标题 */}
                    <span className="truncate leading-tight">
                      {chI18n?.title ?? ch.title}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
