"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { CHAPTER_ORDER, CHAPTER_META, LAYERS, LAYER_COLORS } from "@/lib/constants";
import { useLocale } from "@/lib/locale-context";
import {
  UI_TEXT, CHAPTER_META_I18N, LAYER_LABELS_I18N, LAYER_DETAILS_I18N,
  CODEX_FEATURES_I18N, AGENT_LOOP_STEPS_I18N, COMPARE_ITEMS_I18N,
  TEACHING_LACKS_I18N, CODEX_CRATES_I18N,
} from "@/lib/i18n";

/* ─── 常量 ─── */
const LAYER_BG: Record<string, string> = {
  engine:    "border-blue-500/30 hover:border-blue-500/60 hover:shadow-blue-500/10",
  tools:     "border-emerald-500/30 hover:border-emerald-500/60 hover:shadow-emerald-500/10",
  context:   "border-purple-500/30 hover:border-purple-500/60 hover:shadow-purple-500/10",
  ecosystem: "border-red-500/30 hover:border-red-500/60 hover:shadow-red-500/10",
};

/* Agent Loop 对应的 Rust 代码片段（保持英文，代码本身就是英文） */
const AGENT_LOOP_CODE = [
  `// tui/src/app.rs → 用户在 TUI 中输入后提交
// UserInput::Text 是带具名字段的枚举变体
let input = vec![UserInput::Text {
    text,
    text_elements: Vec::new(),
}];
// TUI 通过 Op::UserInput 将输入送入核心引擎
codex.route_text_input(text).await;`,

  `// core/src/codex.rs → build_initial_context()
// 签名：async fn build_initial_context(&self, turn_context: &TurnContext)
//        -> Vec<ResponseItem>
// Skills / Memories 均通过 turn_context 传入，不是直接参数
let context_items = self
    .build_initial_context(&turn_context)
    .await;`,

  `// core/src/codex/turn.rs → try_run_sampling_request()
// 通过 client_session.stream() 获取流式事件，而非一次性响应
let mut stream = client_session
    .stream(&prompt, &turn_context.model_info, ...)
    .await?;
// 逐事件处理流式输出
while let Some(event) = stream.next().await { ... }`,

  `// core/src/codex/turn.rs → try_run_sampling_request()
// 没有 stop_reason 枚举；通过 ResponseEvent 类型决定后续行为
match event {
    ResponseEvent::OutputItemDone(item) => {
        // tool call → in_flight.push_back(tool_future)
        // agent message → 记录 last_agent_message
        needs_follow_up |= output_result.needs_follow_up;
    }
    ResponseEvent::Completed { .. } => break Ok(result),
}`,

  `// core/src/tools/orchestrator.rs
// 流程：approval → select sandbox → attempt → retry on denial
// ToolCallRuntime 驱动整个执行，实际在 parallel.rs 并发分发
tool_runtime.run(tool_call, tool_ctx).await?;
// orchestrator 内部：
// 1. begin_network_approval() 检查网络策略
// 2. 选择沙箱级别（sandboxing.rs）
// 3. 调用具体 handler（exec.rs 负责子进程）`,

  `// core/src/codex/turn.rs → run_turn() 主循环
// 检查 token 用量是否超过 auto_compact_limit
let token_limit_reached =
    total_usage_tokens >= auto_compact_limit;
if token_limit_reached && needs_follow_up {
    // core/src/compact.rs → run_auto_compact()
    run_auto_compact(&sess, &turn_context, ...).await?;
}
// needs_follow_up 为 true 则继续循环，否则结束本 turn
if needs_follow_up { continue; } // → 回到步骤 2`,
];

/* ─── 子组件: 打字机效果 ─── */
function TypewriterText({ text, className }: { text: string; className?: string }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    setDisplayed("");
    setDone(false);
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
      } else {
        setDone(true);
        clearInterval(timer);
      }
    }, 30);
    return () => clearInterval(timer);
  }, [text]);

  return (
    <span className={className}>
      {displayed}
      {!done && <span className="animate-pulse text-blue-400">|</span>}
    </span>
  );
}

/* ─── 子组件: 交互式 Agent Loop ─── */
function InteractiveAgentLoop() {
  const { locale } = useLocale();
  const t = UI_TEXT[locale];
  const steps = AGENT_LOOP_STEPS_I18N[locale];
  const [activeStep, setActiveStep] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [isAutoPlaying, steps.length]);

  const current = steps[activeStep];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
      <div className="flex flex-col gap-1">
        {steps.map((step, i) => (
          <button
            key={step.id}
            onClick={() => { setActiveStep(i); setIsAutoPlaying(false); }}
            className={`group relative flex items-center gap-3 rounded-lg px-4 py-3 text-left transition-all ${i === activeStep ? "bg-zinc-800/80 shadow-lg" : "hover:bg-zinc-800/40"}`}
          >
            {i < steps.length - 1 && <div className="absolute left-[27px] top-full z-0 h-1 w-px bg-zinc-700" />}
            <div
              className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all"
              style={{
                backgroundColor: i === activeStep ? step.color : "transparent",
                border: `2px solid ${i === activeStep ? step.color : "#3f3f46"}`,
                color: i === activeStep ? "#fff" : "#71717a",
              }}
            >
              {i + 1}
            </div>
            <div className="min-w-0">
              <div className={`text-sm font-medium transition-colors ${i === activeStep ? "text-white" : "text-zinc-400"}`}>
                {step.label}
              </div>
            </div>
            {i === activeStep && (
              <motion.div
                layoutId="activeStep"
                className="absolute inset-0 rounded-lg border"
                style={{ borderColor: `${step.color}40` }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
          </button>
        ))}
        <div className="mt-1 flex items-center gap-2 px-4 text-xs text-zinc-600">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-zinc-600">
            <path d="M2 8a6 6 0 0 1 10.89-3.48M14 8a6 6 0 0 1-10.89 3.48" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M13.5 1v3.5H10M2.5 15v-3.5H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{t.agent_loop_footer}</span>
        </div>
        <button
          onClick={() => setIsAutoPlaying(!isAutoPlaying)}
          className="mt-2 mx-4 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
        >
          {isAutoPlaying ? t.agent_loop_pause : t.agent_loop_play}
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/50 p-6"
        >
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ backgroundColor: current.color }}>
              {activeStep + 1}
            </div>
            <h4 className="text-lg font-semibold text-white">{current.label}</h4>
          </div>
          <p className="mb-4 text-sm text-zinc-400">{current.desc}</p>
          <div className="flex-1 overflow-auto rounded-lg bg-black/50 p-4 font-mono text-xs leading-relaxed">
            <pre className="text-zinc-300">
              {AGENT_LOOP_CODE[activeStep]?.split("\n").map((line, i) => (
                <div key={i} className={line.startsWith("//") ? "text-zinc-600" : ""}>{line}</div>
              ))}
            </pre>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ─── 子组件: 架构层卡片(可展开) ─── */
function ExpandableLayerCard({ layer, index }: { layer: typeof LAYERS[number]; index: number }) {
  const { locale } = useLocale();
  const t = UI_TEXT[locale];
  const [expanded, setExpanded] = useState(false);
  const detail = LAYER_DETAILS_I18N[layer.id]?.[locale];
  const layerLabel = LAYER_LABELS_I18N[layer.id]?.[locale] ?? layer.label;
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className={`group card cursor-pointer border transition-all duration-300 hover:shadow-xl ${expanded ? "col-span-1 sm:col-span-2" : ""}`}
      style={{
        borderColor: expanded ? `${layer.color}60` : undefined,
        boxShadow: expanded ? `0 0 30px ${layer.color}15` : undefined,
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold text-white" style={{ backgroundColor: `${layer.color}25`, color: layer.color }}>
            L{index + 1}
          </div>
          <div>
            <div className="font-semibold text-white">{layerLabel}</div>
            <div className="text-xs text-zinc-500">{layer.chapters.length} {t.layers_chapters_suffix}</div>
          </div>
        </div>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }} className="text-zinc-500">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
      </div>

      <AnimatePresence>
        {expanded && detail && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="mt-4 border-t border-zinc-800 pt-4">
              <p className="text-sm leading-relaxed text-zinc-400">{detail.desc}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {layer.chapters.slice(0, 3).map((chId) => {
                  const ch = CHAPTER_META[chId];
                  return ch?.sourceFiles.slice(0, 2).map((f) => (
                    <span key={f} className="rounded-md bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-400">{f.split("/").pop()}</span>
                  ));
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {detail.keyPatterns.map((p) => (
                  <span key={p} className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: `${layer.color}15`, color: layer.color }}>
                    {p}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {layer.chapters.map((chId) => {
                  const chI18n = CHAPTER_META_I18N[chId]?.[locale];
                  return (
                    <Link
                      key={chId}
                      href={`/chapter/${chId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-md border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400 no-underline transition hover:border-zinc-500 hover:text-white"
                    >
                      {chI18n?.title ?? CHAPTER_META[chId]?.title} →
                    </Link>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── 子组件: 过滤器 Tab ─── */
function LayerFilterTabs({ active, onChange }: { active: string | null; onChange: (id: string | null) => void }) {
  const { locale } = useLocale();
  const t = UI_TEXT[locale];
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onChange(null)}
        className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${active === null ? "bg-white text-zinc-900" : "border border-zinc-700 text-zinc-400 hover:text-white"}`}
      >
        {t.path_filter_all}
      </button>
      {LAYERS.map((layer) => {
        const label = LAYER_LABELS_I18N[layer.id]?.[locale] ?? layer.label;
        return (
          <button
            key={layer.id}
            onClick={() => onChange(layer.id)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${active === layer.id ? "text-white" : "border border-zinc-700 text-zinc-400 hover:text-white"}`}
            style={active === layer.id ? { backgroundColor: layer.color } : {}}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   主页面
   ═══════════════════════════════════════════════════════════ */
export default function HomePage() {
  const { locale } = useLocale();
  const t = UI_TEXT[locale];
  const [layerFilter, setLayerFilter] = useState<string | null>(null);

  const filteredChapters = layerFilter
    ? CHAPTER_ORDER.filter((id) => CHAPTER_META[id].layer === layerFilter)
    : CHAPTER_ORDER;

  const codexFeatures = CODEX_FEATURES_I18N[locale];
  const compareItems = COMPARE_ITEMS_I18N[locale];
  const teachingLacks = TEACHING_LACKS_I18N[locale];
  const codexCrates = CODEX_CRATES_I18N[locale];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">

      {/* ── Hero Section ── */}
      <section className="relative flex flex-col items-center overflow-hidden pt-10 pb-14 text-center sm:pt-16 sm:pb-20">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/2 h-80 w-[800px] -translate-x-1/2 rounded-full bg-blue-500/5 blur-3xl" />
          <div className="absolute -top-20 left-1/3 h-60 w-[600px] -translate-x-1/2 rounded-full bg-purple-500/5 blur-3xl" />
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative px-2">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-[11px] text-zinc-400 sm:px-4 sm:text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {t.hero_badge}
          </div>
          <div className="mb-4 flex justify-center sm:mb-6">
            <svg className="h-12 w-12 text-white sm:h-20 sm:w-20 lg:h-24 lg:w-24" viewBox="0 0 24 24" fill="currentColor" aria-label="OpenAI">
              <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.911 6.046 6.046 0 0 0-6.51-2.9 6.065 6.065 0 0 0-10.774 2.9 5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .511 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.041l.141-.081 4.779-2.758a.779.779 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.495zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.758a.776.776 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.499 4.499 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0L3.78 13.99A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.856-5.843-3.369 2.02-1.168a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.104v-5.677a.79.79 0 0 0-.402-.681zm2.01-3.023-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.41 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.499 4.499 0 0 1 6.68 4.66zm-12.64 4.135-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.499 4.499 0 0 1 7.376-3.454l-.142.08-4.778 2.758a.779.779 0 0 0-.392.681zm1.097-2.365 2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            <span className="bg-gradient-to-r from-white via-zinc-300 to-zinc-500 bg-clip-text text-transparent">Learn </span><span className="bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">Codex</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl px-2 text-sm leading-relaxed text-zinc-400 sm:mt-6 sm:px-0 sm:text-lg">
            {t.hero_subtitle_1}
            <br />
            {t.hero_subtitle_2}
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.6 }} className="relative mt-8 flex w-full flex-col items-center gap-3 px-4 sm:mt-10 sm:w-auto sm:flex-row sm:gap-4 sm:px-0">
          <Link href="/chapter/ch01" className="group relative inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-bold text-zinc-900 no-underline shadow-[0_0_30px_rgba(255,255,255,0.15)] transition-all hover:bg-zinc-100 hover:shadow-[0_0_40px_rgba(255,255,255,0.25)] sm:w-auto sm:px-10 sm:py-4 sm:text-base">
            {t.hero_cta_start}
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="transition-transform group-hover:translate-x-0.5">
              <path d="M4 9h10m0 0L10.5 5.5M14 9l-3.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div className="flex w-full gap-3 sm:w-auto sm:gap-4">
            <Link href="/architecture" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-600 bg-zinc-900/80 px-4 py-3.5 text-sm font-semibold text-zinc-200 no-underline transition hover:border-zinc-400 hover:bg-zinc-800 hover:text-white sm:flex-none sm:px-8 sm:py-4 sm:text-base">
              {t.hero_cta_arch}
            </Link>
            <Link href="/timeline" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-600 bg-zinc-900/80 px-4 py-3.5 text-sm font-semibold text-zinc-200 no-underline transition hover:border-zinc-400 hover:bg-zinc-800 hover:text-white sm:flex-none sm:px-8 sm:py-4 sm:text-base">
              {t.hero_cta_timeline}
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ── Section: 核心 Agent Loop ── */}
      <section className="mb-20">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
          <div className="mb-2 text-sm font-medium text-blue-400">{t.sec_agent_loop_tag}</div>
          <h2 className="mb-2 text-2xl font-bold sm:text-3xl">{t.sec_agent_loop_title}</h2>
          <p className="mb-8 max-w-2xl text-sm text-zinc-500">{t.sec_agent_loop_desc}</p>
        </motion.div>
        <InteractiveAgentLoop />
      </section>

      {/* ── Section: 教学版 vs 生产版对比 ── */}
      <section className="mb-20">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
          <div className="mb-2 text-sm font-medium text-purple-400">{t.sec_compare_tag}</div>
          <h2 className="mb-2 text-2xl font-bold sm:text-3xl">{t.sec_compare_title}</h2>
          <p className="mb-8 max-w-2xl text-sm text-zinc-500">{t.sec_compare_desc}</p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* 教学版 */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">{t.compare_teaching}</span>
              <span className="text-xs text-zinc-500">{t.compare_teaching_lang}</span>
            </div>
            <div className="space-y-2 font-mono text-xs leading-relaxed">
              <div className="rounded-lg bg-black/40 p-3">
                <div className="text-zinc-500">{t.compare_teaching_comment}</div>
                <div><span className="text-blue-400">while</span> <span className="text-zinc-300">True:</span></div>
                <div className="pl-4"><span className="text-zinc-300">response = llm.call(messages)</span></div>
                <div className="pl-4"><span className="text-blue-400">if</span> <span className="text-zinc-300">response.stop_reason != </span><span className="text-emerald-400">{'"tool_use"'}</span><span className="text-zinc-300">:</span></div>
                <div className="pl-8"><span className="text-blue-400">break</span></div>
                <div className="pl-4"><span className="text-zinc-300">result = execute(response.tool)</span></div>
                <div className="pl-4"><span className="text-zinc-300">messages.append(result)</span></div>
              </div>
            </div>
            <div className="mt-4 space-y-1.5">
              {teachingLacks.map((item) => (
                <div key={item} className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="text-zinc-600">—</span> {item}
                </div>
              ))}
            </div>
          </div>

          {/* 生产版 Codex */}
          <div className="rounded-xl border border-blue-500/20 bg-zinc-900/50 p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-400">{t.compare_production}</span>
              <span className="text-xs text-zinc-500">{t.compare_production_extra}</span>
            </div>
            <div className="space-y-2">
              {compareItems.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-3 rounded-lg bg-black/20 px-3 py-2"
                >
                  <span className="mt-0.5 shrink-0 rounded bg-blue-500/20 px-1.5 py-0.5 font-mono text-[10px] text-blue-400">{item.ch}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-zinc-200">{item.label}</div>
                    <div className="text-[11px] text-zinc-500">{item.desc}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Section: 四层架构 ── */}
      <section className="mb-20">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
          <div className="mb-2 text-sm font-medium text-emerald-400">{t.sec_layers_tag}</div>
          <h2 className="mb-2 text-2xl font-bold sm:text-3xl">{t.sec_layers_title}</h2>
          <p className="mb-8 max-w-2xl text-sm text-zinc-500">{t.sec_layers_desc}</p>
        </motion.div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {LAYERS.map((layer, i) => (
            <ExpandableLayerCard key={layer.id} layer={layer} index={i} />
          ))}
        </div>
      </section>

      {/* ── Section: Codex 工程特性 ── */}
      <section className="mb-20">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
          <div className="mb-2 text-sm font-medium text-cyan-400">{t.sec_features_tag}</div>
          <h2 className="mb-2 text-2xl font-bold sm:text-3xl">{t.sec_features_title}</h2>
          <p className="mb-8 max-w-2xl text-sm text-zinc-500">{t.sec_features_desc}</p>
        </motion.div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {codexFeatures.map((item, i) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <div
                className="group block rounded-xl border bg-zinc-900/50 p-3 transition-all hover:bg-zinc-800/50"
                style={{ borderColor: `${item.color}20` }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">{item.icon}</span>
                  <span className="text-xs font-semibold text-zinc-200">{item.name}</span>
                </div>
                <div className="mb-1 font-mono text-[10px]" style={{ color: `${item.color}99` }}>{item.flag}</div>
                <div className="text-[10px] text-zinc-500 leading-relaxed">{item.desc}</div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-4 text-center">
          <Link href="/chapter/ch05" className="inline-flex items-center gap-2 rounded-lg bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-400 no-underline transition hover:bg-cyan-500/20">
            {t.sec_features_cta}
          </Link>
        </div>
      </section>

      {/* ── Section: 核心 Rust Crate ── */}
      <section className="mb-20">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
          <div className="mb-2 text-sm font-medium text-amber-400">{t.sec_crates_tag}</div>
          <h2 className="mb-2 text-2xl font-bold sm:text-3xl">{t.sec_crates_title}</h2>
          <p className="mb-8 max-w-2xl text-sm text-zinc-500">{t.sec_crates_desc}</p>
        </motion.div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {codexCrates.map((item, i) => (
            <motion.div key={item.crate} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.05 }}>
              <a
                href={`https://github.com/openai/codex/tree/main/codex-rs/${item.crate}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group block rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 no-underline transition-all hover:border-zinc-600 hover:bg-zinc-800/50"
              >
                <div className="flex items-center justify-between">
                  <code className="font-mono text-sm font-semibold text-white group-hover:text-amber-400 transition-colors">{item.crate}</code>
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `${LAYER_COLORS[item.layer]}20`, color: LAYER_COLORS[item.layer] }}>{item.size}</span>
                </div>
                <p className="mt-1.5 text-sm text-zinc-400">{item.desc}</p>
                <p className="mt-1 text-xs text-zinc-600 leading-relaxed">{item.detail}</p>
                <div className="mt-2 text-[10px] text-zinc-600 group-hover:text-zinc-400 transition-colors">在 GitHub 查看 →</div>
              </a>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Section: 章节学习路径 ── */}
      <section className="mb-20">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
          <div className="mb-2 text-sm font-medium text-amber-400">{t.sec_path_tag}</div>
          <h2 className="mb-2 text-2xl font-bold sm:text-3xl">{t.sec_path_title}</h2>
          <p className="mb-6 max-w-2xl text-sm text-zinc-500">{t.sec_path_desc}</p>
        </motion.div>

        <div className="mb-6">
          <LayerFilterTabs active={layerFilter} onChange={setLayerFilter} />
        </div>

        <motion.div layout className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filteredChapters.map((id) => {
              const i = CHAPTER_ORDER.indexOf(id);
              const ch = CHAPTER_META[id];
              const chI18n = CHAPTER_META_I18N[id]?.[locale];
              const layerColor = LAYER_COLORS[ch.layer];
              return (
                <motion.div key={id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.3 }}>
                  <Link href={`/chapter/${id}`} className={`card border ${LAYER_BG[ch.layer]} group flex flex-col no-underline shadow-lg transition-all hover:shadow-xl`}>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ backgroundColor: `${layerColor}15`, color: layerColor }}>
                        Ch{String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: layerColor }} />
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-zinc-200 group-hover:text-white">
                      {chI18n?.title ?? ch.title}
                    </h3>
                    <p className="mt-1 text-sm text-zinc-500">{chI18n?.subtitle ?? ch.subtitle}</p>
                    <p className="mt-3 border-l-2 pl-3 text-xs italic text-zinc-600" style={{ borderColor: `${layerColor}40` }}>
                      &ldquo;{chI18n?.motto ?? ch.motto}&rdquo;
                    </p>
                    <div className="mt-auto flex items-center gap-3 pt-4 text-xs text-zinc-600">
                      <span className="flex items-center gap-1">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3.5h10M2 7h10M2 10.5h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
                        {ch.sourceSize}
                      </span>
                      <span className="font-mono text-zinc-700">{ch.layer}</span>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-zinc-800 pt-8 pb-12 text-center">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
          <p className="text-sm text-zinc-600 italic">&ldquo;{t.footer_quote}&rdquo;</p>
          <p className="mt-2 text-sm text-zinc-500">{t.footer_quote_sub}</p>
          <div className="mt-6 flex items-center justify-center gap-6">
            <Link href="/chapter/ch01" className="text-sm text-zinc-400 no-underline hover:text-white transition">{t.footer_start}</Link>
            <Link href="/architecture" className="text-sm text-zinc-400 no-underline hover:text-white transition">{t.footer_arch}</Link>
            <a href="https://github.com/1113223210-ph/Learn-Codex" target="_blank" rel="noopener noreferrer" className="text-sm text-zinc-400 no-underline hover:text-white transition">GitHub →</a>
          </div>
        </motion.div>
      </footer>
    </div>
  );
}
