"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useSteppedVisualization } from "@/hooks/useSteppedVisualization";
import { StepControls } from "@/components/visualizations/shared/step-controls";

// ─── compact.rs 三个触发路径 ───────────────────────────────────────────────────
//
// 触发点1: turn.rs:147  run_pre_sampling_compact()
//           → total_tokens >= auto_compact_limit → CompactionPhase::PreTurn
//
// 触发点2: turn.rs:492  token_limit_reached && needs_follow_up
//           → run_auto_compact(InitialContextInjection::BeforeLastUserMessage)
//           → CompactionPhase::MidTurn
//
// 触发点3: 用户手动   run_compact_task()
//           → CompactionTrigger::Manual / CompactionPhase::StandaloneTurn
//
// 所有路径最终进入: run_compact_task_inner_impl()
//   1. 调模型生成摘要（drain_to_completed）
//   2. collect_user_messages()  最多 COMPACT_USER_MESSAGE_MAX_TOKENS=20_000
//   3. build_compacted_history() → 用户消息列表 + 摘要文本
//   4. sess.replace_compacted_history(new_history, ...)

type CompactionPhase = "预压缩 PreTurn" | "轮中压缩 MidTurn" | "手动压缩 Manual";
type InjectionMode = "DoNotInject" | "BeforeLastUserMessage";

interface CompactionStep {
  phase: CompactionPhase;
  injection: InjectionMode;
  trigger: string;
  tokensBefore: number;
  tokensAfter: number;
  historyBefore: string[];
  historyAfter: string[];
  summarySnippet: string;
}

const STEPS: CompactionStep[] = [
  {
    phase: "预压缩 PreTurn",
    injection: "DoNotInject",
    trigger: "turn.rs:729 — total_tokens(148K) ≥ auto_compact_limit(120K)\nrun_pre_sampling_compact() → CompactionPhase::PreTurn",
    tokensBefore: 148000,
    tokensAfter: 32000,
    historyBefore: [
      "[系统提示] 30K",
      "[user] 帮我重构认证模块",
      "[assistant] 好的，先读取文件...",
      "[tool: shell] cat src/auth.rs → 45K 输出",
      "[tool: shell] grep -r import → 18K 输出",
      "[user] 继续分析依赖关系",
      "[assistant] 依赖图如下...(22K)",
    ],
    historyAfter: [
      "[user] 帮我重构认证模块",
      "[user] 继续分析依赖关系",
      "[user] 压缩摘要(SUMMARY_PREFIX):\n  已完成：读取 auth.rs，分析依赖图\n  待完成：重写核心函数",
    ],
    summarySnippet: "已完成：读取 auth.rs，分析依赖图\n待完成：重写核心函数",
  },
  {
    phase: "轮中压缩 MidTurn",
    injection: "BeforeLastUserMessage",
    trigger: "turn.rs:492 — token_limit_reached && needs_follow_up\nrun_auto_compact(InitialContextInjection::BeforeLastUserMessage)\nCompactionPhase::MidTurn",
    tokensBefore: 195000,
    tokensAfter: 45000,
    historyBefore: [
      "[上轮压缩摘要] 32K",
      "[user] 继续重写 handler.rs",
      "[assistant] 开始重写...",
      "[tool: apply_patch] → diff 28K",
      "[tool: shell] cargo check → 12K 错误输出",
      "[tool: apply_patch] → 修复 diff 19K",
      "[user] 再跑一次测试",
    ],
    historyAfter: [
      "[user] 继续重写 handler.rs",
      "[初始 context 注入]  ← BeforeLastUserMessage",
      "[user] 再跑一次测试",
      "[user] 压缩摘要:\n  已完成：重写 handler.rs，修复编译错误\n  待完成：运行测试套件",
    ],
    summarySnippet: "已完成：重写 handler.rs，修复编译错误\n待完成：运行测试套件",
  },
  {
    phase: "手动压缩 Manual",
    injection: "DoNotInject",
    trigger: "用户执行 /compact 命令\nrun_compact_task() → CompactionTrigger::Manual\nCompactionPhase::StandaloneTurn",
    tokensBefore: 88000,
    tokensAfter: 18000,
    historyBefore: [
      "[user] 分析项目结构",
      "[assistant] 项目结构如下...",
      "[user] 重点看 src/core/",
      "[assistant] src/core 包含...",
      "[user] 帮我规划重构步骤",
    ],
    historyAfter: [
      "[user] 分析项目结构",
      "[user] 重点看 src/core/",
      "[user] 帮我规划重构步骤",
      "[user] 压缩摘要:\n  分析了项目结构和 src/core 模块\n  规划了重构步骤",
    ],
    summarySnippet: "分析了项目结构和 src/core 模块\n规划了重构步骤",
  },
];

const STEP_INFO = [
  { title: "上下文压缩引擎 compact.rs", desc: "compact.rs 有三个触发入口，全部汇聚到 run_compact_task_inner_impl()：调用模型生成摘要 → collect_user_messages() 收集最多 20K tokens 用户消息 → build_compacted_history() 重建历史 → sess.replace_compacted_history() 原子替换。" },
  { title: "触发点1：预压缩 PreTurn", desc: "turn.rs:147 — run_pre_sampling_compact()。每个 turn 开始前检查：若 total_tokens ≥ auto_compact_limit，执行压缩。InitialContextInjection::DoNotInject，压缩后 reference_context_item = None，下一轮 turn 会完整重注入初始 context。" },
  { title: "触发点2：轮中压缩 MidTurn", desc: "turn.rs:492 — token_limit_reached && needs_follow_up。SSE 流处理完成后检测，只在有工具调用待回传时触发。InitialContextInjection::BeforeLastUserMessage，将初始 context 插入最后一条真实用户消息之前。" },
  { title: "触发点3：手动压缩 Manual", desc: "用户执行 /compact 命令，调用 run_compact_task()，CompactionTrigger::Manual + CompactionPhase::StandaloneTurn。会先发送 TurnStarted 事件，结束后发 Warning 提示多次压缩会降低准确性。" },
];

const PHASE_COLOR: Record<CompactionPhase, { border: string; bg: string; text: string }> = {
  "预压缩 PreTurn":   { border: "border-blue-700",   bg: "bg-blue-950/30",   text: "text-blue-300"   },
  "轮中压缩 MidTurn": { border: "border-amber-700",  bg: "bg-amber-950/30",  text: "text-amber-300"  },
  "手动压缩 Manual":  { border: "border-purple-700", bg: "bg-purple-950/30", text: "text-purple-300" },
};

const INJECTION_COLOR: Record<InjectionMode, string> = {
  "DoNotInject":           "text-zinc-400",
  "BeforeLastUserMessage": "text-cyan-400",
};

function TokenBar({ before, after, limit = 200000 }: { before: number; after: number; limit?: number }) {
  const pctBefore = Math.min((before / limit) * 100, 100);
  const pctAfter  = Math.min((after  / limit) * 100, 100);
  const fmt = (n: number) => `${Math.round(n / 1000)}K`;
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm text-zinc-500 font-mono">
        <span>压缩前 {fmt(before)} tokens</span>
        <span>上限 {fmt(limit)}</span>
      </div>
      <div className="relative h-7 w-full overflow-hidden rounded bg-zinc-800">
        <motion.div className="absolute inset-y-0 left-0 bg-red-600/70"
          initial={{ width: 0 }} animate={{ width: `${pctBefore}%` }} transition={{ duration: 0.6 }} />
      </div>
      <div className="flex justify-between text-sm text-zinc-500 font-mono">
        <span>压缩后 {fmt(after)} tokens</span>
        <span className="text-emerald-400">节省 {fmt(before - after)}（{Math.round((1 - after / before) * 100)}%）</span>
      </div>
      <div className="relative h-7 w-full overflow-hidden rounded bg-zinc-800">
        <motion.div className="absolute inset-y-0 left-0 bg-emerald-600/70"
          initial={{ width: `${pctBefore}%` }} animate={{ width: `${pctAfter}%` }} transition={{ duration: 0.8, delay: 0.3 }} />
      </div>
    </div>
  );
}

function HistoryDiff({ before, after, injection }: { before: string[]; after: string[]; injection: InjectionMode }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <div className="mb-2 text-sm font-mono text-zinc-500">压缩前历史</div>
        <div className="space-y-1.5">
          {before.map((item, i) => (
            <div key={i} className="rounded border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 font-mono text-sm text-zinc-400 whitespace-pre-wrap leading-snug">
              {item}
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 text-sm font-mono text-zinc-500">压缩后历史</div>
        <div className="space-y-1.5">
          {after.map((item, i) => {
            const isSummary = item.includes("压缩摘要");
            const isInject  = item.includes("初始 context");
            return (
              <div key={i} className={`rounded border px-2.5 py-1.5 font-mono text-sm whitespace-pre-wrap leading-snug ${
                isSummary ? "border-emerald-800 bg-emerald-950/40 text-emerald-300" :
                isInject  ? "border-cyan-800 bg-cyan-950/40 text-cyan-300" :
                            "border-zinc-800 bg-zinc-950 text-zinc-400"
              }`}>
                {item}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function ContextCompactVisualization() {
  const viz = useSteppedVisualization({ totalSteps: 4, autoPlayInterval: 4000 });
  const step = STEP_INFO[viz.currentStep];
  const compactionIdx = viz.currentStep - 1;
  const current = compactionIdx >= 0 ? STEPS[compactionIdx] : null;

  return (
    <section className="space-y-4">

      {/* SVG 架构图 */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
        <div className="mb-2 flex items-center gap-2 font-mono text-xs text-zinc-500">
          <span className="text-emerald-400">core/src/</span>compact.rs
          <span className="mx-1 text-zinc-700">·</span>
          <span className="text-zinc-500">core/src/codex/turn.rs</span>
        </div>

        <svg viewBox="0 0 1280 380" className="w-full rounded-md border border-zinc-800 bg-zinc-950">
          <defs>
            <marker id="mc7"  markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto"><polygon points="0 0,10 4,0 8" fill="#52525b"/></marker>
            <marker id="mc7g" markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto"><polygon points="0 0,10 4,0 8" fill="#10b981"/></marker>
            <marker id="mc7b" markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto"><polygon points="0 0,10 4,0 8" fill="#3b82f6"/></marker>
            <marker id="mc7a" markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto"><polygon points="0 0,10 4,0 8" fill="#f59e0b"/></marker>
            <marker id="mc7p" markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto"><polygon points="0 0,10 4,0 8" fill="#a78bfa"/></marker>
          </defs>

          {/* 外框 */}
          <rect x="8" y="12" width="1264" height="356" rx="12" fill="none" stroke="#10b98140" strokeWidth={1.8} strokeDasharray="8 5"/>
          <rect x="12" y="4" width="296" height="22" fill="#09090b"/>
          <text x="16" y="20" fontSize={16} fontFamily="monospace" fill="#34d399">上下文压缩引擎 compact.rs</text>

          {/* 触发点1: 预压缩 */}
          <rect x="28" y="48" width="222" height="72" rx="8" fill="#0c1a30" stroke="#3b82f6" strokeWidth={1.8}/>
          <text x="139" y="74" textAnchor="middle" fontSize={17} fontWeight={700} fontFamily="monospace" fill="#60a5fa">预压缩</text>
          <text x="139" y="96" textAnchor="middle" fontSize={14} fontFamily="monospace" fill="#93c5fd">turn 开始前检查</text>
          <text x="139" y="114" textAnchor="middle" fontSize={12} fontFamily="monospace" fill="#3b82f680">PreTurn</text>

          {/* 触发点2: 轮中压缩 */}
          <rect x="28" y="162" width="222" height="72" rx="8" fill="#1a1500" stroke="#f59e0b" strokeWidth={1.8}/>
          <text x="139" y="188" textAnchor="middle" fontSize={17} fontWeight={700} fontFamily="monospace" fill="#fcd34d">轮中压缩</text>
          <text x="139" y="210" textAnchor="middle" fontSize={14} fontFamily="monospace" fill="#fde68a">Token超限且有工具回传</text>
          <text x="139" y="228" textAnchor="middle" fontSize={12} fontFamily="monospace" fill="#f59e0b80">MidTurn</text>

          {/* 触发点3: 手动压缩 */}
          <rect x="28" y="276" width="222" height="72" rx="8" fill="#1a0a2e" stroke="#a78bfa" strokeWidth={1.8}/>
          <text x="139" y="302" textAnchor="middle" fontSize={17} fontWeight={700} fontFamily="monospace" fill="#c4b5fd">手动压缩</text>
          <text x="139" y="322" textAnchor="middle" fontSize={14} fontFamily="monospace" fill="#ddd6fe">用户执行 /compact</text>
          <text x="139" y="340" textAnchor="middle" fontSize={12} fontFamily="monospace" fill="#a78bfa80">Manual</text>

          {/* 核心函数 */}
          <rect x="336" y="134" width="272" height="112" rx="10" fill="#0f1f0f" stroke="#10b981" strokeWidth={2}/>
          <text x="472" y="164" textAnchor="middle" fontSize={16} fontWeight={700} fontFamily="monospace" fill="#34d399">run_compact_task</text>
          <text x="472" y="184" textAnchor="middle" fontSize={16} fontWeight={700} fontFamily="monospace" fill="#34d399">_inner_impl()</text>
          <text x="472" y="208" textAnchor="middle" fontSize={14} fontFamily="monospace" fill="#6ee7b7">compact.rs:157</text>
          <text x="472" y="232" textAnchor="middle" fontSize={12} fontFamily="monospace" fill="#4ade8070">所有路径的最终入口</text>

          {/* 执行步骤 */}
          <rect x="696" y="36" width="230" height="60" rx="8" fill="#0c1810" stroke="#10b981" strokeWidth={1.5}/>
          <text x="811" y="62" textAnchor="middle" fontSize={16} fontWeight={700} fontFamily="monospace" fill="#6ee7b7">① 调模型生成摘要</text>
          <text x="811" y="83" textAnchor="middle" fontSize={13} fontFamily="monospace" fill="#4ade80a0">drain_to_completed()</text>

          <rect x="696" y="122" width="230" height="60" rx="8" fill="#0c1810" stroke="#10b981" strokeWidth={1.5}/>
          <text x="811" y="148" textAnchor="middle" fontSize={16} fontWeight={700} fontFamily="monospace" fill="#6ee7b7">② 收集用户消息</text>
          <text x="811" y="169" textAnchor="middle" fontSize={13} fontFamily="monospace" fill="#4ade80a0">最多 20K tokens</text>

          <rect x="696" y="208" width="230" height="60" rx="8" fill="#0c1810" stroke="#10b981" strokeWidth={1.5}/>
          <text x="811" y="234" textAnchor="middle" fontSize={16} fontWeight={700} fontFamily="monospace" fill="#6ee7b7">③ 重建压缩历史</text>
          <text x="811" y="255" textAnchor="middle" fontSize={13} fontFamily="monospace" fill="#4ade80a0">build_compacted_history()</text>

          <rect x="696" y="294" width="230" height="60" rx="8" fill="#0c1810" stroke="#10b981" strokeWidth={1.5}/>
          <text x="811" y="320" textAnchor="middle" fontSize={16} fontWeight={700} fontFamily="monospace" fill="#6ee7b7">④ 原子替换历史</text>
          <text x="811" y="341" textAnchor="middle" fontSize={13} fontFamily="monospace" fill="#4ade80a0">replace_compacted_history()</text>

          {/* InitialContextInjection 注解 */}
          <rect x="984" y="154" width="272" height="112" rx="8" fill="#051818" stroke="#06b6d4" strokeWidth={1.5} strokeDasharray="4 3"/>
          <text x="1120" y="182" textAnchor="middle" fontSize={15} fontFamily="monospace" fill="#67e8f9">InitialContextInjection</text>
          <text x="1120" y="206" textAnchor="middle" fontSize={14} fontFamily="monospace" fill="#06b6d4b0">DoNotInject</text>
          <text x="1120" y="224" textAnchor="middle" fontSize={12} fontFamily="monospace" fill="#06b6d470">PreTurn / Manual 使用</text>
          <text x="1120" y="248" textAnchor="middle" fontSize={14} fontFamily="monospace" fill="#22d3ee">BeforeLastUserMessage</text>
          <text x="1120" y="266" textAnchor="middle" fontSize={12} fontFamily="monospace" fill="#06b6d470">MidTurn 专用</text>

          {/* 连线：触发点 → 核心函数 */}
          <line x1="250" y1="84"  x2="336" y2="176" stroke="#3b82f6" strokeWidth={1.5} markerEnd="url(#mc7b)"/>
          <line x1="250" y1="198" x2="336" y2="198" stroke="#f59e0b" strokeWidth={1.5} markerEnd="url(#mc7a)"/>
          <line x1="250" y1="312" x2="336" y2="220" stroke="#a78bfa" strokeWidth={1.5} markerEnd="url(#mc7p)"/>

          {/* 连线：核心函数 → 步骤 */}
          <line x1="608" y1="166" x2="696" y2="66"  stroke="#10b981" strokeWidth={1.5} markerEnd="url(#mc7g)"/>
          <line x1="608" y1="182" x2="696" y2="152" stroke="#10b981" strokeWidth={1.5} markerEnd="url(#mc7g)"/>
          <line x1="608" y1="202" x2="696" y2="238" stroke="#10b981" strokeWidth={1.5} markerEnd="url(#mc7g)"/>
          <line x1="608" y1="218" x2="696" y2="324" stroke="#10b981" strokeWidth={1.5} markerEnd="url(#mc7g)"/>

          {/* 连线：步骤③ → 注解 */}
          <line x1="926" y1="238" x2="984" y2="210" stroke="#06b6d4" strokeWidth={1.2} strokeDasharray="4 3" markerEnd="url(#mc7)"/>
        </svg>
      </div>

      {/* 场景详情 */}
      <AnimatePresence mode="wait">
        {current ? (
          <motion.div key={viz.currentStep}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="space-y-4">

            {/* 触发信息条 */}
            <div className={`rounded-lg border p-4 ${PHASE_COLOR[current.phase].border} ${PHASE_COLOR[current.phase].bg}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`font-mono text-base font-bold ${PHASE_COLOR[current.phase].text}`}>
                  {current.phase}
                </span>
                <span className={`font-mono text-sm ${INJECTION_COLOR[current.injection]}`}>
                  InitialContextInjection::{current.injection}
                </span>
              </div>
              <div className="font-mono text-sm text-zinc-300 whitespace-pre-wrap">{current.trigger}</div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* 左：Token 变化 */}
              <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
                <div className="mb-3 font-mono text-sm text-zinc-500">Token 使用变化</div>
                <TokenBar before={current.tokensBefore} after={current.tokensAfter} />
                <div className="mt-4 space-y-1">
                  <div className="text-sm text-zinc-500 font-mono mb-1">压缩摘要（SUMMARY_PREFIX + 模型输出）</div>
                  <div className="rounded border border-emerald-800 bg-emerald-950/30 p-3 font-mono text-sm text-emerald-300 whitespace-pre-wrap">
                    {current.summarySnippet}
                  </div>
                  <div className="text-xs text-zinc-600 font-mono pt-1">collect_user_messages() 保留最多 20K tokens 的用户消息历史</div>
                </div>
              </div>

              {/* 右：历史对比 */}
              <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
                <div className="mb-3 font-mono text-sm text-zinc-500">历史记录变化</div>
                <HistoryDiff before={current.historyBefore} after={current.historyAfter} injection={current.injection} />
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-lg border border-zinc-700 bg-zinc-900 p-5 space-y-3">
            <p className="text-base text-zinc-300">compact.rs 有三个触发入口，全部汇聚到同一个核心函数：</p>
            <div className="space-y-2 font-mono text-sm">
              <div className="flex gap-3"><span className="text-blue-400 shrink-0">① 预压缩</span><span className="text-zinc-400">turn 开始前 — total_tokens ≥ auto_compact_limit → PreTurn</span></div>
              <div className="flex gap-3"><span className="text-amber-400 shrink-0">② 轮中压缩</span><span className="text-zinc-400">SSE 流结束后 — token_limit_reached &amp;&amp; needs_follow_up → MidTurn</span></div>
              <div className="flex gap-3"><span className="text-purple-400 shrink-0">③ 手动压缩</span><span className="text-zinc-400">用户 /compact — CompactionTrigger::Manual → StandaloneTurn</span></div>
            </div>
            <p className="text-sm text-zinc-500">核心流程：调模型生成摘要 → 收集用户消息（≤20K tokens）→ 重建历史 → 原子替换</p>
          </motion.div>
        )}
      </AnimatePresence>

      <StepControls
        currentStep={viz.currentStep} totalSteps={viz.totalSteps}
        onPrev={viz.prev} onNext={viz.next} onReset={viz.reset}
        isPlaying={viz.isPlaying} onToggleAutoPlay={viz.toggleAutoPlay}
        stepTitle={step.title} stepDescription={step.desc}
      />
    </section>
  );
}
