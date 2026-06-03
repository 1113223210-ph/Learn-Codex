"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useSteppedVisualization } from "@/hooks/useSteppedVisualization";
import { StepControls } from "@/components/visualizations/shared/step-controls";

// ─── 数据定义 ─────────────────────────────────────────────────────────────────
//
// 两条并行决策路径（exec_policy.rs）:
//   1. execpolicy 规则引擎 (prefix_rule, Decision: Allow/Prompt/Forbidden)
//   2. 启发式回退 (is_known_safe_command / command_might_be_dangerous → Decision)
// 最终合并为一个 Decision，再结合 SandboxType 决定实际执行方式。

type Decision = "Allow" | "Prompt" | "Forbidden";
type SandboxType = "None" | "LinuxSeccomp" | "MacosSeatbelt" | "WindowsRestrictedToken";

interface CheckCase {
  command: string;
  // execpolicy 规则引擎结果
  policyMatch: string;      // 匹配到的规则描述，"—" 表示无匹配
  policyDecision: Decision | null; // null = 无匹配
  // 启发式回退结果
  heuristicPath: string;    // 走了哪条启发式路径
  heuristicDecision: Decision;
  // 综合决策
  finalDecision: Decision;
  // 沙箱类型（与决策正交，由 SandboxPolicy 决定）
  sandboxType: SandboxType;
  // 决策说明
  note: string;
}

const CASES: CheckCase[] = [
  {
    command: "ls -la src/",
    policyMatch: "prefix_rule([\"ls\"]) → allow",
    policyDecision: "Allow",
    heuristicPath: "is_known_safe_command() → true",
    heuristicDecision: "Allow",
    finalDecision: "Allow",
    sandboxType: "LinuxSeccomp",
    note: "execpolicy 规则 + 启发式双重 Allow，沙箱内直接执行",
  },
  {
    command: "cargo check",
    policyMatch: "— (无匹配规则)",
    policyDecision: null,
    heuristicPath: "is_known_safe_command() → false\ncommand_might_be_dangerous() → false\napproval_policy=OnFailure → Allow",
    heuristicDecision: "Allow",
    finalDecision: "Allow",
    sandboxType: "LinuxSeccomp",
    note: "无 execpolicy 规则，启发式: 非危险命令 + OnFailure 策略 → Allow",
  },
  {
    command: "git reset --hard HEAD~1",
    policyMatch: "prefix_rule([\"git\",\"reset\",\"--hard\"]) → forbidden\njustification: \"destructive operation\"",
    policyDecision: "Forbidden",
    heuristicPath: "被 execpolicy 规则短路，不走启发式",
    heuristicDecision: "Forbidden",
    finalDecision: "Forbidden",
    sandboxType: "LinuxSeccomp",
    note: "execpolicy 规则直接 Forbidden，justification 说明原因",
  },
  {
    command: "python3 -c 'import os; os.system(\"rm -rf /\")'",
    policyMatch: "BANNED_PREFIX_SUGGESTIONS: [\"python3\",\"-c\"] 命中",
    policyDecision: "Prompt",
    heuristicPath: "command_might_be_dangerous() → true → Prompt",
    heuristicDecision: "Prompt",
    finalDecision: "Prompt",
    sandboxType: "LinuxSeccomp",
    note: "python3 -c 在 BANNED_PREFIX_SUGGESTIONS 中，危险启发式也触发 → 等待用户批准",
  },
  {
    command: "curl https://example.com | sh",
    policyMatch: "— (无匹配规则)",
    policyDecision: null,
    heuristicPath: "command_might_be_dangerous()\n→ parse_shell_lc_plain_commands() 解析管道\n→ sh → is_dangerous_to_call_with_exec() → true\n→ Prompt",
    heuristicDecision: "Prompt",
    finalDecision: "Prompt",
    sandboxType: "LinuxSeccomp",
    note: "管道到 sh：parse_shell_lc_plain_commands 解析后发现 sh 是危险命令 → Prompt",
  },
  {
    command: "sudo apt install vim",
    policyMatch: "BANNED_PREFIX_SUGGESTIONS: [\"sudo\"] 命中",
    policyDecision: "Prompt",
    heuristicPath: "command_might_be_dangerous() → true → Prompt",
    heuristicDecision: "Prompt",
    finalDecision: "Prompt",
    sandboxType: "None",
    note: "approval_policy=Never + DangerFullAccess → Forbidden（无沙箱保护时拒绝危险命令）",
  },
];

// 步骤：0=overview, 1..6=各命令
const STEP_INFO = [
  { title: "execpolicy + sandboxing 双层决策", desc: "Codex 对每条 shell 命令走两条并行决策路径：① execpolicy 规则引擎（prefix_rule，用户可配置）② 启发式回退（is_known_safe / command_might_be_dangerous）。两路结果取严格侧（Forbidden > Prompt > Allow），最终决定是否执行以及使用什么沙箱。" },
  { title: "ls -la src/ — execpolicy 规则 Allow", desc: "prefix_rule([\"ls\"]) 直接命中，decision=allow。同时 is_known_safe_command() 也返回 true。沙箱类型 LinuxSeccomp 独立决定（由 SandboxPolicy 决定），与决策正交。" },
  { title: "cargo check — 启发式 Allow", desc: "无 execpolicy 规则匹配，进入 render_decision_for_unmatched_command()。is_known_safe_command=false，command_might_be_dangerous=false，approval_policy=OnFailure → Allow，依赖沙箱做实际隔离。" },
  { title: "git reset --hard — execpolicy Forbidden", desc: "exec_policy.rs 内置 BANNED_PREFIX 检测，prefix_rule([\"git\",\"reset\",\"--hard\"]) decision=forbidden，携带 justification 字段告知原因。不走启发式，直接拒绝。" },
  { title: "python3 -c — Prompt（BANNED_PREFIX）", desc: "BANNED_PREFIX_SUGGESTIONS 包含 [\"python3\",\"-c\"]，命中后返回 Prompt。同时 command_might_be_dangerous() 也触发。approval_policy=UnlessTrusted 时显示审批界面。" },
  { title: "curl | sh — 启发式管道解析 Prompt", desc: "无 execpolicy 规则。command_might_be_dangerous() 调用 parse_shell_lc_plain_commands() 解析管道，发现 sh 是 is_dangerous_to_call_with_exec() 为 true 的命令 → Prompt。" },
  { title: "sudo — DangerFullAccess 时 Forbidden", desc: "BANNED_PREFIX_SUGGESTIONS 包含 [\"sudo\"]，且 command_might_be_dangerous=true。当 approval_policy=Never 且沙箱显式禁用（DangerFullAccess）时，最终为 Forbidden，而非 Prompt。" },
];

const DECISION_CONFIG: Record<Decision, { color: string; bg: string; border: string; label: string }> = {
  Allow:     { color: "text-emerald-400", bg: "bg-emerald-950/40", border: "border-emerald-700", label: "Allow" },
  Prompt:    { color: "text-amber-400",   bg: "bg-amber-950/40",   border: "border-amber-700",   label: "Prompt" },
  Forbidden: { color: "text-red-400",     bg: "bg-red-950/40",     border: "border-red-700",     label: "Forbidden" },
};

const SANDBOX_LABEL: Record<SandboxType, string> = {
  None:                    "SandboxType::None",
  LinuxSeccomp:            "SandboxType::LinuxSeccomp",
  MacosSeatbelt:           "SandboxType::MacosSeatbelt",
  WindowsRestrictedToken:  "SandboxType::WindowsRestrictedToken",
};

const SANDBOX_COLOR: Record<SandboxType, string> = {
  None:                   "text-zinc-500",
  LinuxSeccomp:           "text-blue-400",
  MacosSeatbelt:          "text-purple-400",
  WindowsRestrictedToken: "text-cyan-400",
};

// 决策统计条
function DecisionBar({ cases }: { cases: CheckCase[] }) {
  const counts = { Allow: 0, Prompt: 0, Forbidden: 0 };
  for (const c of cases) counts[c.finalDecision]++;
  const total = cases.length || 1;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>决策分布</span>
        <span className="font-mono">{cases.length} 条命令</span>
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <motion.div className="bg-emerald-500" animate={{ width: `${(counts.Allow / total) * 100}%` }} />
        <motion.div className="bg-amber-500"   animate={{ width: `${(counts.Prompt / total) * 100}%` }} />
        <motion.div className="bg-red-500"     animate={{ width: `${(counts.Forbidden / total) * 100}%` }} />
      </div>
      <div className="flex gap-4 text-[10px] text-zinc-500">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500"/>Allow {counts.Allow}</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500"/>Prompt {counts.Prompt}</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500"/>Forbidden {counts.Forbidden}</span>
      </div>
    </div>
  );
}

export default function SandboxSecurityVisualization() {
  const viz = useSteppedVisualization({ totalSteps: 7, autoPlayInterval: 3200 });
  const step = STEP_INFO[viz.currentStep];
  const caseIdx = viz.currentStep - 1; // step 0 = overview
  const currentCase = caseIdx >= 0 ? CASES[caseIdx] : null;
  const shownCases = viz.currentStep > 0 ? CASES.slice(0, viz.currentStep) : [];

  return (
    <section className="space-y-4">

      {/* ── SVG 架构图（overview 时展示） ── */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
        <div className="mb-2 flex items-center gap-2 font-mono text-xs text-zinc-500">
          <span className="text-emerald-400">core/src/</span>exec_policy.rs
          <span className="mx-1 text-zinc-700">·</span>
          <span className="text-blue-400">sandboxing/src/</span>manager.rs
        </div>

        <svg viewBox="0 0 1280 420" className="w-full rounded-md border border-zinc-800 bg-zinc-950">
          <defs>
            {(["emerald","amber","red","blue","zinc"] as const).map(c => (
              <filter key={c} id={`gl5-${c}`}>
                <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={
                  c === "emerald" ? "#10b981" : c === "amber" ? "#f59e0b" : c === "red" ? "#ef4444" : c === "blue" ? "#3b82f6" : "#71717a"
                } floodOpacity="0.7" />
              </filter>
            ))}
            <marker id="m5" markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto">
              <polygon points="0 0,10 4,0 8" fill="#52525b" />
            </marker>
            <marker id="m5g" markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto">
              <polygon points="0 0,10 4,0 8" fill="#10b981" />
            </marker>
            <marker id="m5a" markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto">
              <polygon points="0 0,10 4,0 8" fill="#f59e0b" />
            </marker>
            <marker id="m5r" markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto">
              <polygon points="0 0,10 4,0 8" fill="#ef4444" />
            </marker>
          </defs>

          {/* ── 外框 + 标题 ── */}
          <rect x="14" y="16" width="1252" height="390" rx="12" fill="none" strokeDasharray="8 5" strokeWidth={1.8} stroke="#3b82f660" />
          <rect x="18" y="8" width="430" height="22" fill="#09090b" />
          <text x="22" y="24" fontSize={16} fontFamily="monospace" fill="#60a5fa">exec_policy.rs — render_decision_for_command()</text>

          {/* 输入节点 */}
          <rect x="40" y="170" width="180" height="64" rx="8" fill="#1e3a5f" stroke="#3b82f6" strokeWidth={2} />
          <text x="130" y="197" textAnchor="middle" fontSize={18} fontWeight={700} fontFamily="monospace" fill="#fff">命令到达</text>
          <text x="130" y="220" textAnchor="middle" fontSize={14} fontFamily="monospace" fill="#60a5fa">Vec&lt;String&gt;</text>

          {/* 路径1: execpolicy 规则 */}
          <rect x="290" y="68" width="260" height="64" rx="8" fill="#1e3a5f" stroke="#3b82f6" strokeWidth={1.8} />
          <text x="420" y="95" textAnchor="middle" fontSize={18} fontWeight={700} fontFamily="monospace" fill="#fff">execpolicy 规则</text>
          <text x="420" y="118" textAnchor="middle" fontSize={14} fontFamily="monospace" fill="#60a5fa">prefix_rule() 匹配</text>

          {/* 路径2: 启发式 */}
          <rect x="290" y="272" width="260" height="64" rx="8" fill="#0c3044" stroke="#06b6d4" strokeWidth={1.8} />
          <text x="420" y="299" textAnchor="middle" fontSize={18} fontWeight={700} fontFamily="monospace" fill="#fff">启发式检查</text>
          <text x="420" y="322" textAnchor="middle" fontSize={14} fontFamily="monospace" fill="#67e8f9">is_safe / is_dangerous</text>

          {/* 合并节点 */}
          <rect x="630" y="170" width="240" height="64" rx="8" fill="#422006" stroke="#f59e0b" strokeWidth={2} />
          <text x="750" y="197" textAnchor="middle" fontSize={18} fontWeight={700} fontFamily="monospace" fill="#fff">合并决策</text>
          <text x="750" y="220" textAnchor="middle" fontSize={14} fontFamily="monospace" fill="#fcd34d">Forbidden &gt; Prompt &gt; Allow</text>

          {/* 三个输出 */}
          <rect x="960" y="60" width="160" height="56" rx="8" fill="#052e16" stroke="#10b981" strokeWidth={2} />
          <text x="1040" y="94" textAnchor="middle" fontSize={18} fontWeight={700} fontFamily="monospace" fill="#10b981">Allow</text>

          <rect x="960" y="170" width="160" height="56" rx="8" fill="#422006" stroke="#f59e0b" strokeWidth={2} />
          <text x="1040" y="204" textAnchor="middle" fontSize={18} fontWeight={700} fontFamily="monospace" fill="#f59e0b">Prompt</text>

          <rect x="960" y="280" width="160" height="56" rx="8" fill="#450a0a" stroke="#ef4444" strokeWidth={2} />
          <text x="1040" y="314" textAnchor="middle" fontSize={18} fontWeight={700} fontFamily="monospace" fill="#ef4444">Forbidden</text>

          {/* 沙箱节点（与决策正交） */}
          <rect x="1160" y="130" width="106" height="144" rx="8" fill="#1a1a2e" stroke="#6366f1" strokeWidth={1.5} strokeDasharray="4 3" />
          <text x="1213" y="158" textAnchor="middle" fontSize={14} fontFamily="monospace" fill="#818cf8">Sandbox</text>
          <text x="1213" y="178" textAnchor="middle" fontSize={13} fontFamily="monospace" fill="#6366f1a0">Linux</text>
          <text x="1213" y="196" textAnchor="middle" fontSize={13} fontFamily="monospace" fill="#6366f1a0">macOS</text>
          <text x="1213" y="214" textAnchor="middle" fontSize={13} fontFamily="monospace" fill="#6366f1a0">Windows</text>
          <text x="1213" y="236" textAnchor="middle" fontSize={12} fontFamily="monospace" fill="#4f46e570">⊥ 决策</text>

          {/* 连线 */}
          <line x1="220" y1="202" x2="290" y2="100"  stroke="#3b82f6" strokeWidth={1.5} markerEnd="url(#m5)" />
          <line x1="220" y1="202" x2="290" y2="304" stroke="#06b6d4" strokeWidth={1.5} markerEnd="url(#m5)" />
          <line x1="550" y1="100"  x2="630" y2="190" stroke="#3b82f6" strokeWidth={1.5} markerEnd="url(#m5)" />
          <line x1="550" y1="304" x2="630" y2="214" stroke="#06b6d4" strokeWidth={1.5} markerEnd="url(#m5)" />
          <line x1="870" y1="190" x2="960" y2="88"  stroke="#10b981" strokeWidth={1.5} markerEnd="url(#m5g)" />
          <line x1="870" y1="202" x2="960" y2="198" stroke="#f59e0b" strokeWidth={1.5} markerEnd="url(#m5a)" />
          <line x1="870" y1="214" x2="960" y2="308" stroke="#ef4444" strokeWidth={1.5} markerEnd="url(#m5r)" />
          <line x1="1120" y1="88"  x2="1160" y2="186" stroke="#6366f140" strokeWidth={1.2} strokeDasharray="4 3" />
          <line x1="1120" y1="198" x2="1160" y2="202" stroke="#6366f140" strokeWidth={1.2} strokeDasharray="4 3" />
          <line x1="1120" y1="308" x2="1160" y2="218" stroke="#6366f140" strokeWidth={1.2} strokeDasharray="4 3" />
        </svg>
      </div>

      {/* ── 当前命令分析 ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

        {/* 左：决策流程 */}
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
          <div className="mb-3 font-mono text-xs text-zinc-500">决策流程</div>
          <AnimatePresence mode="wait">
            {currentCase ? (
              <motion.div key={viz.currentStep} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                {/* 命令 */}
                <div className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200">
                  $ {currentCase.command}
                </div>

                {/* Path 1: execpolicy */}
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">① execpolicy 规则引擎</div>
                  <div className="rounded-md border border-zinc-800 bg-zinc-950 p-2.5">
                    <div className="font-mono text-[11px] leading-relaxed text-zinc-300 whitespace-pre-wrap">{currentCase.policyMatch}</div>
                    {currentCase.policyDecision && (
                      <div className={`mt-1.5 inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-bold ${DECISION_CONFIG[currentCase.policyDecision].bg} ${DECISION_CONFIG[currentCase.policyDecision].color}`}>
                        Decision::{currentCase.policyDecision}
                      </div>
                    )}
                    {!currentCase.policyDecision && (
                      <div className="mt-1.5 text-xs text-zinc-600">→ 无匹配，进入启发式</div>
                    )}
                  </div>
                </div>

                {/* Path 2: heuristics */}
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400">② 启发式回退</div>
                  <div className="rounded-md border border-zinc-800 bg-zinc-950 p-2.5">
                    <div className="font-mono text-[11px] leading-relaxed text-zinc-300 whitespace-pre-wrap">{currentCase.heuristicPath}</div>
                    <div className={`mt-1.5 inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-bold ${DECISION_CONFIG[currentCase.heuristicDecision].bg} ${DECISION_CONFIG[currentCase.heuristicDecision].color}`}>
                      Decision::{currentCase.heuristicDecision}
                    </div>
                  </div>
                </div>

                {/* 最终 */}
                <div className={`flex items-center justify-between rounded-lg border p-3 ${DECISION_CONFIG[currentCase.finalDecision].bg} ${DECISION_CONFIG[currentCase.finalDecision].border}`}>
                  <div>
                    <div className={`font-mono text-sm font-bold ${DECISION_CONFIG[currentCase.finalDecision].color}`}>
                      最终: Decision::{currentCase.finalDecision}
                    </div>
                    <div className="mt-1 text-xs text-zinc-400">{currentCase.note}</div>
                  </div>
                  <div className={`ml-3 shrink-0 font-mono text-[10px] ${SANDBOX_COLOR[currentCase.sandboxType]}`}>
                    {SANDBOX_LABEL[currentCase.sandboxType]}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 text-sm text-zinc-400">
                <p>execpolicy 决策引擎由两层组成：</p>
                <div className="space-y-1.5 font-mono text-xs">
                  <div className="flex items-start gap-2"><span className="shrink-0 text-blue-400">①</span><span>规则引擎：prefix_rule() 匹配，decision = allow / prompt / forbidden</span></div>
                  <div className="flex items-start gap-2"><span className="shrink-0 text-cyan-400">②</span><span>启发式：is_known_safe_command() / command_might_be_dangerous() 兜底</span></div>
                  <div className="flex items-start gap-2"><span className="shrink-0 text-amber-400">→</span><span>取严格侧：Forbidden &gt; Prompt &gt; Allow</span></div>
                  <div className="flex items-start gap-2"><span className="shrink-0 text-indigo-400">⊕</span><span>SandboxType 与决策正交：由 SandboxPolicy 独立决定</span></div>
                </div>
                <p className="text-xs text-zinc-600 pt-1">点击播放查看各命令的决策路径 →</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 右：命令历史 + 统计 */}
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
          <div className="mb-2 font-mono text-xs text-zinc-500">命令决策历史</div>
          <div className="min-h-[220px] space-y-2 rounded-md border border-zinc-800 bg-zinc-950 p-3">
            <AnimatePresence mode="popLayout">
              {shownCases.length === 0 && (
                <motion.div key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="py-10 text-center text-xs text-zinc-600">点击播放查看命令决策</motion.div>
              )}
              {shownCases.map((c, i) => (
                <motion.div key={`${c.command}-${i}`}
                  initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}
                  className={`flex items-center justify-between gap-2 rounded border p-2 ${DECISION_CONFIG[c.finalDecision].bg} ${DECISION_CONFIG[c.finalDecision].border}`}>
                  <span className="truncate font-mono text-[11px] text-zinc-200">$ {c.command}</span>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold ${DECISION_CONFIG[c.finalDecision].color}`}>
                    {c.finalDecision}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          {shownCases.length > 0 && (
            <div className="mt-3">
              <DecisionBar cases={shownCases} />
            </div>
          )}
        </div>
      </div>

      <StepControls
        currentStep={viz.currentStep} totalSteps={viz.totalSteps}
        onPrev={viz.prev} onNext={viz.next} onReset={viz.reset}
        isPlaying={viz.isPlaying} onToggleAutoPlay={viz.toggleAutoPlay}
        stepTitle={step.title} stepDescription={step.desc}
      />
    </section>
  );
}
