"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useSteppedVisualization } from "@/hooks/useSteppedVisualization";
import { StepControls } from "@/components/visualizations/shared/step-controls";

// ─── 节点定义（ViewBox 0 0 1280 640）三列，节点间距 40px ──────────────────
// 左列：ToolPayload 4 种（x=150）
// 中列：主流程 7 节点（x=640），各节点间距拉开到 40px
// 右列：ToolRegistry handlers 5 种（x=1120）
interface N {
  id: string; label: string; sublabel?: string;
  x: number; y: number; w: number; h: number;
  color: "blue" | "cyan" | "orange" | "green" | "purple" | "yellow" | "red" | "teal";
}

const NODES: N[] = [
  // ── 中列主流程（x=640, w=400, h=56）
  { id: "fc",       label: "收到工具调用请求",          sublabel: "FunctionCall / CustomToolCall",            x: 640, y: 60,  w: 400, h: 56, color: "blue"   },
  { id: "build",    label: "解析工具类型与参数",         sublabel: "build_tool_call()  router.rs:172",         x: 640, y: 150, w: 400, h: 56, color: "blue"   },
  { id: "runtime",  label: "创建独立并发任务",           sublabel: "tokio::spawn + AbortOnDropHandle",         x: 640, y: 240, w: 400, h: 56, color: "cyan"   },
  { id: "rwlock",   label: "控制并行 / 串行执行",        sublabel: "RwLock: read=共享  write=独占",            x: 640, y: 330, w: 400, h: 56, color: "cyan"   },
  { id: "dispatch", label: "查找对应处理器",             sublabel: "ToolRegistry::dispatch_any()  registry.rs:237", x: 640, y: 430, w: 400, h: 56, color: "orange" },
  { id: "handler",  label: "执行工具逻辑",               sublabel: "ToolHandler::handle(invocation)",          x: 640, y: 520, w: 400, h: 56, color: "orange" },
  { id: "result",   label: "结果写回对话历史",           sublabel: "AnyToolResult → ResponseInputItem",        x: 640, y: 610, w: 400, h: 56, color: "green"  },

  // ── 左列：ToolPayload 4 种（x=150, w=210, h=54, step=140）
  { id: "p_fn",  label: "普通函数调用",   sublabel: "Function { arguments }",      x: 150, y: 120, w: 210, h: 54, color: "blue"   },
  { id: "p_mcp", label: "MCP 工具",      sublabel: "Mcp { server, tool, args }",  x: 150, y: 260, w: 210, h: 54, color: "purple" },
  { id: "p_sh",  label: "本地 Shell",    sublabel: "LocalShell { params }",       x: 150, y: 400, w: 210, h: 54, color: "teal"   },
  { id: "p_cu",  label: "自定义工具",    sublabel: "Custom { input: Value }",     x: 150, y: 540, w: 210, h: 54, color: "yellow" },

  // ── 右列：Handler 注册表（x=1120, w=224, h=54, step=105）
  { id: "h_sh",  label: "Shell 执行器",      sublabel: "ShellHandler  shell/unified_exec", x: 1120, y: 180, w: 224, h: 54, color: "red"    },
  { id: "h_ap",  label: "补丁应用器",        sublabel: "ApplyPatchHandler  apply_patch",   x: 1120, y: 285, w: 224, h: 54, color: "red"    },
  { id: "h_mc",  label: "MCP 转发器",        sublabel: "McpHandler  mcp/mcp_resource",     x: 1120, y: 390, w: 224, h: 54, color: "purple" },
  { id: "h_ld",  label: "目录列举器",        sublabel: "ListDirHandler  list_dir",         x: 1120, y: 495, w: 224, h: 54, color: "orange" },
  { id: "h_js",  label: "JS REPL 执行器",   sublabel: "JsReplHandler  js_repl",           x: 1120, y: 600, w: 224, h: 54, color: "yellow" },
];

const COLOR_MAP: Record<string, { fill: string; stroke: string }> = {
  blue:   { fill: "#1e3a5f", stroke: "#3b82f6" },
  cyan:   { fill: "#0c3044", stroke: "#06b6d4" },
  orange: { fill: "#431a03", stroke: "#f97316" },
  green:  { fill: "#052e16", stroke: "#10b981" },
  purple: { fill: "#2e1065", stroke: "#a855f7" },
  yellow: { fill: "#422006", stroke: "#f59e0b" },
  red:    { fill: "#450a0a", stroke: "#ef4444" },
  teal:   { fill: "#042f2e", stroke: "#14b8a6" },
};

const ACTIVE_NODES: string[][] = [
  [],
  ["fc"],
  ["build", "p_fn", "p_mcp", "p_sh", "p_cu"],
  ["runtime"],
  ["rwlock"],
  ["dispatch"],
  ["h_sh", "h_ap", "h_mc", "h_ld", "h_js"],
  ["handler"],
  ["result"],
  ["result"],
];

const ACTIVE_EDGES: string[][] = [
  [],
  [],
  ["fc->build"],
  ["build->runtime"],
  ["runtime->rwlock"],
  ["rwlock->dispatch"],
  ["dispatch->handlers"],
  ["dispatch->handler"],
  ["handler->result"],
  ["result->back"],
];

const EVENTS: string[][] = [
  [],
  [
    "// turn.rs SSE 流收到工具调用",
    "ResponseEvent::OutputItemDone(FunctionCall {",
    '  name: "shell",',
    '  call_id: "call_01",',
    '  arguments: "{\"command\":\"cargo check\"}"',
    "})",
  ],
  [
    "// router.rs:172 build_tool_call()",
    "// → session.resolve_mcp_tool_info(&tool_name).await",
    "// → None (非MCP工具，走本地 handler)",
    "Ok(Some(ToolCall {",
    '  tool_name: ToolName::plain("shell"),',
    '  call_id: "call_01",',
    "  payload: ToolPayload::Function {",
    '    arguments: "{\"command\":\"cargo check\"}"',
    "  }",
    "}))",
  ],
  [
    "// parallel.rs:106",
    "AbortOnDropHandle::new(tokio::spawn(async move {",
    "  tokio::select! {",
    "    _ = cancellation_token.cancelled() => abort,",
    "    res = dispatch(...) => res,",
    "  }",
    "}))",
    "// 工具在独立 Tokio task 中运行",
  ],
  [
    "// parallel.rs:115",
    "let supports_parallel = router.tool_supports_parallel(&call);",
    "// shell 不支持并行 → write lock（独占）",
    "let _guard = lock.write().await;",
    "// 若支持并行 → read lock（共享，可同时运行）",
    "// let _guard = lock.read().await;",
  ],
  [
    "// registry.rs:237",
    "pub(crate) async fn dispatch_any(",
    "  invocation: ToolInvocation,",
    ") -> Result<AnyToolResult, FunctionCallError> {",
    '  let handler = self.handlers.get(&tool_name)?;',
    "  // 运行 pre_tool_use hooks",
    "  run_pre_tool_use_hooks(...).await;",
    "  handler.handle_any(invocation).await",
    "}",
  ],
  [
    "// handlers/mod.rs — 注册表中的所有 handler",
    "ShellHandler         shell / local_shell",
    "ApplyPatchHandler    apply_patch",
    "McpHandler           mcp::*",
    "ListDirHandler       list_dir",
    "JsReplHandler        js_repl / js_repl_reset",
    "UnifiedExecHandler   unified_exec",
    "PlanHandler          plan",
    "RequestUserInputHandler  request_user_input",
    "multi_agents_v2::*   agent management",
  ],
  [
    "// registry.rs:41 — ToolHandler trait",
    "pub trait ToolHandler: Send + Sync {",
    "  type Output: ToolOutput;",
    "  fn kind(&self) -> ToolKind;",
    "  fn is_mutating(&self, ..) -> Future<bool>;",
    "  fn handle(invocation) -> Future<Result<Output>>;",
    "  fn create_diff_consumer() -> Option<..>;",
    "}",
    "// dispatch_any → handle_any → Box::new(output)",
  ],
  [
    "AnyToolResult {",
    '  call_id: "call_01",',
    "  payload: ToolPayload::Function { .. },",
    "  result: Box<dyn ToolOutput>,",
    "}",
    "// into_response() → ResponseInputItem::FunctionCallOutput",
    "// 写回 session history",
    "// FuturesOrdered 收割 → needs_follow_up = true",
  ],
  [
    "// 回到 turn.rs 外层循环",
    "// ResponseInputItem 追加到 session history",
    "// 下一轮 clone_history().for_prompt()",
    "// 模型看到工具结果，继续推理",
  ],
];

const STEP_INFO = [
  { title: "工具系统三层架构", desc: "ToolRouter（分发）→ ToolCallRuntime（并行控制）→ ToolRegistry（handler 注册表）。每层职责独立，合在一起构成完整的工具调用管线。", file: "core/src/tools/" },
  { title: "FunctionCall / CustomToolCall 到达", desc: "ResponseEvent::OutputItemDone 触发，item 类型可以是 FunctionCall、CustomToolCall、ToolSearchCall 或 LocalShellCall。build_tool_call() 统一转换为 ToolCall。", file: "router.rs:172" },
  { title: "build_tool_call()：4 种 payload 类型", desc: "FunctionCall → 先查 MCP 工具表，匹配到则 Mcp payload，否则 Function payload。CustomToolCall → Custom payload。LocalShellCall → LocalShell payload。ToolSearchCall(client) → ToolSearch payload。", file: "router.rs:176" },
  { title: "ToolCallRuntime：tokio::spawn 独立 Task", desc: "每个工具调用在独立的 Tokio task 中运行，用 AbortOnDropHandle 包装确保 task 在 Runtime 被 drop 时自动终止。tokio::select! 同时监听 cancellation_token，用户中止立即生效。", file: "parallel.rs:106" },
  { title: "RwLock：并行 vs 串行执行控制", desc: "parallel_execution: Arc<RwLock<()>> 是并发控制的核心。支持并行的工具（tool_supports_parallel=true）取 read lock，可同时运行；不支持的取 write lock，独占执行。shell 默认不支持并行。", file: "parallel.rs:115" },
  { title: "ToolRegistry::dispatch_any()：Handler 查找", desc: "handlers: HashMap<ToolName, Arc<dyn AnyToolHandler>>，O(1) 查找。执行前运行 run_pre_tool_use_hooks()，执行后运行 run_post_tool_use_hooks()，记录 OTEL telemetry。", file: "registry.rs:237" },
  { title: "Handler 注册表：17+ 种 Handler 类型", desc: "每种 handler 实现 ToolHandler trait，注册到 HashMap。ShellHandler/UnifiedExecHandler 走 exec.rs 子进程。McpHandler 通过 MCP 协议转发。PlanHandler 触发 Plan 模式。multi_agents_v2 管理子 Agent。", file: "handlers/mod.rs" },
  { title: "ToolHandler::handle()：实际执行", desc: "handle(invocation) 接收 ToolInvocation（含 session、turn、call_id、payload），返回 Future<Result<Self::Output>>。每个 handler 可选实现 create_diff_consumer() 支持流式参数 diff 展示。", file: "registry.rs:86" },
  { title: "AnyToolResult → ResponseInputItem", desc: "into_response() 根据 payload 类型生成不同格式：Function → FunctionCallOutput，Custom → CustomToolCallOutput，ToolSearch → ToolSearchOutput。结果追加到 session history，FuturesOrdered 收割后 needs_follow_up = true。", file: "registry.rs:107" },
  { title: "结果回传，循环继续", desc: "ResponseInputItem 进入 session history 后，外层 run_turn 循环的下一轮 clone_history().for_prompt() 会把工具结果包含在采样输入中，模型看到完整上下文继续推理。", file: "turn.rs:436" },
];

function getNode(id: string) { return NODES.find(n => n.id === id)!; }

// ─── 主组件
export default function ToolSystemVisualization() {
  const viz = useSteppedVisualization({ totalSteps: 10, autoPlayInterval: 2800 });
  const an = ACTIVE_NODES[viz.currentStep];
  const ae = ACTIVE_EDGES[viz.currentStep];
  const step = STEP_INFO[viz.currentStep];

  const allEvents: string[] = [];
  for (let s = 1; s <= viz.currentStep; s++) {
    if (EVENTS[s].length > 0) allEvents.push(...EVENTS[s]);
  }
  const visibleEvents = allEvents.slice(-10);

  return (
    <section className="space-y-4">

      {/* ── SVG 流程图 ── */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
        <div className="mb-2 flex items-center gap-2 font-mono text-xs text-zinc-500">
          <span className="text-orange-400">core/src/tools/</span>router.rs · registry.rs · parallel.rs
        </div>

        <svg viewBox="0 0 1280 680" className="w-full rounded-md border border-zinc-800 bg-zinc-950" style={{ maxHeight: "650px" }}>
          <defs>
            {(Object.keys(COLOR_MAP) as Array<keyof typeof COLOR_MAP>).map(c => (
              <filter key={c} id={`gl2-${c}`}>
                <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={COLOR_MAP[c].stroke} floodOpacity="0.8" />
              </filter>
            ))}
            <marker id="m2" markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto">
              <polygon points="0 0,10 4,0 8" fill="#52525b" />
            </marker>
            {(Object.keys(COLOR_MAP) as Array<keyof typeof COLOR_MAP>).map(c => (
              <marker key={c} id={`m2-${c}`} markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto">
                <polygon points="0 0,10 4,0 8" fill={COLOR_MAP[c].stroke} />
              </marker>
            ))}
          </defs>

          {/* 左列标注框 */}
          <text x="150" y="84" textAnchor="middle" fontSize={16} fontFamily="monospace" fill="#52525b">工具调用类型（ToolPayload）</text>
          <motion.rect x="32" y="90" width="236" height="530" rx="8" fill="none" strokeDasharray="4 3" strokeWidth={1.2}
            animate={{ stroke: an.some(n => n.startsWith("p_")) ? "#3b82f668" : "#3f3f4648" }} transition={{ duration: 0.4 }} />

          {/* 右列标注框 */}
          <text x="1120" y="144" textAnchor="middle" fontSize={16} fontFamily="monospace" fill="#52525b">注册的工具处理器（ToolRegistry）</text>
          <motion.rect x="994" y="150" width="252" height="530" rx="8" fill="none" strokeDasharray="4 3" strokeWidth={1.2}
            animate={{ stroke: an.some(n => n.startsWith("h_")) ? "#f9731668" : "#3f3f4648" }} transition={{ duration: 0.4 }} />

          {/* 中列主流程竖线 */}
          {[
            { from: "fc", to: "build" },
            { from: "build", to: "runtime" },
            { from: "runtime", to: "rwlock" },
            { from: "rwlock", to: "dispatch" },
            { from: "dispatch", to: "handler" },
            { from: "handler", to: "result" },
          ].map(({ from, to }) => {
            const key = `${from}->${to}`;
            const active = ae.includes(key) || ae.includes(`${from}->handler`);
            const fn_ = getNode(from);
            const tn = getNode(to);
            const nc = fn_.color;
            return (
              <motion.line key={key}
                x1={fn_.x} y1={fn_.y + fn_.h / 2}
                x2={tn.x}  y2={tn.y - tn.h / 2}
                strokeWidth={active ? 3 : 1.8}
                markerEnd={`url(#m2${active ? `-${nc}` : ""})`}
                animate={{ stroke: active ? COLOR_MAP[nc].stroke : "#3f3f46", opacity: active ? 1 : 0.4 }}
                transition={{ duration: 0.3 }}
              />
            );
          })}

          {/* 左列 payload → build（对角线） */}
          {["p_fn", "p_mcp", "p_sh", "p_cu"].map(pid => {
            const active = an.includes(pid);
            const pn = getNode(pid);
            const build = getNode("build");
            return (
              <motion.line key={pid}
                x1={pn.x + pn.w / 2} y1={pn.y}
                x2={build.x - build.w / 2} y2={build.y + 6}
                strokeWidth={active ? 2.5 : 1.2}
                strokeDasharray={active ? "none" : "4 3"}
                markerEnd={`url(#m2${active ? `-${pn.color}` : ""})`}
                animate={{ stroke: active ? COLOR_MAP[pn.color].stroke : "#3f3f4658", opacity: active ? 1 : 0.35 }}
                transition={{ duration: 0.3 }}
              />
            );
          })}

          {/* dispatch → 右列 handlers */}
          {["h_sh", "h_ap", "h_mc", "h_ld", "h_js"].map(hid => {
            const active = an.includes(hid) || ae.includes("dispatch->handlers");
            const hn = getNode(hid);
            const dispatch = getNode("dispatch");
            return (
              <motion.line key={hid}
                x1={dispatch.x + dispatch.w / 2} y1={dispatch.y + 4}
                x2={hn.x - hn.w / 2} y2={hn.y}
                strokeWidth={active ? 2.5 : 1.2}
                strokeDasharray={active ? "none" : "4 3"}
                markerEnd={`url(#m2${active ? `-${hn.color}` : ""})`}
                animate={{ stroke: active ? COLOR_MAP[hn.color].stroke : "#3f3f4558", opacity: active ? 1 : 0.3 }}
                transition={{ duration: 0.3 }}
              />
            );
          })}

          {/* result 回传箭头（右侧绕回到 fc 顶） */}
          <AnimatePresence>
            {ae.includes("result->back") && (
              <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                 <path
                  d={`M 840 610 L 920 610 L 920 60 L 840 60`}
                  fill="none" stroke="#10b981" strokeWidth={2.5} strokeDasharray="5 3"
                  markerEnd="url(#m2-green)"
                />
                 <text x={936} y={340} fontSize={16} fontFamily="monospace" fill="#10b981" textAnchor="middle"
                  transform="rotate(90,936,340)">工具结果 → 写入对话历史 → 下轮继续</text>
              </motion.g>
            )}
          </AnimatePresence>

          {/* 节点渲染 */}
          {NODES.map(n => {
            const active = an.includes(n.id);
            const cm = COLOR_MAP[n.color];
            const isSide = n.id.startsWith("p_") || n.id.startsWith("h_");
            const mainFontSize = isSide ? 16 : 18;
            const subFontSize  = isSide ? 14 : 16;
            return (
              <g key={n.id}>
                <motion.rect
                  x={n.x - n.w / 2} y={n.y - n.h / 2} width={n.w} height={n.h} rx={9}
                  animate={{ fill: active ? cm.fill : "#18181b", stroke: active ? cm.stroke : "#3f3f46" }}
                  strokeWidth={2} filter={active ? `url(#gl2-${n.color})` : "none"}
                  transition={{ duration: 0.35 }}
                />
                <motion.text x={n.x} y={n.sublabel ? n.y - 5 : n.y + 7} textAnchor="middle"
                  fontSize={mainFontSize} fontWeight={700} fontFamily="monospace"
                  animate={{ fill: active ? "#fff" : "#71717a" }} transition={{ duration: 0.35 }}>
                  {n.label}
                </motion.text>
                 {n.sublabel && (
                  <motion.text x={n.x} y={n.y + 18} textAnchor="middle"
                    fontSize={subFontSize} fontFamily="monospace"
                    animate={{ fill: active ? cm.stroke + "cc" : "#52525b" }} transition={{ duration: 0.35 }}>
                    {n.sublabel}
                  </motion.text>
                )}
              </g>
            );
          })}

          {/* RwLock 并行说明 */}
          <AnimatePresence>
            {an.includes("rwlock") && (
              <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <rect x={220} y={320} width={352} height={28} rx={5} fill="#0c3044" stroke="#06b6d4" strokeWidth={1.2} />
                <text x={396} y={340} textAnchor="middle" fontSize={16} fontFamily="monospace" fill="#06b6d4">
                  read → 多个工具可同时跑  write → 逐个串行执行
                </text>
              </motion.g>
            )}
          </AnimatePresence>
        </svg>
      </div>

      {/* ── 日志 + 步骤说明 ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
          <div className="mb-2 font-mono text-xs text-zinc-500">dispatch log</div>
          <div className="min-h-[160px] overflow-auto rounded-md border border-zinc-800 bg-zinc-950 p-3">
            <AnimatePresence mode="popLayout">
              {visibleEvents.length === 0 ? (
                <motion.div key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="py-6 text-center text-xs text-zinc-600">— 等待工具调用 —</motion.div>
              ) : visibleEvents.map((ev, i) => {
                const isComment = ev.startsWith("//");
                const isKey = /^[A-Z][a-zA-Z]+Handler/.test(ev) || ev.startsWith("ToolPayload") || ev.startsWith("Ok(") || ev.startsWith("AnyToolResult");
                return (
                  <motion.div key={`${i}-${ev.slice(0, 14)}`}
                    initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.025 }}
                    className={`font-mono text-[10px] leading-relaxed ${isComment ? "text-zinc-600" : isKey ? "text-orange-400" : "text-zinc-400"}`}>
                    {ev}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={viz.currentStep}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}
            className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
            <div className="mb-1 text-base font-semibold text-zinc-100">{step.title}</div>
            <div className="text-sm leading-relaxed text-zinc-400">{step.desc}</div>
            <div className="mt-3 font-mono text-[11px] text-zinc-600">{step.file}</div>
          </motion.div>
        </AnimatePresence>
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
