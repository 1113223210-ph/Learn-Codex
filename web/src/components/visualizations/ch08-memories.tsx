"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useSteppedVisualization } from "@/hooks/useSteppedVisualization";
import { StepControls } from "@/components/visualizations/shared/step-controls";

// ─── memories 两阶段管道（codex-rs 实际实现）────────────────────────────────────
//
// 数据来源：
//   state/src/model/memories.rs       — Stage1Output, Phase2InputSelection 结构体
//   state/src/runtime/memories.rs     — job claiming / SQLite 持久化逻辑
//   core/tests/suite/memories.rs      — Phase2 prompt 格式，输出文件路径
//   core/src/codex/session.rs:836     — memories::start_memories_startup_task() 调用点
//
// 核心常量（state/src/runtime/memories.rs）：
//   JOB_KIND_MEMORY_STAGE1          = "memory_stage1"
//   JOB_KIND_MEMORY_CONSOLIDATE_GLOBAL = "memory_consolidate_global"
//   DEFAULT_RETRY_REMAINING         = 3
//
// 内存模式（threads 表）：
//   "enabled"   — 正常参与 Stage1/Phase2
//   "polluted"  — 发生 web_search → 排除出 Phase2，需重新整合

type PipelinePhase =
  | "session_start"
  | "stage1_claim"
  | "stage1_extract"
  | "phase2_claim"
  | "phase2_consolidate"
  | "injection";

interface PipelineStep {
  phase: PipelinePhase;
  title: string;
  codeSnippet: string;
  outcome: string;
  files?: string[];
}

const PIPELINE_STEPS: PipelineStep[] = [
  {
    phase: "session_start",
    title: "Session 启动 → start_memories_startup_task()",
    codeSnippet:
      "// session.rs:836\nmemories::start_memories_startup_task(\n  &sess,\n  Arc::clone(&config),\n  &session_configuration.session_source,\n);\n\n// 后台任务参数 (config.memories):\n//   max_raw_memories_for_consolidation: 50\n//   max_age_days: 30\n//   min_rollout_idle_hours: 1",
    outcome:
      "新会话启动时，后台任务扫描 SQLite `threads` 表中 memory_mode='enabled' 且已闲置 ≥1h 的历史线程，发起 Stage1 job claiming",
  },
  {
    phase: "stage1_claim",
    title: "Stage1：争抢 job — try_claim_stage1_job()",
    codeSnippet:
      "// state/src/runtime/memories.rs\n// JOB_KIND_MEMORY_STAGE1 = \"memory_stage1\"\n// DEFAULT_RETRY_REMAINING = 3\n\nmatch try_claim_stage1_job(\n  thread_id,  // 目标线程\n  worker_id,  // 当前会话（作为 worker）\n  source_updated_at,  // = thread.updated_at.timestamp()\n  lease_seconds,\n  max_running_jobs,\n).await? {\n  Stage1JobClaimOutcome::Claimed { ownership_token } => { /* 执行提取 */ }\n  Stage1JobClaimOutcome::SkippedUpToDate => { /* 已是最新，跳过 */ }\n  Stage1JobClaimOutcome::SkippedRunning  => { /* 另一 worker 正在处理 */ }\n  Stage1JobClaimOutcome::SkippedRetryExhausted => { /* 重试耗尽 */ }\n}",
    outcome:
      "分布式 job claiming：多个并发会话安全争抢同一线程的 Stage1 job。只有持 ownership_token 的 worker 可标记成功",
  },
  {
    phase: "stage1_extract",
    title: "Stage1：提取记忆 → mark_stage1_job_succeeded()",
    codeSnippet:
      "// 提取后写入 SQLite stage1_outputs 表\nmark_stage1_job_succeeded(\n  thread_id,\n  &ownership_token,\n  source_updated_at,\n  raw_memory: &str,       // 模型从 rollout 提取的原始记忆\n  rollout_summary: &str,  // rollout 摘要\n  rollout_slug: Some(\"rollout-abc\"),\n).await?;\n\n// Stage1Output 结构:\n// Stage1Output {\n//   thread_id, rollout_path,\n//   source_updated_at,  raw_memory,\n//   rollout_summary,    rollout_slug,\n//   cwd,  git_branch,   generated_at,\n// }",
    outcome:
      "成功后自动调用 enqueue_global_consolidation()，将 Phase2 job 设为 pending。失败时 retry_remaining -= 1，最多 3 次",
  },
  {
    phase: "phase2_claim",
    title: "Phase2：争抢全局整合 job",
    codeSnippet:
      "// JOB_KIND_MEMORY_CONSOLIDATE_GLOBAL = \"memory_consolidate_global\"\n// MEMORY_CONSOLIDATION_JOB_KEY = \"global\"  (单例)\n\nmatch try_claim_global_phase2_job(\n  worker_id,\n  lease_seconds,\n).await? {\n  Phase2JobClaimOutcome::Claimed {\n    ownership_token,\n    input_watermark, // 此次需整合到的时间戳\n  } => { /* 执行全局整合 */ }\n  Phase2JobClaimOutcome::SkippedNotDirty => { /* 无新 Stage1 输出 */ }\n  Phase2JobClaimOutcome::SkippedRunning  => { /* 另一 worker 正在整合 */ }\n}",
    outcome:
      "全局 Phase2 job 为单例（job_key='global'）。input_watermark > last_success_watermark 时才触发，避免重复整合",
  },
  {
    phase: "phase2_consolidate",
    title: "Phase2：整合 → 写入文件系统",
    codeSnippet:
      "// Phase2 prompt 格式（来自 core/tests/suite/memories.rs）：\n// \"Current selected Phase 1 inputs:\"\n// \"- selected inputs this run: 2\"\n// \"- newly added since the last successful Phase 2 run: 1\"\n// \"- removed from the last successful Phase 2 run: 0\"\n// \"- [added] thread_id=<uuid>, git_branch=main, cwd=/workspace\"\n//\n// 输出文件（~/.codex/memories/）：\n//   raw_memories.md          ← 合并所有 raw_memory\n//   rollout_summaries/*.md   ← 每个线程一个 rollout_summary 文件\n\n// 写完后标记成功：\nmark_global_phase2_job_succeeded(\n  &ownership_token,\n  completed_watermark,\n  &selected_outputs,  // 标记 selected_for_phase2=1\n).await?;",
    outcome:
      "Phase2 整合输出写入 ~/.codex/memories/ 目录。模型在 Phase2 prompt 中能区分「新增」vs「移除」的 Stage1 输入，实现增量整合",
    files: [
      "~/.codex/memories/raw_memories.md",
      "~/.codex/memories/rollout_summaries/<thread_id>-<slug>.md",
    ],
  },
  {
    phase: "injection",
    title: "会话注入 + 记忆污染检测",
    codeSnippet:
      "// 新会话启动时读取 ~/.codex/memories/ 注入 context\n// (Feature::MemoryTool + Feature::Sqlite 必须启用)\n\n// 记忆污染：当线程执行了 web_search，该线程被标记为 polluted\n// state/src/runtime/memories.rs — mark_thread_memory_mode_polluted()\npub async fn mark_thread_memory_mode_polluted(\n  &self,\n  thread_id: ThreadId,\n) -> anyhow::Result<bool> {\n  // UPDATE threads SET memory_mode = 'polluted'\n  // WHERE id = ? AND memory_mode != 'polluted'\n  //\n  // 若该线程曾入选 Phase2 baseline → 触发 enqueue_global_consolidation()\n  // 下次 Phase2 运行时，polluted 线程从 selected 移入 removed\n}",
    outcome:
      "web_search 污染会实时更新 memory_mode='polluted'，并触发 Phase2 re-consolidation。新会话启动时注入的记忆不包含 polluted 线程的内容",
  },
];

const STEP_INFO = [
  {
    title: "记忆系统概览",
    desc: "Codex memories 是两阶段管道：Stage1（per-thread 提取）→ Phase2（全局整合）→ 注入新会话。所有状态存储在 ~/.codex/state.db SQLite 数据库，Feature::Sqlite + Feature::MemoryTool 必须启用。",
  },
  {
    title: "Session 启动 → 触发后台任务",
    desc: "session.rs:836 — memories::start_memories_startup_task() 在会话初始化后启动。扫描 threads 表找到 memory_mode='enabled' 且 updated_at 在时间窗口内的历史线程。",
  },
  {
    title: "Stage1 job claiming — 分布式安全争抢",
    desc: "state/src/runtime/memories.rs — try_claim_stage1_job() 通过 SQLite 事务实现分布式 job claiming。同一线程最多 DEFAULT_RETRY_REMAINING=3 次重试，lease 机制防止 worker 崩溃后 job 卡死。",
  },
  {
    title: "Stage1 提取 — raw_memory + rollout_summary",
    desc: "Stage1Output 包含 raw_memory（模型从 rollout 提取的原始记忆）和 rollout_summary（rollout 摘要）。成功后自动 enqueue_global_consolidation() 触发 Phase2。",
  },
  {
    title: "Phase2 claim — 全局单例 job",
    desc: "Phase2 job 是全局单例（job_key='global'）。input_watermark 追踪最新 Stage1 输出时间戳。只有 watermark 超过 last_success_watermark 时才执行整合，避免无谓 LLM 调用。",
  },
  {
    title: "Phase2 整合 — 写入 ~/.codex/memories/",
    desc: "Phase2 prompt 包含「新增」和「移除」的 Stage1 输入 diff。模型输出写入 raw_memories.md 和 rollout_summaries/*.md。mark_global_phase2_job_succeeded() 标记 selected_for_phase2=1 用于下次 diff。",
  },
  {
    title: "注入 + 污染检测",
    desc: "新会话启动时从 ~/.codex/memories/ 读取整合记忆注入 context（AgentMessageEvent.memory_citation 引用来源）。web_search 触发 mark_thread_memory_mode_polluted()，polluted 线程下次 Phase2 时从 selected 移入 removed。",
  },
];

const PHASE_COLOR: Record<
  PipelinePhase,
  { border: string; bg: string; text: string; dot: string }
> = {
  session_start: {
    border: "border-sky-700",
    bg: "bg-sky-950/30",
    text: "text-sky-300",
    dot: "#0ea5e9",
  },
  stage1_claim: {
    border: "border-amber-700",
    bg: "bg-amber-950/30",
    text: "text-amber-300",
    dot: "#f59e0b",
  },
  stage1_extract: {
    border: "border-orange-700",
    bg: "bg-orange-950/30",
    text: "text-orange-300",
    dot: "#f97316",
  },
  phase2_claim: {
    border: "border-violet-700",
    bg: "bg-violet-950/30",
    text: "text-violet-300",
    dot: "#8b5cf6",
  },
  phase2_consolidate: {
    border: "border-emerald-700",
    bg: "bg-emerald-950/30",
    text: "text-emerald-300",
    dot: "#10b981",
  },
  injection: {
    border: "border-rose-700",
    bg: "bg-rose-950/30",
    text: "text-rose-300",
    dot: "#f43f5e",
  },
};

const PHASE_LABEL: Record<PipelinePhase, string> = {
  session_start: "Session 启动",
  stage1_claim: "Stage1 争抢",
  stage1_extract: "Stage1 提取",
  phase2_claim: "Phase2 争抢",
  phase2_consolidate: "Phase2 整合",
  injection: "注入 + 污染",
};

export default function MemoriesVisualization() {
  const viz = useSteppedVisualization({
    totalSteps: PIPELINE_STEPS.length + 1,
    autoPlayInterval: 4500,
  });
  const step = STEP_INFO[viz.currentStep];
  const pipelineIdx = viz.currentStep - 1;
  const current = pipelineIdx >= 0 ? PIPELINE_STEPS[pipelineIdx] : null;

  return (
    <section className="space-y-4">
      {/* SVG 架构图 */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
        <div className="mb-2 flex items-center gap-2 font-mono text-xs text-zinc-500">
          <span className="text-emerald-400">state/src/runtime/</span>memories.rs
          <span className="mx-1 text-zinc-700">·</span>
          <span className="text-zinc-500">core/src/codex/session.rs:836</span>
        </div>

        <svg
          viewBox="0 0 1280 340"
          className="w-full rounded-md border border-zinc-800 bg-zinc-950"
        >
          <defs>
            <marker
              id="m8"
              markerWidth="10"
              markerHeight="8"
              refX="10"
              refY="4"
              orient="auto"
            >
              <polygon points="0 0,10 4,0 8" fill="#52525b" />
            </marker>
            <marker
              id="m8g"
              markerWidth="10"
              markerHeight="8"
              refX="10"
              refY="4"
              orient="auto"
            >
              <polygon points="0 0,10 4,0 8" fill="#10b981" />
            </marker>
            <marker
              id="m8b"
              markerWidth="10"
              markerHeight="8"
              refX="10"
              refY="4"
              orient="auto"
            >
              <polygon points="0 0,10 4,0 8" fill="#0ea5e9" />
            </marker>
            <marker
              id="m8v"
              markerWidth="10"
              markerHeight="8"
              refX="10"
              refY="4"
              orient="auto"
            >
              <polygon points="0 0,10 4,0 8" fill="#8b5cf6" />
            </marker>
            <marker
              id="m8r"
              markerWidth="10"
              markerHeight="8"
              refX="10"
              refY="4"
              orient="auto"
            >
              <polygon points="0 0,10 4,0 8" fill="#f43f5e" />
            </marker>
          </defs>

          {/* 外框 */}
          <rect
            x="8"
            y="10"
            width="1264"
            height="322"
            rx="12"
            fill="none"
            stroke="#10b98140"
            strokeWidth={1.8}
            strokeDasharray="8 5"
          />
          <rect x="12" y="2" width="270" height="22" fill="#09090b" />
          <text
            x="16"
            y="18"
            fontSize={16}
            fontFamily="monospace"
            fill="#34d399"
          >
            Codex Memories 两阶段管道
          </text>

          {/* ── 上行：Stage1 路径 ── */}

          {/* 1. Session 启动 */}
          <rect
            x="28"
            y="36"
            width="200"
            height="68"
            rx="8"
            fill="#03131f"
            stroke="#0ea5e9"
            strokeWidth={1.8}
          />
          <text
            x="128"
            y="61"
            textAnchor="middle"
            fontSize={15}
            fontWeight={700}
            fontFamily="monospace"
            fill="#38bdf8"
          >
            新会话启动
          </text>
          <text
            x="128"
            y="81"
            textAnchor="middle"
            fontSize={13}
            fontFamily="monospace"
            fill="#7dd3fc"
          >
            session.rs:836
          </text>
          <text
            x="128"
            y="97"
            textAnchor="middle"
            fontSize={12}
            fontFamily="monospace"
            fill="#0ea5e980"
          >
            start_memories_startup_task
          </text>

          {/* 2. SQLite threads 表 */}
          <rect
            x="284"
            y="36"
            width="200"
            height="68"
            rx="8"
            fill="#141008"
            stroke="#f59e0b"
            strokeWidth={1.8}
          />
          <text
            x="384"
            y="61"
            textAnchor="middle"
            fontSize={15}
            fontWeight={700}
            fontFamily="monospace"
            fill="#fbbf24"
          >
            threads 表扫描
          </text>
          <text
            x="384"
            y="81"
            textAnchor="middle"
            fontSize={13}
            fontFamily="monospace"
            fill="#fde68a"
          >
            memory_mode=&apos;enabled&apos;
          </text>
          <text
            x="384"
            y="97"
            textAnchor="middle"
            fontSize={12}
            fontFamily="monospace"
            fill="#f59e0b80"
          >
            updated_at 时间窗口内
          </text>

          {/* 3. Stage1 job claiming */}
          <rect
            x="540"
            y="36"
            width="216"
            height="68"
            rx="8"
            fill="#1a1008"
            stroke="#f97316"
            strokeWidth={1.8}
          />
          <text
            x="648"
            y="61"
            textAnchor="middle"
            fontSize={15}
            fontWeight={700}
            fontFamily="monospace"
            fill="#fb923c"
          >
            Stage1 争抢
          </text>
          <text
            x="648"
            y="81"
            textAnchor="middle"
            fontSize={13}
            fontFamily="monospace"
            fill="#fdba74"
          >
            try_claim_stage1_job()
          </text>
          <text
            x="648"
            y="97"
            textAnchor="middle"
            fontSize={12}
            fontFamily="monospace"
            fill="#f9731680"
          >
            SQLite 事务 + lease
          </text>

          {/* 4. Stage1 提取 */}
          <rect
            x="812"
            y="36"
            width="200"
            height="68"
            rx="8"
            fill="#0f1a0a"
            stroke="#22c55e"
            strokeWidth={1.8}
          />
          <text
            x="912"
            y="61"
            textAnchor="middle"
            fontSize={15}
            fontWeight={700}
            fontFamily="monospace"
            fill="#4ade80"
          >
            Stage1 提取
          </text>
          <text
            x="912"
            y="81"
            textAnchor="middle"
            fontSize={13}
            fontFamily="monospace"
            fill="#86efac"
          >
            raw_memory + rollout_summary
          </text>
          <text
            x="912"
            y="97"
            textAnchor="middle"
            fontSize={12}
            fontFamily="monospace"
            fill="#22c55e80"
          >
            stage1_outputs 表
          </text>

          {/* 5. enqueue Phase2 */}
          <rect
            x="1068"
            y="36"
            width="196"
            height="68"
            rx="8"
            fill="#100a1f"
            stroke="#8b5cf6"
            strokeWidth={1.8}
          />
          <text
            x="1166"
            y="56"
            textAnchor="middle"
            fontSize={14}
            fontWeight={700}
            fontFamily="monospace"
            fill="#a78bfa"
          >
            enqueue_global
          </text>
          <text
            x="1166"
            y="74"
            textAnchor="middle"
            fontSize={14}
            fontWeight={700}
            fontFamily="monospace"
            fill="#a78bfa"
          >
            _consolidation()
          </text>
          <text
            x="1166"
            y="97"
            textAnchor="middle"
            fontSize={12}
            fontFamily="monospace"
            fill="#8b5cf680"
          >
            Phase2 job → pending
          </text>

          {/* 箭头：上行 */}
          <line
            x1="228"
            y1="70"
            x2="284"
            y2="70"
            stroke="#0ea5e9"
            strokeWidth={1.5}
            markerEnd="url(#m8b)"
          />
          <line
            x1="484"
            y1="70"
            x2="540"
            y2="70"
            stroke="#f59e0b"
            strokeWidth={1.5}
            markerEnd="url(#m8)"
          />
          <line
            x1="756"
            y1="70"
            x2="812"
            y2="70"
            stroke="#f97316"
            strokeWidth={1.5}
            markerEnd="url(#m8)"
          />
          <line
            x1="1012"
            y1="70"
            x2="1068"
            y2="70"
            stroke="#22c55e"
            strokeWidth={1.5}
            markerEnd="url(#m8g)"
          />

          {/* ── 下行：Phase2 路径 ── */}

          {/* Phase2 claim */}
          <rect
            x="812"
            y="190"
            width="200"
            height="68"
            rx="8"
            fill="#120818"
            stroke="#8b5cf6"
            strokeWidth={1.8}
          />
          <text
            x="912"
            y="215"
            textAnchor="middle"
            fontSize={15}
            fontWeight={700}
            fontFamily="monospace"
            fill="#c4b5fd"
          >
            Phase2 争抢
          </text>
          <text
            x="912"
            y="235"
            textAnchor="middle"
            fontSize={13}
            fontFamily="monospace"
            fill="#ddd6fe"
          >
            try_claim_global
          </text>
          <text
            x="912"
            y="253"
            textAnchor="middle"
            fontSize={12}
            fontFamily="monospace"
            fill="#8b5cf680"
          >
            job_key=&apos;global&apos; 单例
          </text>

          {/* Phase2 consolidate */}
          <rect
            x="540"
            y="190"
            width="216"
            height="68"
            rx="8"
            fill="#0d1f0d"
            stroke="#10b981"
            strokeWidth={2}
          />
          <text
            x="648"
            y="215"
            textAnchor="middle"
            fontSize={15}
            fontWeight={700}
            fontFamily="monospace"
            fill="#34d399"
          >
            Phase2 整合
          </text>
          <text
            x="648"
            y="235"
            textAnchor="middle"
            fontSize={13}
            fontFamily="monospace"
            fill="#6ee7b7"
          >
            LLM 整合 + 写入文件
          </text>
          <text
            x="648"
            y="253"
            textAnchor="middle"
            fontSize={12}
            fontFamily="monospace"
            fill="#10b98180"
          >
            raw_memories.md
          </text>

          {/* Injection */}
          <rect
            x="284"
            y="190"
            width="200"
            height="68"
            rx="8"
            fill="#1f080c"
            stroke="#f43f5e"
            strokeWidth={1.8}
          />
          <text
            x="384"
            y="215"
            textAnchor="middle"
            fontSize={15}
            fontWeight={700}
            fontFamily="monospace"
            fill="#fb7185"
          >
            注入新会话
          </text>
          <text
            x="384"
            y="235"
            textAnchor="middle"
            fontSize={13}
            fontFamily="monospace"
            fill="#fda4af"
          >
            ~/.codex/memories/
          </text>
          <text
            x="384"
            y="253"
            textAnchor="middle"
            fontSize={12}
            fontFamily="monospace"
            fill="#f43f5e80"
          >
            memory_citation 引用
          </text>

          {/* Pollution 节点 */}
          <rect
            x="28"
            y="190"
            width="200"
            height="68"
            rx="8"
            fill="#1f0808"
            stroke="#ef4444"
            strokeWidth={1.5}
            strokeDasharray="5 3"
          />
          <text
            x="128"
            y="215"
            textAnchor="middle"
            fontSize={15}
            fontWeight={700}
            fontFamily="monospace"
            fill="#fca5a5"
          >
            污染检测
          </text>
          <text
            x="128"
            y="235"
            textAnchor="middle"
            fontSize={13}
            fontFamily="monospace"
            fill="#fca5a5"
          >
            web_search → polluted
          </text>
          <text
            x="128"
            y="253"
            textAnchor="middle"
            fontSize={12}
            fontFamily="monospace"
            fill="#ef444480"
          >
            触发 re-consolidation
          </text>

          {/* 箭头：enqueue → Phase2 claim（垂直） */}
          <line
            x1="1166"
            y1="104"
            x2="1166"
            y2="166"
            stroke="#8b5cf6"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
          <line
            x1="1166"
            y1="166"
            x2="912"
            y2="200"
            stroke="#8b5cf6"
            strokeWidth={1.5}
            markerEnd="url(#m8v)"
          />

          {/* Phase2 claim → Phase2 consolidate */}
          <line
            x1="812"
            y1="224"
            x2="756"
            y2="224"
            stroke="#8b5cf6"
            strokeWidth={1.5}
            markerEnd="url(#m8v)"
          />

          {/* Phase2 consolidate → Injection */}
          <line
            x1="540"
            y1="224"
            x2="484"
            y2="224"
            stroke="#10b981"
            strokeWidth={1.5}
            markerEnd="url(#m8g)"
          />

          {/* Injection → Pollution (下行) */}
          <line
            x1="284"
            y1="224"
            x2="228"
            y2="224"
            stroke="#f43f5e"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            markerEnd="url(#m8r)"
          />

          {/* Pollution → Phase2 consolidate（循环反馈，通过新 session 重新触发） */}
          <text
            x="648"
            y="290"
            textAnchor="middle"
            fontSize={12}
            fontFamily="monospace"
            fill="#52525b"
          >
            polluted → 下次 Phase2 时从 selected 移入 removed
          </text>

          {/* ── 中间标注 ── */}
          <text
            x="648"
            y="168"
            textAnchor="middle"
            fontSize={13}
            fontFamily="monospace"
            fill="#6ee7b780"
          >
            ↑ Stage1 成功后自动触发 Phase2
          </text>
          <text
            x="648"
            y="308"
            textAnchor="middle"
            fontSize={12}
            fontFamily="monospace"
            fill="#52525b"
          >
            Feature::Sqlite + Feature::MemoryTool 必须启用
          </text>
        </svg>
      </div>

      {/* 当前步骤详情 */}
      <AnimatePresence mode="wait">
        {current ? (
          <motion.div
            key={viz.currentStep}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* 标题条 */}
            <div
              className={`rounded-lg border p-4 ${PHASE_COLOR[current.phase].border} ${PHASE_COLOR[current.phase].bg}`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{
                    backgroundColor: PHASE_COLOR[current.phase].dot,
                  }}
                />
                <span
                  className={`font-mono text-base font-bold ${PHASE_COLOR[current.phase].text}`}
                >
                  {PHASE_LABEL[current.phase]}
                </span>
                <span className="text-sm text-zinc-500 font-mono ml-auto">
                  {current.title}
                </span>
              </div>
              <p className="text-sm text-zinc-300 mt-1">{current.outcome}</p>
              {current.files && (
                <div className="mt-3 space-y-1">
                  <div className="text-xs text-zinc-500 font-mono">
                    输出文件：
                  </div>
                  {current.files.map((f) => (
                    <div
                      key={f}
                      className="font-mono text-xs text-emerald-400 pl-2"
                    >
                      {f}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 代码片段 */}
            <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
              <div className="mb-2 font-mono text-xs text-zinc-500">
                源码片段
              </div>
              <pre className="overflow-x-auto rounded border border-zinc-800 bg-zinc-950 p-4 font-mono text-sm text-zinc-300 whitespace-pre leading-relaxed">
                {current.codeSnippet}
              </pre>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="overview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-lg border border-zinc-700 bg-zinc-900 p-5 space-y-3"
          >
            <p className="text-base text-zinc-300">
              Codex memories 是一个两阶段持久化记忆系统，让 Agent
              在多次会话间积累知识：
            </p>
            <div className="space-y-2 font-mono text-sm">
              <div className="flex gap-3">
                <span className="text-sky-400 shrink-0">① Session 启动</span>
                <span className="text-zinc-400">
                  session.rs:836 — start_memories_startup_task() 扫描历史线程
                </span>
              </div>
              <div className="flex gap-3">
                <span className="text-amber-400 shrink-0">② Stage1 争抢</span>
                <span className="text-zinc-400">
                  SQLite 分布式 job claiming，lease 防止崩溃后 job 卡死
                </span>
              </div>
              <div className="flex gap-3">
                <span className="text-orange-400 shrink-0">③ Stage1 提取</span>
                <span className="text-zinc-400">
                  模型从 rollout 提取 raw_memory + rollout_summary →
                  stage1_outputs 表
                </span>
              </div>
              <div className="flex gap-3">
                <span className="text-violet-400 shrink-0">④ Phase2 争抢</span>
                <span className="text-zinc-400">
                  全局单例 job，input_watermark 追踪变更，避免重复整合
                </span>
              </div>
              <div className="flex gap-3">
                <span className="text-emerald-400 shrink-0">⑤ Phase2 整合</span>
                <span className="text-zinc-400">
                  LLM 增量整合 → ~/.codex/memories/raw_memories.md +
                  rollout_summaries/
                </span>
              </div>
              <div className="flex gap-3">
                <span className="text-rose-400 shrink-0">⑥ 注入 + 污染</span>
                <span className="text-zinc-400">
                  新会话读取 memories 注入 context；web_search 触发
                  memory_mode=&apos;polluted&apos;
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <StepControls
        currentStep={viz.currentStep}
        totalSteps={viz.totalSteps}
        onPrev={viz.prev}
        onNext={viz.next}
        onReset={viz.reset}
        isPlaying={viz.isPlaying}
        onToggleAutoPlay={viz.toggleAutoPlay}
        stepTitle={step.title}
        stepDescription={step.desc}
      />
    </section>
  );
}
