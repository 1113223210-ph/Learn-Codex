"use client";

import Link from "next/link";
import { CHAPTER_ORDER, CHAPTER_META, LAYER_COLORS } from "@/lib/constants";
import { useLocale } from "@/lib/locale-context";
import { UI_TEXT, CHAPTER_META_I18N } from "@/lib/i18n";
import { ChapterDetailClient } from "./client";

interface ChapterPageClientProps {
  id: string;
}

export function ChapterPageClient({ id }: ChapterPageClientProps) {
  const { locale } = useLocale();
  const t = UI_TEXT[locale];
  const ch = CHAPTER_META[id];
  const idx = CHAPTER_ORDER.indexOf(id as typeof CHAPTER_ORDER[number]);

  if (!ch) return <div className="p-8">Chapter not found</div>;

  const chI18n = CHAPTER_META_I18N[id]?.[locale];
  const prevId = idx > 0 ? CHAPTER_ORDER[idx - 1] : null;
  const nextId = idx < CHAPTER_ORDER.length - 1 ? CHAPTER_ORDER[idx + 1] : null;
  const layerColor = LAYER_COLORS[ch.layer];

  const prevI18n = prevId ? CHAPTER_META_I18N[prevId]?.[locale] : null;
  const nextI18n = nextId ? CHAPTER_META_I18N[nextId]?.[locale] : null;

  return (
    <div>
      {/* 章节头 */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: layerColor }} />
          <span className="text-xs text-zinc-500 font-mono">ch{String(idx + 1).padStart(2, "0")}</span>
          <span className="text-xs text-zinc-700 font-mono">{ch.layer}</span>
        </div>
        <h1 className="text-2xl font-bold">{chI18n?.title ?? ch.title}</h1>
        <p className="mt-1 text-base text-zinc-400">{chI18n?.subtitle ?? ch.subtitle}</p>
        <blockquote className="mt-2 border-l-2 border-zinc-800 pl-3 text-xs italic text-zinc-600">
          &ldquo;{chI18n?.motto ?? ch.motto}&rdquo;
        </blockquote>
      </div>

      {/* 交互式内容 */}
      <ChapterDetailClient chapterId={id} />

      {/* 前后导航 */}
      <div className="mt-12 flex justify-between border-t border-zinc-800 pt-6">
        {prevId ? (
          <Link href={`/chapter/${prevId}`} className="card max-w-xs hover:border-zinc-600 no-underline">
            <div className="text-xs text-zinc-500">{t.chapter_prev}</div>
            <div className="mt-1 font-medium text-zinc-200">{prevI18n?.title ?? CHAPTER_META[prevId].title}</div>
          </Link>
        ) : <div />}
        {nextId ? (
          <Link href={`/chapter/${nextId}`} className="card max-w-xs text-right hover:border-zinc-600 no-underline">
            <div className="text-xs text-zinc-500">{t.chapter_next}</div>
            <div className="mt-1 font-medium text-zinc-200">{nextI18n?.title ?? CHAPTER_META[nextId].title}</div>
          </Link>
        ) : <div />}
      </div>
    </div>
  );
}
