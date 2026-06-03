"use client";

import Link from "next/link";
import { CHAPTER_ORDER, CHAPTER_META, LAYERS, LAYER_COLORS } from "@/lib/constants";
import { useLocale } from "@/lib/locale-context";
import { UI_TEXT, CHAPTER_META_I18N, LAYER_LABELS_I18N } from "@/lib/i18n";

export default function TimelinePage() {
  const { locale } = useLocale();
  const t = UI_TEXT[locale];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <nav className="mb-8 text-sm text-zinc-500">
        <Link href="/" className="hover:text-white">{t.timeline_breadcrumb_home}</Link>
        <span className="mx-2">/</span>
        <span className="text-white">{t.timeline_breadcrumb_current}</span>
      </nav>

      <h1 className="mb-2 text-3xl font-bold">{t.timeline_title}</h1>
      <p className="mb-8 text-zinc-400">{t.timeline_desc}</p>

      {/* 层次图例 */}
      <div className="mb-8 flex flex-wrap gap-4">
        {LAYERS.map((l) => (
          <div key={l.id} className="flex items-center gap-2 text-sm text-zinc-400">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: l.color }} />
            {LAYER_LABELS_I18N[l.id]?.[locale] ?? l.label}
          </div>
        ))}
      </div>

      {/* 时间线 */}
      <div className="relative">
        <div className="absolute left-6 top-0 h-full w-px bg-zinc-800" />

        {CHAPTER_ORDER.map((id, i) => {
          const ch = CHAPTER_META[id];
          const chI18n = CHAPTER_META_I18N[id]?.[locale];
          const color = LAYER_COLORS[ch.layer];
          return (
            <Link
              key={id}
              href={`/chapter/${id}`}
              className="relative mb-6 ml-14 block rounded-lg border border-zinc-800 p-4 transition hover:border-zinc-600 hover:bg-zinc-900/50"
            >
              <div
                className="absolute -left-[2.55rem] top-5 h-4 w-4 rounded-full border-2 border-zinc-900"
                style={{ backgroundColor: color }}
              />
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-zinc-500">Ch{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="text-lg font-semibold">{chI18n?.title ?? ch.title}</h3>
                  <p className="text-sm text-zinc-500">{chI18n?.subtitle ?? ch.subtitle}</p>
                </div>
                <div className="text-right text-xs text-zinc-600">
                  <div>{ch.sourceSize}</div>
                  <div className="font-mono text-zinc-700">{ch.layer}</div>
                </div>
              </div>
              <p className="mt-2 text-xs italic text-zinc-600">&ldquo;{chI18n?.motto ?? ch.motto}&rdquo;</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
