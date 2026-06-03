"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useSteppedVisualization } from "@/hooks/useSteppedVisualization";
import { StepControls } from "@/components/visualizations/shared/step-controls";

// ─── ch12 Plan 模式（基于 codex-rs 真实源码）─────────────────────────────────
//
// protocol/src/config_types.rs:390     — ModeKind::Plan enum
// collaboration-mode-templates/        — plan.md（128行）system prompt
// models-manager/src/collaboration_mode_presets.rs:35 — plan_preset()
// core/src/codex.rs:2373               — collaboration_mode 注入 context
// core/src/codex/turn.rs:1869          — PlanModeStreamState
// utils/stream-parser/src/proposed_plan.rs — <proposed_plan> 解析器
// core/src/tools/handlers/plan.rs:86   — update_plan 被拦截
// tui/src/chatwidget.rs:2448           — maybe_prompt_plan_implementation
//
// 两个模式：
//   ModeKind::Plan    — plan.md 128行，reasoning=Medium，request_user_input 允许
//   ModeKind::Default — default.md 11行，update_plan 工具正常
//
// 三阶段工作流：
//   Phase1 探索环境（非变更工具）→ Phase2 意图澄清（request_user_input）
//   → Phase3 规格确认 → <proposed_plan> 块 → 审批弹窗 → 切回 Default 执行

const STEP_INFO = [
  {
    title: "Plan 模式架构",
    desc: "Plan 模式是 Collaboration Mode 的一种，通过 /plan 命令触发。系统提示词从 default.md（11行）切换为 plan.md（128行），并注入 <collaboration_mode> 标签。模型在三阶段工作流中通过 request_user_input 工具澄清需求，最终输出 <proposed_plan> 块等待审批。",
  },
  {
    title: "模式切换：/plan → <collaboration_mode>",
    desc: "CLI 中输入 /plan 后调用 plan_mask() 获取 Plan 模式配置，切换 collaboration_mode。每次 turn 重新构建 context 时，build_collaboration_mode_update_item() 检测到模式变化，注入新的 developer instructions，包裹在 <collaboration_mode>...</collaboration_mode> 标签中。VS Code 等客户端通过 turn/start 请求的 collaboration_mode 字段触发。",
  },
  {
    title: "Phase 1 — 探索环境（非变更操作）",
    desc: "plan.md 规定：进入 Plan 模式后，先用非变更工具探索代码库（读文件、搜索、静态分析），消除未知量。不允许写/编辑文件、运行格式化器、应用 patch。模型通过工具调用收集事实，而非立即提问。",
  },
  {
    title: "Phase 2 — request_user_input 澄清意图",
    desc: "Plan 模式是唯一允许 request_user_input 工具的模式（allows_request_user_input() 返回 true）。模型用此工具提供 2-4 个互斥选项 + 推荐默认，询问影响规格的关键决策。update_plan 工具在 Plan 模式下被代码级拦截，返回错误。",
  },
  {
    title: "<proposed_plan> 流式解析",
    desc: "模型输出含 <proposed_plan> 块时，AssistantTextStreamParser（plan_mode=true）将内容分流：普通文本走 AgentMessageContentDelta 事件；<proposed_plan> 块内容走 PlanDelta 事件（app-server 协议方法 item/plan/delta，所有客户端均可接收）。strip_hidden_assistant_markup() 从 visible_text 中移除 plan 块，避免重复显示。",
  },
  {
    title: "审批 → 切回 Default 执行",
    desc: "所有客户端在收到 item/completed（type=plan）事件后均可呈现审批 UI。CLI 由 tui/src/chatwidget.rs:2448 实现，VS Code 等客户端自行实现。用户确认后切回 ModeKind::Default，发送「Implement the plan.」消息开始执行；拒绝则继续在 Plan 模式中精炼计划。",
  },
];

// ─── Step 1：模式对比 ─────────────────────────────────────────────────────────

const MODE_DIFF = [
  { dim: "System Prompt",          plan: "plan.md（128 行）",              dflt: "default.md（11 行）",           planC: "text-amber-300",  dfltC: "text-zinc-400" },
  { dim: "Reasoning Effort",       plan: "Medium（preset 强制）",          dflt: "None（模型自决）",              planC: "text-sky-300",    dfltC: "text-zinc-400" },
  { dim: "request_user_input",     plan: "✓ 允许",                        dflt: "✗ 默认不允许",                  planC: "text-emerald-400",dfltC: "text-red-400"  },
  { dim: "update_plan 工具",       plan: "✗ 代码级拦截（返回错误）",      dflt: "✓ 正常执行",                   planC: "text-red-400",    dfltC: "text-emerald-400"},
  { dim: "<proposed_plan> 解析",   plan: "✓ PlanDelta 事件，特殊渲染",    dflt: "视为普通文本",                  planC: "text-violet-300", dfltC: "text-zinc-400" },
  { dim: "文件写入 / 编辑",        plan: "✗ 系统提示词明确禁止",          dflt: "✓ 正常允许",                   planC: "text-red-400",    dfltC: "text-emerald-400"},
  { dim: "Agent message 发射",     plan: "延迟到 OutputItemDone",          dflt: "OutputItemAdded 立即发射",      planC: "text-zinc-300",   dfltC: "text-zinc-400" },
  { dim: "context 包装标签",       plan: "<collaboration_mode>plan.md</…>",    dflt: "<collaboration_mode>default.md</…>", planC: "text-zinc-300",   dfltC: "text-zinc-400" },
];

function ModeDiffViz() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-12 gap-1 px-3 font-mono text-xs text-zinc-600">
        <span className="col-span-4">维度</span>
        <span className="col-span-4 text-amber-500">Plan 模式</span>
        <span className="col-span-4">Default 模式</span>
      </div>
      {MODE_DIFF.map((row, i) => (
        <motion.div
          key={row.dim}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08 }}
          className="grid grid-cols-12 gap-1 items-center rounded border border-zinc-800 bg-zinc-950 px-3 py-2.5"
        >
          <span className="col-span-4 font-mono text-xs text-zinc-500">{row.dim}</span>
          <span className={`col-span-4 font-mono text-sm ${row.planC}`}>{row.plan}</span>
          <span className={`col-span-4 font-mono text-sm ${row.dfltC}`}>{row.dflt}</span>
        </motion.div>
      ))}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="rounded border border-zinc-800 bg-zinc-950 px-4 py-2 font-mono text-xs text-zinc-500"
      >
        protocol/src/config_types.rs:390 · models-manager/src/collaboration_mode_presets.rs:35
      </motion.div>
    </div>
  );
}

// ─── Step 2：模式切换注入 ──────────────────────────────────────────────────────

const SWITCH_STAGES = [
  { label: "/plan 命令", detail: "CLI: tui/src/chatwidget/slash_dispatch.rs:36 → plan_mask() → set_collaboration_mask()\nVS Code 等: turn/start 请求携带 collaboration_mode 字段（app-server-protocol/v2.rs:4265）", color: "text-sky-300", border: "border-sky-800", bg: "bg-sky-950/20" },
  { label: "context 重建", detail: "core/src/context_manager/updates.rs:62 → build_collaboration_mode_update_item()", color: "text-amber-300", border: "border-amber-800", bg: "bg-amber-950/20" },
  { label: "注入 developer message", detail: "core/src/codex.rs:2373 → developer_sections.push(collaboration_mode_instructions)", color: "text-violet-300", border: "border-violet-800", bg: "bg-violet-950/20" },
];

const COLLAB_MODE_MSG = `<collaboration_mode>
# Plan Mode (Conversational)

You work in 3 phases, and you should
*chat your way* to a great plan...

## Mode rules (strict)
You are in Plan Mode until a developer
message explicitly ends it.

## Execution vs. mutation in Plan Mode
- Allowed: 读文件、搜索、静态分析
- NOT allowed: 写/编辑文件、格式化器

## PHASE 1 — Ground in environment
## PHASE 2 — Intent chat
## PHASE 3 — Implementation chat

## Finalization rule
Wrap final plan in <proposed_plan>...
</collaboration_mode>`;

function ModeSwitchViz() {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {SWITCH_STAGES.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.2 }}
            className={`flex items-start gap-3 rounded border px-4 py-3 ${s.border} ${s.bg}`}
          >
            <span className={`font-mono text-sm font-bold shrink-0 w-32 ${s.color}`}>{s.label}</span>
            <span className="font-mono text-xs text-zinc-400">{s.detail}</span>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="rounded-lg border border-amber-800 bg-amber-950/20 p-4"
        >
          <div className="font-mono text-xs text-amber-400 mb-2">注入的 developer message（摘要）</div>
          <pre className="font-mono text-xs text-zinc-300 whitespace-pre leading-relaxed">
            {COLLAB_MODE_MSG}
          </pre>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="space-y-2"
        >
          <div className="font-mono text-xs text-zinc-500 mb-1">切换时机检测（updates.rs:62）</div>
          <div className="rounded border border-zinc-700 bg-zinc-900 p-3 font-mono text-xs text-zinc-300 space-y-1">
            <div className="text-zinc-500">{"if prev.collaboration_mode"}</div>
            <div className="text-zinc-500">{"   != next.collaboration_mode {"}</div>
            <div className="ml-4 text-amber-300">{"// 注入新 developer message"}</div>
            <div className="text-zinc-500">{"}"}</div>
          </div>
          <div className="rounded border border-zinc-700 bg-zinc-900 p-3 font-mono text-xs text-zinc-500 space-y-1">
            <div>切换到 Default 时，default.md 明确说明：</div>
            <div className="text-zinc-300 mt-1">"Any previous instructions for other modes (e.g. Plan mode) are no longer active."</div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Step 3：Phase1 探索（工具调用列表）──────────────────────────────────────

const EXPLORE_TOOLS = [
  { tool: "shell",     args: 'grep -r "AuthModule" src/',            ok: true,  note: "搜索代码库 ✓ 非变更" },
  { tool: "shell",     args: "cat src/auth/mod.rs",                  ok: true,  note: "读取文件 ✓ 非变更"   },
  { tool: "shell",     args: "cargo check --message-format json",    ok: true,  note: "静态分析 ✓ 非变更"   },
  { tool: "shell",     args: "sed -i 's/old/new/g' src/auth.rs",     ok: false, note: "⚠ 修改文件 — 被 plan.md 禁止" },
  { tool: "shell",     args: "cargo fmt",                            ok: false, note: "⚠ 格式化器 — 被 plan.md 禁止" },
];

function Phase1Viz() {
  return (
    <div className="space-y-3">
      <div className="rounded border border-zinc-700 bg-zinc-900 px-4 py-2.5 font-mono text-xs text-zinc-500">
        plan.md:41 — Phase 1: 先探索消除未知量，再提问。执行至少一次非变更探索后才能向用户提问。
      </div>

      <div className="space-y-2">
        {EXPLORE_TOOLS.map((t, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.15 }}
            className={`flex items-center gap-3 rounded border px-3 py-2.5 ${
              t.ok ? "border-zinc-800 bg-zinc-950" : "border-red-900 bg-red-950/20"
            }`}
          >
            <span className={`shrink-0 font-mono text-lg ${t.ok ? "text-emerald-400" : "text-red-500"}`}>
              {t.ok ? "✓" : "✗"}
            </span>
            <div className="flex-1 min-w-0">
              <span className="font-mono text-xs text-zinc-500">{t.tool}  </span>
              <span className={`font-mono text-sm ${t.ok ? "text-zinc-300" : "text-red-300 line-through"}`}>
                {t.args}
              </span>
            </div>
            <span className={`font-mono text-xs shrink-0 ${t.ok ? "text-zinc-500" : "text-red-400"}`}>
              {t.note}
            </span>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="grid grid-cols-2 gap-3 font-mono text-xs"
      >
        <div className="rounded border border-emerald-800 bg-emerald-950/20 px-4 py-3">
          <div className="text-emerald-400 font-bold mb-1">允许（非变更）</div>
          <div className="text-zinc-400">读文件、搜索、静态分析<br/>build/test（写入 target/ 等缓存）</div>
        </div>
        <div className="rounded border border-red-900 bg-red-950/20 px-4 py-3">
          <div className="text-red-400 font-bold mb-1">禁止（变更）</div>
          <div className="text-zinc-400">写/编辑文件、格式化器<br/>patch、codegen、副作用命令</div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Step 4：request_user_input 提问 ─────────────────────────────────────────

const RUI_QUESTION = {
  question: "认证模块重构的存储方案？",
  options: [
    { label: "JWT（无状态）", detail: "无需 DB 查询，水平扩展简单；token 撤销需要 blocklist", recommended: false },
    { label: "Session（Redis）", detail: "服务端控制，撤销即时生效；需要 Redis 依赖", recommended: true  },
    { label: "Opaque Token + DB", detail: "完全自控，无第三方依赖；每次请求 DB 查询", recommended: false },
  ],
};

function RequestUserInputViz() {
  return (
    <div className="space-y-3">
      <div className="rounded border border-violet-800 bg-violet-950/20 px-4 py-2.5 font-mono text-xs">
        <span className="text-violet-400">config_types.rs:428 — </span>
        <span className="text-zinc-300">ModeKind::Plan.allows_request_user_input() → </span>
        <span className="text-emerald-400">true</span>
        <span className="text-zinc-500 ml-4">plan.rs:86 — update_plan → </span>
        <span className="text-red-400">Err("not allowed in Plan mode")</span>
      </div>

      {/* request_user_input 工具调用 */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-amber-800 bg-amber-950/20 p-4"
      >
        <div className="font-mono text-xs text-amber-400 mb-2">
          模型调用 request_user_input 工具（plan.md:64 — 强烈推荐使用此工具提问）
        </div>
        <div className="font-mono text-sm text-zinc-300 mb-3">{RUI_QUESTION.question}</div>
        <div className="space-y-2">
          {RUI_QUESTION.options.map((opt, i) => (
            <motion.div
              key={opt.label}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.15 + 0.3 }}
              className={`flex items-start gap-3 rounded border px-3 py-2.5 ${
                opt.recommended
                  ? "border-emerald-700 bg-emerald-950/30"
                  : "border-zinc-700 bg-zinc-900"
              }`}
            >
              <span className={`font-mono text-sm font-bold shrink-0 w-28 ${opt.recommended ? "text-emerald-300" : "text-zinc-300"}`}>
                {opt.label}
                {opt.recommended && <span className="ml-1 text-xs text-emerald-500">推荐</span>}
              </span>
              <span className="font-mono text-xs text-zinc-400">{opt.detail}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="rounded border border-zinc-700 bg-zinc-900 px-4 py-2.5 font-mono text-xs text-zinc-500"
      >
        plan.md:68–73 — 每个问题必须满足：materially change spec / confirm assumption / choose meaningful tradeoff
      </motion.div>
    </div>
  );
}

// ─── Step 5：<proposed_plan> 流式处理 ────────────────────────────────────────

const STREAM_SEGMENTS = [
  { type: "normal",  text: "探索完成，以下是实现方案：",     event: "AgentMessageContentDelta", color: "text-zinc-300", border: "border-zinc-700", bg: "bg-zinc-900" },
  { type: "start",   text: "<proposed_plan>（开始标签）",    event: "ItemStarted(Plan)",         color: "text-violet-300", border: "border-violet-700", bg: "bg-violet-950/30" },
  { type: "delta",   text: "## 认证模块重构\n\n**Summary**...", event: "PlanDelta（特殊渲染）", color: "text-violet-200", border: "border-violet-700", bg: "bg-violet-950/30" },
  { type: "end",     text: "</proposed_plan>（结束标签）",   event: "ItemCompleted(Plan)",       color: "text-violet-300", border: "border-violet-700", bg: "bg-violet-950/30" },
  { type: "normal",  text: "（结尾文本已被 strip_hidden_assistant_markup 移除）", event: "visible_text 中不含 plan 内容", color: "text-zinc-600", border: "border-zinc-800", bg: "bg-zinc-950" },
];

function ProposedPlanViz() {
  return (
    <div className="space-y-3">
      <div className="rounded border border-zinc-700 bg-zinc-900 px-4 py-2.5 font-mono text-xs text-zinc-500">
        utils/stream-parser/src/proposed_plan.rs · turn.rs:1869 — AssistantTextStreamParser(plan_mode=true)
      </div>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {/* 左：分流示意 */}
        <div className="space-y-2">
          <div className="font-mono text-xs text-zinc-500 mb-1">流式输出分流处理</div>
          {STREAM_SEGMENTS.map((seg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.15 }}
              className={`rounded border px-3 py-2 ${seg.border} ${seg.bg}`}
            >
              <div className={`font-mono text-sm ${seg.color}`}>{seg.text}</div>
              <div className="font-mono text-xs text-zinc-600 mt-0.5">→ {seg.event}</div>
            </motion.div>
          ))}
        </div>

        {/* 右：审批弹窗 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="space-y-3"
        >
          <div className="font-mono text-xs text-zinc-500 mb-1">
            item/completed（type=plan）→ 所有客户端呈现审批 UI<br/>
            CLI 实现：tui/src/chatwidget.rs:2448 — maybe_prompt_plan_implementation()
          </div>

          <div className="rounded-lg border border-violet-700 bg-violet-950/20 p-4 space-y-3">
            <div className="font-mono text-sm font-bold text-violet-300">
              Implement this plan?
            </div>
            <div className="font-mono text-xs text-zinc-400">
              触发条件（CLI）：saw_plan_item_this_turn=true<br/>
              协议侧：item/completed {"{ type: \"plan\", text: \"...\" }"}
            </div>
            <div className="space-y-2">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.1 }}
                className="rounded border border-emerald-700 bg-emerald-900/40 px-4 py-2 font-mono text-sm text-emerald-300 cursor-pointer"
              >
                ✓ Yes, implement this plan
                <div className="text-xs text-emerald-600 mt-0.5">→ 切换 Default 模式 + 发送「Implement the plan.」</div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.25 }}
                className="rounded border border-zinc-700 bg-zinc-900 px-4 py-2 font-mono text-sm text-zinc-400"
              >
                ✗ No, stay in Plan mode
                <div className="text-xs text-zinc-600 mt-0.5">→ 继续在 Plan 模式精炼计划</div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────

export default function PlanModeVisualization() {
  const viz = useSteppedVisualization({ totalSteps: STEP_INFO.length, autoPlayInterval: 5000 });
  const step = STEP_INFO[viz.currentStep];

  return (
    <section className="space-y-4">

      {/* SVG 架构图 */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3">
        <div className="mb-2 font-mono text-xs text-zinc-500">
          <span className="text-amber-400">collaboration-mode-templates/</span>
          {" · "}
          <span className="text-violet-400">utils/stream-parser/proposed_plan.rs</span>
          {" · "}
          <span className="text-emerald-400">app-server-protocol/v2.rs</span>
        </div>
        <svg viewBox="0 0 1280 220" className="w-full rounded border border-zinc-800 bg-zinc-950">
          <defs>
            {(["#f59e0b","#8b5cf6","#10b981","#0ea5e9","#f43f5e","#52525b"] as const).map((c,i)=>(
              <marker key={i} id={`pm${i}`} markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto">
                <polygon points="0 0,10 4,0 8" fill={c}/>
              </marker>
            ))}
          </defs>

          {/* 行1：触发到模型 */}
          <text x="28" y="20" fontSize={11} fontFamily="monospace" fill="#52525b">① 模式切换路径 →</text>
          {([
            { x:28,   label:"/plan 命令",         sub:"slash_dispatch.rs:36",    stroke:"#0ea5e9", fill:"#03131f", tc:"#38bdf8", sc:"#7dd3fc" },
            { x:284,  label:"plan_mask()",          sub:"collaboration_modes.rs",  stroke:"#f59e0b", fill:"#1a1008", tc:"#fbbf24", sc:"#fde68a" },
            { x:540,  label:"developer message",    sub:"<collaboration_mode>",    stroke:"#f59e0b", fill:"#1a1008", tc:"#fbbf24", sc:"#fde68a" },
            { x:796,  label:"Plan 模式",            sub:"plan.md 128行 注入",      stroke:"#8b5cf6", fill:"#100a1f", tc:"#c4b5fd", sc:"#ddd6fe" },
            { x:1052, label:"ReasoningEffort",      sub:"Medium（preset 强制）",   stroke:"#10b981", fill:"#0d1f0d", tc:"#34d399", sc:"#6ee7b7" },
          ] as {x:number;label:string;sub:string;stroke:string;fill:string;tc:string;sc:string}[]).map(n=>(
            <g key={n.x}>
              <rect x={n.x} y="28" width="200" height="56" rx="7" fill={n.fill} stroke={n.stroke} strokeWidth={1.6}/>
              <text x={n.x+100} y="51"  textAnchor="middle" fontSize={14} fontWeight={700} fontFamily="monospace" fill={n.tc}>{n.label}</text>
              <text x={n.x+100} y="72" textAnchor="middle" fontSize={11} fontFamily="monospace" fill={n.sc}>{n.sub}</text>
            </g>
          ))}
          {([[228,284,"#0ea5e9",3],[484,540,"#f59e0b",0],[740,796,"#f59e0b",0],[996,1052,"#8b5cf6",1]] as [number,number,string,number][]).map(([x1,x2,c,mi],i)=>(
            <line key={i} x1={x1} y1={56} x2={x2} y2={56} stroke={c} strokeWidth={1.4} markerEnd={`url(#pm${mi})`}/>
          ))}

          {/* 垂直连：Plan模式 → Phase流程 */}
          <line x1="896" y1="84" x2="896" y2="130" stroke="#8b5cf6" strokeWidth={1.4} markerEnd="url(#pm1)"/>

          {/* 行2：三阶段 + 输出 */}
          <text x="28" y="128" fontSize={11} fontFamily="monospace" fill="#52525b">② 三阶段工作流 →</text>
          {([
            { x:28,   label:"Phase 1",         sub:"探索（非变更工具）",   stroke:"#0ea5e9", fill:"#03131f", tc:"#38bdf8", sc:"#7dd3fc" },
            { x:284,  label:"Phase 2",         sub:"request_user_input",   stroke:"#f59e0b", fill:"#1a1008", tc:"#fbbf24", sc:"#fde68a" },
            { x:540,  label:"Phase 3",         sub:"规格确认，decision完整",stroke:"#22c55e", fill:"#0f1a0a", tc:"#4ade80", sc:"#86efac" },
            { x:796,  label:"<proposed_plan>", sub:"item/plan/delta 协议事件",  stroke:"#8b5cf6", fill:"#100a1f", tc:"#c4b5fd", sc:"#ddd6fe" },
            { x:1052, label:"审批 → 执行",     sub:"item/completed(plan)+各端UI",stroke:"#10b981", fill:"#0d1f0d", tc:"#34d399", sc:"#6ee7b7" },
          ] as {x:number;label:string;sub:string;stroke:string;fill:string;tc:string;sc:string}[]).map(n=>(
            <g key={n.x}>
              <rect x={n.x} y="138" width="200" height="56" rx="7" fill={n.fill} stroke={n.stroke} strokeWidth={1.6}/>
              <text x={n.x+100} y="161" textAnchor="middle" fontSize={14} fontWeight={700} fontFamily="monospace" fill={n.tc}>{n.label}</text>
              <text x={n.x+100} y="180" textAnchor="middle" fontSize={11} fontFamily="monospace" fill={n.sc}>{n.sub}</text>
            </g>
          ))}
          {([[228,284,"#0ea5e9",3],[484,540,"#f59e0b",0],[740,796,"#22c55e",2],[996,1052,"#8b5cf6",1]] as [number,number,string,number][]).map(([x1,x2,c,mi],i)=>(
            <line key={i} x1={x1} y1={166} x2={x2} y2={166} stroke={c} strokeWidth={1.4} markerEnd={`url(#pm${mi})`}/>
          ))}

          {/* 底部提示 */}
          <text x="640" y="210" textAnchor="middle" fontSize={10} fontFamily="monospace" fill="#52525b">
            update_plan 工具在 Plan 模式被代码级拦截（plan.rs:86） · request_user_input 仅 Plan 模式允许（config_types.rs:428）
          </text>
        </svg>
      </div>

      {/* 步骤动画区域 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={viz.currentStep}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          {viz.currentStep === 0 && (
            <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-5 space-y-3">
              <p className="text-base text-zinc-300">
                Plan 模式是 Codex 的协作规划模式——通过 <code className="text-amber-300">/plan</code> 命令切换，三阶段工作流最终输出 <code className="text-violet-300">{"<proposed_plan>"}</code> 块等待审批：
              </p>
              <div className="space-y-2.5 font-mono text-sm">
                {[
                  ["ModeKind::Plan",      "amber",   "plan.md（128行）system prompt，reasoning=Medium，允许 request_user_input"],
                  ["Phase 1 探索",         "sky",     "只能用非变更工具（读文件/搜索），禁止写/编辑/格式化"],
                  ["Phase 2 提问",         "violet",  "request_user_input 工具，2-4 个互斥选项 + 推荐默认"],
                  ["<proposed_plan>",     "violet",  "core 层解析 → item/plan/delta 协议事件，所有客户端均可接收"],
                  ["审批 UI",             "emerald", "item/completed(plan) → 各客户端自行呈现 / CLI 实现在 tui/chatwidget.rs"],
                ].map(([lbl, color, desc]) => (
                  <div key={lbl as string} className="flex gap-3">
                    <span className={`text-${color}-400 shrink-0 w-32`}>{lbl}</span>
                    <span className="text-zinc-400">{desc as string}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {viz.currentStep === 1 && <ModeDiffViz />}
          {viz.currentStep === 2 && <ModeSwitchViz />}
          {viz.currentStep === 3 && <Phase1Viz />}
          {viz.currentStep === 4 && <RequestUserInputViz />}
          {viz.currentStep === 5 && <ProposedPlanViz />}
        </motion.div>
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
