"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useSteppedVisualization } from "@/hooks/useSteppedVisualization";
import { StepControls } from "@/components/visualizations/shared/step-controls";

// ─── orchestrator.rs 三阶段流程 ───────────────────────────────────────────────
// Phase 1: Approval  — ExecApprovalRequirement { Skip | NeedsApproval | Forbidden }
// Phase 2: First attempt under selected sandbox (SandboxType)
// Phase 3: If SandboxErr::Denied + escalate_on_failure → re-approval → retry with SandboxType::None

type ApprovalReq = "Skip" | "NeedsApproval" | "Forbidden";
type SandboxResult = "Ok" | "SandboxDenied" | "OtherErr";
type ReviewDecision = "Approved" | "ApprovedForSession" | "ApprovedExecpolicyAmendment" | "Denied" | "TimedOut";

interface ScenarioStep {
  phase: 1 | 2 | 3;
  title: string;
  detail: string;
  approvalReq?: ApprovalReq;
  reviewDecision?: ReviewDecision;
  sandboxType?: string;
  sandboxResult?: SandboxResult;
  outcome?: "success" | "rejected" | "retry" | "fail";
}

// 场景 A: cargo check — Skip approval, sandbox ok
// 场景 B: git push  — NeedsApproval → Approved → sandbox ok
// 场景 C: chmod 777 — NeedsApproval (Decision::Forbidden via execpolicy) → Rejected
// 场景 D: npm install (需要网络) — NeedsApproval → Approved → SandboxDenied → re-approval → retry SandboxType::None
const SCENARIOS: { label: string; file: string; steps: ScenarioStep[] }[] = [
  {
    label: "cargo check",
    file: "AskForApproval::OnFailure",
    steps: [
      {
        phase: 1,
        title: "Phase 1 — Approval",
        detail: "tool.exec_approval_requirement(req)\n→ default_exec_approval_requirement(\n    AskForApproval::OnFailure,\n    FileSystemSandboxKind::Restricted,\n  )\n→ ExecApprovalRequirement::Skip {\n    bypass_sandbox: false,\n    proposed_execpolicy_amendment: None,\n  }",
        approvalReq: "Skip",
        outcome: "success",
      },
      {
        phase: 2,
        title: "Phase 2 — First Attempt",
        detail: "sandbox_mode_for_first_attempt(req)\n→ SandboxOverride::NoOverride\n\nself.sandbox.select_initial(\n  FileSystemSandboxKind::Restricted,\n  NetworkSandboxPolicy::Restricted,\n  SandboxablePreference::Auto,\n  ...\n)\n→ SandboxType::LinuxSeccomp\n\ntool.run(req, &initial_attempt).await\n→ Ok(ExecToolCallOutput { exit_code: 0 })",
        sandboxType: "LinuxSeccomp",
        sandboxResult: "Ok",
        outcome: "success",
      },
    ],
  },
  {
    label: "git push origin main",
    file: "AskForApproval::UnlessTrusted",
    steps: [
      {
        phase: 1,
        title: "Phase 1 — Approval",
        detail: "default_exec_approval_requirement(\n  AskForApproval::UnlessTrusted,\n  FileSystemSandboxKind::Restricted,\n)\n→ ExecApprovalRequirement::NeedsApproval {\n    reason: Some(\"git 命令需要批准\"),\n    proposed_execpolicy_amendment: Some(\n      ExecPolicyAmendment { prefix: [\"git\",\"push\"] }\n    ),\n  }\n\ntool.start_approval_async(req, approval_ctx).await\n→ ReviewDecision::ApprovedForSession",
        approvalReq: "NeedsApproval",
        reviewDecision: "ApprovedForSession",
        outcome: "success",
      },
      {
        phase: 2,
        title: "Phase 2 — First Attempt",
        detail: "already_approved = true\n\nSandboxType::LinuxSeccomp\n\ntool.run(req, &initial_attempt).await\n→ Ok(ExecToolCallOutput { exit_code: 0 })",
        sandboxType: "LinuxSeccomp",
        sandboxResult: "Ok",
        outcome: "success",
      },
    ],
  },
  {
    label: "chmod 777 /etc/passwd",
    file: "AskForApproval::OnRequest",
    steps: [
      {
        phase: 1,
        title: "Phase 1 — Approval",
        detail: "tool.exec_approval_requirement(req)\n→ ExecApprovalRequirement::Forbidden {\n    reason: \"Decision::Forbidden \\\n      (exec_policy: command_might_be_dangerous)\",\n  }\n\nmatch requirement {\n  ExecApprovalRequirement::Forbidden { reason } =>\n    return Err(ToolError::Rejected(reason)),\n  // 直接返回，不进入 Phase 2\n}",
        approvalReq: "Forbidden",
        outcome: "rejected",
      },
    ],
  },
  {
    label: "curl https://api.example.com",
    file: "AskForApproval::UnlessTrusted",
    steps: [
      {
        phase: 1,
        title: "Phase 1 — Approval",
        detail: "ExecApprovalRequirement::NeedsApproval {\n  reason: Some(\"curl 命令需要批准\"),\n  ..\n}\n\nReviewDecision::Approved",
        approvalReq: "NeedsApproval",
        reviewDecision: "Approved",
        outcome: "success",
      },
      {
        phase: 2,
        title: "Phase 2 — First Attempt (沙箱拒绝)",
        detail: "SandboxType::LinuxSeccomp\n// 网络沙箱策略: Restricted\n\ntool.run(req, &initial_attempt).await\n→ Err(ToolError::Codex(\n    CodexErr::Sandbox(SandboxErr::Denied {\n      output: Box<ExecToolCallOutput>,\n      network_policy_decision: Some(..),\n    })\n  ))\n// is_likely_sandbox_denied() 检测到网络访问被拒",
        sandboxType: "LinuxSeccomp",
        sandboxResult: "SandboxDenied",
        outcome: "retry",
      },
      {
        phase: 3,
        title: "Phase 3 — Escalation Re-approval + Retry",
        detail: "// escalate_on_failure() → true\n// wants_no_sandbox_approval(policy) → true\n\nretry_reason = \"Network access to \\\"api.example.com\\\"\n  is blocked by policy.\"\n\ntool.start_approval_async(req, approval_ctx).await\n→ ReviewDecision::Approved\n\nescalated_attempt = SandboxAttempt {\n  sandbox: SandboxType::None,  // 移除沙箱限制\n  ..\n}\n\ntool.run(req, &escalated_attempt).await\n→ Ok(ExecToolCallOutput { exit_code: 0 })",
        sandboxType: "None (escalated)",
        sandboxResult: "Ok",
        outcome: "success",
      },
    ],
  },
];

const APPROVAL_REQ_COLOR: Record<ApprovalReq, { bg: string; border: string; text: string }> = {
  Skip:          { bg: "bg-emerald-950/40", border: "border-emerald-700", text: "text-emerald-400" },
  NeedsApproval: { bg: "bg-amber-950/40",   border: "border-amber-700",   text: "text-amber-400"   },
  Forbidden:     { bg: "bg-red-950/40",      border: "border-red-700",     text: "text-red-400"     },
};
const SANDBOX_RESULT_COLOR: Record<SandboxResult, string> = {
  Ok:           "text-emerald-400",
  SandboxDenied:"text-orange-400",
  OtherErr:     "text-red-400",
};
const OUTCOME_ICON: Record<string, string> = {
  success: "✓", rejected: "✗", retry: "↻", fail: "✗",
};
const OUTCOME_COLOR: Record<string, string> = {
  success: "text-emerald-400", rejected: "text-red-400", retry: "text-amber-400", fail: "text-red-400",
};

const STEP_INFO = [
  { title: "ToolOrchestrator — 三阶段架构", desc: "orchestrator.rs 的 run() 方法对每个工具调用执行三个有序阶段：① Approval（审批决策）→ ② First Attempt（沙箱内首次执行）→ ③ Escalation（沙箱拒绝时的升级重试）。三阶段分离让审批缓存与沙箱策略独立演进。" },
  { title: "场景 A: cargo check — Skip + 沙箱执行", desc: "AskForApproval::OnFailure 策略下，ExecApprovalRequirement::Skip，无需用户确认，直接在 LinuxSeccomp 沙箱内执行。Phase 3 不触发。" },
  { title: "场景 B: git push — NeedsApproval → 用户批准", desc: "AskForApproval::UnlessTrusted 策略下，任何命令都需批准。用户选择 ApprovedForSession，本次 session 内相同命令不再询问（already_approved=true）。" },
  { title: "场景 C: chmod 777 — Forbidden 直接拒绝", desc: "exec_policy 返回 Decision::Forbidden，ExecApprovalRequirement::Forbidden。orchestrator 在 Phase 1 直接返回 ToolError::Rejected，不进入 Phase 2。" },
  { title: "场景 D: curl（网络被沙箱拒绝）→ 升级重试", desc: "Phase 2 被 LinuxSeccomp 沙箱拦截网络访问，SandboxErr::Denied。escalate_on_failure()=true，进入 Phase 3：重新获得用户批准后，以 SandboxType::None 重试执行。" },
];

export default function PermissionsVisualization() {
  const viz = useSteppedVisualization({ totalSteps: 5, autoPlayInterval: 3200 });
  const step = STEP_INFO[viz.currentStep];
  const scenarioIdx = viz.currentStep - 1;
  const scenario = scenarioIdx >= 0 ? SCENARIOS[scenarioIdx] : null;

  return (
    <section className="space-y-4">

      {/* SVG 架构图 */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
        <div className="mb-2 flex items-center gap-2 font-mono text-xs text-zinc-500">
          <span className="text-emerald-400">core/src/tools/</span>orchestrator.rs
        </div>

        <svg viewBox="0 0 1280 360" className="w-full rounded-md border border-zinc-800 bg-zinc-950">
          <defs>
            <marker id="m6"  markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto"><polygon points="0 0,10 4,0 8" fill="#52525b"/></marker>
            <marker id="m6g" markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto"><polygon points="0 0,10 4,0 8" fill="#10b981"/></marker>
            <marker id="m6a" markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto"><polygon points="0 0,10 4,0 8" fill="#f59e0b"/></marker>
            <marker id="m6r" markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto"><polygon points="0 0,10 4,0 8" fill="#ef4444"/></marker>
            <marker id="m6b" markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto"><polygon points="0 0,10 4,0 8" fill="#3b82f6"/></marker>
          </defs>

          {/* 外框 */}
          <rect x="8" y="12" width="1264" height="336" rx="12" fill="none" stroke="#10b98155" strokeWidth={1.8} strokeDasharray="8 5"/>
          <rect x="12" y="4" width="360" height="22" fill="#09090b"/>
          <text x="16" y="20" fontSize={16} fontFamily="monospace" fill="#34d399">工具编排器 ToolOrchestrator::run()  — orchestrator.rs</text>

          {/* 输入 */}
          <rect x="28" y="138" width="152" height="64" rx="8" fill="#1e3a5f" stroke="#3b82f6" strokeWidth={2}/>
          <text x="104" y="165" textAnchor="middle" fontSize={18} fontWeight={700} fontFamily="monospace" fill="#fff">工具调用</text>
          <text x="104" y="188" textAnchor="middle" fontSize={14} fontFamily="monospace" fill="#60a5fa">ToolRuntime trait</text>

          {/* Phase 1 */}
          <rect x="242" y="76" width="248" height="188" rx="10" fill="#1a2a1a" stroke="#10b981" strokeWidth={1.5}/>
          <text x="366" y="102" textAnchor="middle" fontSize={16} fontWeight={700} fontFamily="monospace" fill="#34d399">第一阶段：审批</text>
          <rect x="256" y="114" width="220" height="42" rx="5" fill="#052e16" stroke="#10b981" strokeWidth={1}/>
          <text x="366" y="141" textAnchor="middle" fontSize={14} fontFamily="monospace" fill="#6ee7b7">跳过（自动批准）</text>
          <rect x="256" y="164" width="220" height="42" rx="5" fill="#422006" stroke="#f59e0b" strokeWidth={1}/>
          <text x="366" y="191" textAnchor="middle" fontSize={14} fontFamily="monospace" fill="#fcd34d">需要审批 → 等待用户</text>
          <rect x="256" y="214" width="220" height="36" rx="5" fill="#450a0a" stroke="#ef4444" strokeWidth={1}/>
          <text x="366" y="237" textAnchor="middle" fontSize={14} fontFamily="monospace" fill="#fca5a5">禁止 → 直接拒绝</text>

          {/* Phase 2 */}
          <rect x="558" y="96" width="268" height="152" rx="10" fill="#0c1a30" stroke="#3b82f6" strokeWidth={1.5}/>
          <text x="692" y="124" textAnchor="middle" fontSize={16} fontWeight={700} fontFamily="monospace" fill="#60a5fa">第二阶段：沙箱执行</text>
          <text x="692" y="150" textAnchor="middle" fontSize={14} fontFamily="monospace" fill="#93c5fd">选择沙箱类型并执行</text>
          <text x="692" y="172" textAnchor="middle" fontSize={14} fontFamily="monospace" fill="#93c5fd">tool.run(req, attempt).await</text>
          <rect x="572" y="188" width="110" height="32" rx="4" fill="#052e16" stroke="#10b981" strokeWidth={1}/>
          <text x="627" y="209" textAnchor="middle" fontSize={13} fontFamily="monospace" fill="#6ee7b7">成功 → 返回</text>
          <rect x="700" y="188" width="112" height="32" rx="4" fill="#431407" stroke="#f97316" strokeWidth={1}/>
          <text x="756" y="209" textAnchor="middle" fontSize={13} fontFamily="monospace" fill="#fed7aa">沙箱拒绝</text>

          {/* Phase 3 */}
          <rect x="900" y="96" width="268" height="152" rx="10" fill="#1a1a0a" stroke="#f59e0b" strokeWidth={1.5}/>
          <text x="1034" y="124" textAnchor="middle" fontSize={16} fontWeight={700} fontFamily="monospace" fill="#fcd34d">第三阶段：升级重试</text>
          <text x="1034" y="150" textAnchor="middle" fontSize={13} fontFamily="monospace" fill="#fde68a">escalate_on_failure() → true</text>
          <text x="1034" y="170" textAnchor="middle" fontSize={13} fontFamily="monospace" fill="#fde68a">再次请求用户审批</text>
          <text x="1034" y="190" textAnchor="middle" fontSize={13} fontFamily="monospace" fill="#fde68a">移除沙箱限制后重试</text>
          <rect x="914" y="206" width="122" height="30" rx="4" fill="#052e16" stroke="#10b981" strokeWidth={1}/>
          <text x="975" y="226" textAnchor="middle" fontSize={13} fontFamily="monospace" fill="#6ee7b7">成功 → 返回</text>
          <rect x="1048" y="206" width="106" height="30" rx="4" fill="#450a0a" stroke="#ef4444" strokeWidth={1}/>
          <text x="1101" y="226" textAnchor="middle" fontSize={13} fontFamily="monospace" fill="#fca5a5">用户拒绝</text>

          {/* 连线 */}
          <line x1="180" y1="170" x2="242" y2="170" stroke="#3b82f6" strokeWidth={1.5} markerEnd="url(#m6b)"/>
          <line x1="490" y1="135" x2="558" y2="148" stroke="#10b981" strokeWidth={1.5} markerEnd="url(#m6g)"/>
          <line x1="490" y1="185" x2="558" y2="172" stroke="#f59e0b" strokeWidth={1.5} markerEnd="url(#m6g)"/>
          <line x1="826" y1="209" x2="900" y2="180" stroke="#f97316" strokeWidth={1.5} markerEnd="url(#m6a)"/>
          <line x1="490" y1="232" x2="1240" y2="310" stroke="#ef4444" strokeWidth={1.2} strokeDasharray="5 3" markerEnd="url(#m6r)"/>
          <line x1="627" y1="220" x2="627" y2="302" stroke="#10b981" strokeWidth={1.2} markerEnd="url(#m6g)"/>
          <line x1="975" y1="236" x2="975" y2="302" stroke="#10b981" strokeWidth={1.2} markerEnd="url(#m6g)"/>

          {/* 结果标签 */}
          <rect x="552" y="304" width="152" height="30" rx="5" fill="#052e16" stroke="#10b981" strokeWidth={1}/>
          <text x="628" y="324" textAnchor="middle" fontSize={13} fontFamily="monospace" fill="#34d399">执行成功，返回结果</text>
          <rect x="900" y="304" width="152" height="30" rx="5" fill="#052e16" stroke="#10b981" strokeWidth={1}/>
          <text x="976" y="324" textAnchor="middle" fontSize={13} fontFamily="monospace" fill="#34d399">执行成功，返回结果</text>
          <rect x="1164" y="296" width="108" height="30" rx="5" fill="#450a0a" stroke="#ef4444" strokeWidth={1}/>
          <text x="1218" y="316" textAnchor="middle" fontSize={13} fontFamily="monospace" fill="#fca5a5">工具调用被拒绝</text>
        </svg>
      </div>

      {/* 场景详情 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* 左：当前场景的阶段步骤 */}
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
          <div className="mb-3 font-mono text-xs text-zinc-500">执行路径</div>
          <AnimatePresence mode="wait">
            {scenario ? (
              <motion.div key={viz.currentStep} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                {/* 命令标签 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 font-mono text-base text-zinc-200">
                    $ {scenario.label}
                  </span>
                  <span className="font-mono text-xs text-zinc-500">{scenario.file}</span>
                </div>

                {/* 各阶段 */}
                {scenario.steps.map((s, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.12 }}
                    className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`font-mono text-sm font-bold ${
                        s.phase === 1 ? "text-emerald-400" : s.phase === 2 ? "text-blue-400" : "text-amber-400"
                      }`}>Phase {s.phase}</span>
                      <div className="flex items-center gap-2">
                        {s.approvalReq && (
                          <span className={`rounded px-2 py-0.5 font-mono text-xs font-bold ${APPROVAL_REQ_COLOR[s.approvalReq].bg} ${APPROVAL_REQ_COLOR[s.approvalReq].text}`}>
                            {s.approvalReq}
                          </span>
                        )}
                        {s.sandboxResult && (
                          <span className={`font-mono text-sm font-bold ${SANDBOX_RESULT_COLOR[s.sandboxResult]}`}>
                            {s.sandboxResult}
                          </span>
                        )}
                        {s.outcome && (
                          <span className={`font-mono text-base font-bold ${OUTCOME_COLOR[s.outcome]}`}>
                            {OUTCOME_ICON[s.outcome]}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="font-mono text-sm leading-relaxed text-zinc-300 whitespace-pre-wrap">
                      {s.detail}
                    </div>
                    {s.sandboxType && (
                      <div className="font-mono text-xs text-blue-400">sandbox: {s.sandboxType}</div>
                    )}
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 text-base text-zinc-400">
                <p>orchestrator.rs 的 <code className="text-emerald-400">run()</code> 对每次工具调用执行有序三阶段：</p>
                <div className="space-y-2 font-mono text-sm">
                  <div className="flex gap-2"><span className="text-emerald-400 shrink-0">Phase 1</span><span>Approval — ExecApprovalRequirement: Skip / NeedsApproval / Forbidden</span></div>
                  <div className="flex gap-2"><span className="text-blue-400 shrink-0">Phase 2</span><span>First Attempt — SandboxManager 选择沙箱类型，执行工具</span></div>
                  <div className="flex gap-2"><span className="text-amber-400 shrink-0">Phase 3</span><span>Escalation — SandboxErr::Denied 时重新审批，以 SandboxType::None 重试</span></div>
                </div>
                <p className="text-sm text-zinc-600 pt-1">点击播放查看四个真实场景的执行路径 →</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 右：场景列表 */}
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
          <div className="mb-3 font-mono text-sm text-zinc-500">场景路径总览</div>
          <div className="space-y-3">
            {SCENARIOS.map((sc, idx) => {
              const isActive = idx === scenarioIdx;
              const lastStep = sc.steps[sc.steps.length - 1];
              const shown = viz.currentStep > idx;
              return (
                <motion.div key={sc.label}
                  animate={{ opacity: shown || isActive ? 1 : 0.35 }}
                  className={`rounded-lg border p-3 transition-colors ${isActive ? "border-blue-700 bg-blue-950/20" : "border-zinc-800 bg-zinc-950"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm text-zinc-200">$ {sc.label}</span>
                    {shown && lastStep.outcome && (
                      <span className={`font-mono text-sm font-bold ${OUTCOME_COLOR[lastStep.outcome]}`}>
                        {OUTCOME_ICON[lastStep.outcome]} {lastStep.outcome}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {sc.steps.map((s, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <span className={`rounded px-2 py-0.5 font-mono text-xs font-bold ${
                          s.phase === 1
                            ? s.approvalReq ? `${APPROVAL_REQ_COLOR[s.approvalReq].bg} ${APPROVAL_REQ_COLOR[s.approvalReq].text}` : "bg-zinc-800 text-zinc-400"
                            : s.phase === 2
                            ? s.sandboxResult === "SandboxDenied" ? "bg-orange-950/40 text-orange-400" : "bg-blue-950/40 text-blue-400"
                            : "bg-amber-950/40 text-amber-400"
                        }`}>
                          P{s.phase}{s.approvalReq ? `:${s.approvalReq.slice(0,4)}` : s.sandboxResult ? `:${s.sandboxResult.slice(0,4)}` : ""}
                        </span>
                        {i < sc.steps.length - 1 && <span className="text-zinc-600 text-sm">→</span>}
                      </div>
                    ))}
                  </div>
                  <div className="mt-1.5 font-mono text-xs text-zinc-500">{sc.file}</div>
                </motion.div>
              );
            })}
          </div>
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
