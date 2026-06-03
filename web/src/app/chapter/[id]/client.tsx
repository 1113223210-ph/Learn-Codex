"use client";

import { ChapterVisualization } from "@/components/visualizations";
import { AgentLoopSimulator } from "@/components/simulator/agent-loop-simulator";
import { DocRenderer } from "@/components/docs/doc-renderer";
import { Tabs } from "@/components/ui/tabs";
import { CHAPTER_META, LAYER_COLORS } from "@/lib/constants";
import { useLocale } from "@/lib/locale-context";
import { UI_TEXT } from "@/lib/i18n";

interface ChapterDetailClientProps {
  chapterId: string;
}

export function ChapterDetailClient({ chapterId }: ChapterDetailClientProps) {
  const { locale } = useLocale();
  const t = UI_TEXT[locale];
  const ch = CHAPTER_META[chapterId];
  if (!ch) return null;

  const tabs = [
    { id: "learn",     label: t.chapter_tab_visual },
    { id: "simulate",  label: t.chapter_tab_sim },
    { id: "deep-dive", label: t.chapter_tab_deep },
  ];

  return (
    <div className="space-y-4">
      {/* Tabbed 内容 */}
      <Tabs tabs={tabs} defaultTab="learn">
        {(activeTab) => (
          <>
            {activeTab === "learn" && (
              <div className="space-y-4">
                {/* 可视化主体 */}
                <ChapterVisualization chapterId={chapterId} />

                {/* 核心源码文件 + GitHub 链接 */}
                <div className="flex flex-wrap gap-4">
                  <div className="card flex-1 min-w-60">
                    <h3 className="mb-3 text-sm font-semibold text-zinc-400">{t.chapter_source_files}</h3>
                    <div className="space-y-1">
                      {ch.sourceFiles.map((f) => (
                        <div key={f} className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: LAYER_COLORS[ch.layer] }} />
                          <span className="font-mono text-xs text-zinc-300">{f}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 text-xs text-zinc-600">{t.chapter_total_size}：{ch.sourceSize}</div>
                  </div>

                  <div className="card flex items-center">
                    <a
                      href="https://github.com/openai/codex/tree/main/codex-rs"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-zinc-400 no-underline transition-colors hover:text-white"
                    >
                      <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                      {t.chapter_view_source}
                    </a>
                  </div>
                </div>
              </div>
            )}
            {activeTab === "simulate" && (
              <AgentLoopSimulator chapterId={chapterId} />
            )}
            {activeTab === "deep-dive" && (
              <DocRenderer version={chapterId} />
            )}
          </>
        )}
      </Tabs>
    </div>
  );
}
