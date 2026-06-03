"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useSteppedVisualization } from "@/hooks/useSteppedVisualization";
import { StepControls } from "@/components/visualizations/shared/step-controls";

// ─── 节点定义（ViewBox 0 0 1280 580）──────────────────────────────────────
// 四行布局：顶行→中行（采样循环）→决策→分支
// 行间距加大，节点加宽，字体加大到 18/14px
interface NodeDef {
  id: string;
  label: string;
  sublabel?: string;
  x: number; y: number; w: number; h: number;
  shape?: "diamond";
  color: "blue" | "cyan" | "yellow" | "purple" | "green" | "orange";
}

const NODES: NodeDef[] = [
  // ── 顶行 y=96
  { id: "input",    label: "用户发来消息",             sublabel: "UserInput · submit_input()",              x: 110, y: 96,  w: 200, h: 62, color: "blue"   },
  { id: "pre",      label: "检查 Token 预算",           sublabel: "run_pre_compact()",                       x: 378, y: 96,  w: 236, h: 62, color: "blue"   },
  { id: "build",    label: "组装对话历史",              sublabel: "clone_history().for_prompt()",            x: 724, y: 96,  w: 296, h: 62, color: "blue"   },
  // ── 中行 y=278（采样循环）
  { id: "sampling", label: "向模型发请求（含重试）",    sublabel: "run_sampling_request()",                  x: 226, y: 278, w: 270, h: 62, color: "cyan"   },
  { id: "stream",   label: "接收流式回复",              sublabel: "client_session.stream() · SSE",           x: 618, y: 278, w: 250, h: 62, color: "cyan"   },
  { id: "inflight", label: "并行执行工具调用",          sublabel: "FuturesOrdered · 不阻塞流式接收",         x: 1004, y: 278, w: 232, h: 62, color: "orange" },
  // ── 决策 y=432
  { id: "follow",   label: "needs_follow_up?",          sublabel: "",                                        x: 640, y: 432, w: 280, h: 76, shape: "diamond", color: "yellow" },
  // ── 分支 y=538
  { id: "compact",  label: "压缩历史，继续循环",        sublabel: "run_auto_compact() · mid-turn",           x: 184, y: 538, w: 232, h: 60, color: "purple" },
  { id: "done",     label: "本轮对话结束",              sublabel: "stop_hooks() → break",                   x: 1102, y: 538, w: 226, h: 60, color: "green"  },
];

const COLOR_MAP = {
  blue:   { fill: "#1e3a5f", stroke: "#3b82f6" },
  cyan:   { fill: "#0c3044", stroke: "#06b6d4" },
  yellow: { fill: "#422006", stroke: "#f59e0b" },
  purple: { fill: "#2e1065", stroke: "#a855f7" },
  green:  { fill: "#052e16", stroke: "#10b981" },
  orange: { fill: "#431407", stroke: "#f97316" },
};

const ACTIVE_NODES: string[][] = [
  [],
  ["input"],
  ["pre"],
  ["build"],
  ["sampling"],
  ["stream"],
  ["stream"],
  ["stream", "inflight"],
  ["inflight"],
  ["follow"],
  ["compact", "build"],
  ["done"],
];

const ACTIVE_EDGES: string[][] = [
  [],
  [],
  ["input->pre"],
  ["pre->build"],
  ["build->sampling"],
  ["sampling->stream"],
  [],
  ["stream->inflight"],
  ["inflight->follow"],
  ["stream->follow"],
  ["follow->compact", "compact->build"],
  ["follow->done"],
];

const EVENTS: string[][] = [
  [],
  ['UserInput::Text("修复 auth.rs 中的类型错误")'],
  ["// pre-sampling compaction check...", "// total_tokens < limit → skip"],
  ["// building ResponseItem[]", "// from session history (n=3 messages)"],
  ["// entering retry loop  retries=0", "// try_run_sampling_request(...)"],
  ["ResponseEvent::Created"],
  [
    "ResponseEvent::Created",
    "OutputItemAdded { type: message, id: msg_01 }",
    "OutputItemDelta { delta: '我来检查' }",
    "OutputItemDelta { delta: ' auth.rs...' }",
  ],
  [
    "OutputItemDone(AssistantMessage)",
    "OutputItemAdded { type: function_call }",
    "  name: shell, call_id: call_01",
    "→ in_flight.push_back(shell_future)",
    "  // 非阻塞！继续 poll stream",
  ],
  [
    "// FuturesOrdered polling...",
    "shell_future.await → Ok(stdout)",
    "history.push(ToolResult {",
    "  call_id: call_01,",
    '  output: "error[E0308]: ..."',
    "})",
  ],
  [
    "ResponseEvent::Completed {",
    "  usage: { input: 1832, output: 47 }",
    "}",
    "→ SamplingRequestResult {",
    "    needs_follow_up: true,",
    "    last_agent_message: None,",
    "  }",
  ],
  [
    "// total_usage_tokens >= auto_compact_limit",
    "// → CompactionReason::ContextLimit",
    "run_auto_compact(...).await",
    "client_session.reset_websocket_session()",
    "// continue  →  回到 clone_history()",
  ],
  [
    "SamplingRequestResult {",
    "  needs_follow_up: false,",
    "}",
    "// stop_reason = end_turn",
    "sess.hooks().run_stop(...).await",
    "// break  →  turn 完成",
  ],
];

const STEP_INFO = [
  { title: "turn.rs 双层循环架构", desc: "run_turn() 是外层，控制整个 turn 的推进；run_sampling_request() + try_run_sampling_request() 是内层，负责单次采样与流处理。两层职责分离是 Codex 的核心设计。", file: "core/src/codex/turn.rs:129" },
  { title: "UserInput 进入", desc: "用户输入以 Vec<UserInput> 传入 run_turn()。input 为空且无 pending_input 时直接 return None，不发起任何采样请求。", file: "turn.rs:136" },
  { title: "预紧缩检查", desc: "run_pre_sampling_compact() 在采样前检查上轮积累的 Token 量。历史超限时先压缩再采样，避免 ContextWindowExceeded 错误。", file: "turn.rs:147" },
  { title: "构建采样输入", desc: "sess.clone_history().for_prompt(input_modalities) 将会话历史转为 ResponseItem[]，按模型支持的 modality 过滤，作为本次 API 请求的输入。", file: "turn.rs:436" },
  { title: "run_sampling_request()：重试包装", desc: "这一层只做两件事：网络断开时指数退避重试，超出 max_retries 后尝试从 WebSocket 切换到 HTTPS。与业务逻辑完全分离。", file: "turn.rs:1028" },
  { title: "client_session.stream() 建立 SSE", desc: "try_run_sampling_request() 调用 stream() 向 Responses API 发起请求，返回 async stream<ResponseEvent>。or_cancel() 包装确保 CancellationToken 触发时安全退出。", file: "turn.rs:1846" },
  { title: "OutputItemDelta：实时文本流", desc: "ResponseEvent::OutputItemDelta 携带模型生成的文本增量。经 AssistantTextStreamParser 处理后，通过 AgentEvent 推送给 TUI 和 app-server 实时展示。", file: "turn.rs:1908" },
  { title: "FunctionCall → FuturesOrdered（非阻塞并行）", desc: "OutputItemDone(FunctionCall) 时，Codex 不等待工具结果——直接 in_flight.push_back(tool_future)。工具与后续 SSE 事件并行执行，这是 Codex 的关键性能设计。", file: "turn.rs:1955" },
  { title: "FuturesOrdered 收割结果", desc: "in_flight: FuturesOrdered<BoxFuture<CodexResult<ResponseInputItem>>>，按提交顺序依次完成。多个工具调用真正并发，结果写回 history 供下次采样使用。", file: "turn.rs:1859" },
  { title: "needs_follow_up 决策", desc: "Completed 后返回 SamplingRequestResult。needs_follow_up = true 表示本次有工具调用（结果需回传给模型）或 session 有 pending_input。", file: "turn.rs:466" },
  { title: "Token limit → auto_compact → continue", desc: "total_usage_tokens >= auto_compact_limit 且 needs_follow_up 时，mid-turn 触发 run_auto_compact(CompactionReason::ContextLimit)，压缩后 reset WebSocket session，continue 继续外层循环。", file: "turn.rs:492" },
  { title: "end_turn → stop_hooks → break", desc: "needs_follow_up = false 时，运行 hooks().run_stop()。stop hook 可注入新提示使循环继续，否则 break 出外层循环，turn 完成。", file: "turn.rs:510" },
];

// ─── 边路径（对应新位置）──────────────────────────────────────────────────
function getNode(id: string) { return NODES.find((n) => n.id === id)!; }

function edgePath(fromId: string, toId: string): string {
  const f = getNode(fromId);
  const t = getNode(toId);
  const fx = f.x, fy = f.y, fw = f.w, fh = f.h;
  const tx = t.x, ty = t.y, tw = t.w, th = t.h;

  // 顶行水平连接
  if (fromId === "input"    && toId === "pre")    return `M ${fx+fw/2} ${fy} L ${tx-tw/2} ${ty}`;
  if (fromId === "pre"      && toId === "build")  return `M ${fx+fw/2} ${fy} L ${tx-tw/2} ${ty}`;
  // 中行水平连接
  if (fromId === "sampling" && toId === "stream") return `M ${fx+fw/2} ${fy} L ${tx-tw/2} ${ty}`;
  if (fromId === "stream"   && toId === "inflight") return `M ${fx+fw/2} ${fy} L ${tx-tw/2} ${ty}`;

  // build → sampling（下 → 左 → 下，跨两行）
  if (fromId === "build" && toId === "sampling") {
    const mid = 170;
    return `M ${fx} ${fy+fh/2} L ${fx} ${mid} L ${tx} ${mid} L ${tx} ${ty-th/2}`;
  }
  // stream → follow（下 → 右微调 → 下到菱形顶点）
  if (fromId === "stream" && toId === "follow") {
    const mid = 368;
    return `M ${fx} ${fy+fh/2} L ${fx} ${mid} L ${tx} ${mid} L ${tx} ${ty-th/2}`;
  }
  // inflight → follow（下 → 左 → 菱形右顶点）
  if (fromId === "inflight" && toId === "follow") {
    return `M ${fx} ${fy+fh/2} L ${fx} ${ty} L ${tx+tw/2} ${ty}`;
  }
  // follow → compact（菱形左顶 → 左 → 下）
  if (fromId === "follow" && toId === "compact") {
    return `M ${fx-fw/2} ${fy} L ${tx} ${fy} L ${tx} ${ty-th/2}`;
  }
  // follow → done（菱形右顶 → 右 → 下）
  if (fromId === "follow" && toId === "done") {
    return `M ${fx+fw/2} ${fy} L ${tx} ${fy} L ${tx} ${ty-th/2}`;
  }
  // compact → build（环回：上 → 左沿 x=22 → 上 → 右 → build 左边入）
  if (fromId === "compact" && toId === "build") {
    const lx = 22;
    return `M ${fx} ${fy-fh/2} L ${lx} ${fy-fh/2} L ${lx} 22 L ${tx-tw/2} 22 L ${tx-tw/2} ${ty}`;
  }
  return `M ${fx} ${fy+fh/2} L ${tx} ${ty-th/2}`;
}

// ─── 主组件 ────────────────────────────────────────────────────────────────
export default function AgentLoopVisualization() {
  const viz = useSteppedVisualization({ totalSteps: 12, autoPlayInterval: 2800 });
  const an = ACTIVE_NODES[viz.currentStep];
  const ae = ACTIVE_EDGES[viz.currentStep];
  const step = STEP_INFO[viz.currentStep];

  const allEvents: string[] = [];
  for (let s = 1; s <= viz.currentStep; s++) {
    if (EVENTS[s].length > 0) allEvents.push(...EVENTS[s]);
  }
  const visibleEvents = allEvents.slice(-8);

  return (
    <section className="space-y-4">

      {/* ── SVG 流程图 ── */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
        <div className="mb-2 flex items-center gap-2 font-mono text-xs text-zinc-500">
          <span className="text-blue-400">core/src/codex/</span>turn.rs
        </div>

        <svg
          viewBox="0 0 1280 580"
          className="w-full rounded-md border border-zinc-800 bg-zinc-950"
          style={{ maxHeight: "560px" }}
        >
          <defs>
            {(["blue","cyan","yellow","purple","green","orange"] as const).map((c) => (
              <filter key={c} id={`gl1-${c}`}>
                <feDropShadow dx="0" dy="0" stdDeviation="7" floodColor={COLOR_MAP[c].stroke} floodOpacity="0.8" />
              </filter>
            ))}
            <marker id="m1" markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto">
              <polygon points="0 0,10 4,0 8" fill="#52525b" />
            </marker>
            {(["blue","cyan","purple","green","orange","yellow"] as const).map((c) => (
              <marker key={c} id={`m1-${c}`} markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto">
                <polygon points="0 0,10 4,0 8" fill={COLOR_MAP[c].stroke} />
              </marker>
            ))}
          </defs>

          {/* 外层 run_turn 框 */}
          <motion.rect x="8" y="14" width="1264" height="558" rx="14"
            fill="none" strokeDasharray="8 5" strokeWidth={2}
            animate={{ stroke: viz.currentStep >= 1 ? "#3b82f6" : "#3b82f655" }}
            transition={{ duration: 0.5 }} />
          {/* 背景遮住框线，避免文字与虚线重叠 */}
          <rect x="14" y="18" width="440" height="22" fill="#09090b" />
          <text x="22" y="35" fontSize={16} fontFamily="monospace" fill="#93c5fd">外层循环 run_turn()  — 控制整个 turn 的推进</text>

          {/* 内层 retry 框（覆盖 sampling + stream），上移并加高留出文字空间 */}
          <motion.rect x="74" y="222" width="668" height="100" rx="10"
            fill="none" strokeDasharray="5 3" strokeWidth={1.8}
            animate={{ stroke: an.includes("sampling") || an.includes("stream") ? "#06b6d4" : "#06b6d488" }}
            transition={{ duration: 0.4 }} />
          <rect x="78" y="214" width="534" height="18" fill="#09090b" />
          <text x="82" y="228" fontSize={16} fontFamily="monospace" fill="#a5f3fc">内层重试循环 run_sampling_request()  — 网络失败自动重试</text>

          {/* ── 边 ── */}
          {[
            { from: "input",    to: "pre",      label: "" },
            { from: "pre",      to: "build",    label: "" },
            { from: "build",    to: "sampling", label: "" },
            { from: "sampling", to: "stream",   label: "" },
            { from: "stream",   to: "inflight", label: "收到工具调用" },
            { from: "inflight", to: "follow",   label: "" },
            { from: "stream",   to: "follow",   label: "" },
            { from: "follow",   to: "compact",  label: "true · Token 超限" },
            { from: "follow",   to: "done",     label: "false · end_turn" },
            { from: "compact",  to: "build",    label: "继续下一轮" },
          ].map(({ from, to, label }) => {
            const key = `${from}->${to}`;
            const active = ae.includes(key);
            const nc = getNode(from).color;
            const markerSuffix = active ? `-${nc}` : "";
            return (
              <g key={key}>
                <motion.path
                  d={edgePath(from, to)} fill="none"
                  strokeDasharray={from === "compact" ? "6 4" : undefined}
                  strokeWidth={active ? 3 : 1.8}
                  markerEnd={`url(#m1${markerSuffix})`}
                  animate={{ stroke: active ? COLOR_MAP[nc].stroke : "#3f3f46", opacity: active ? 1 : 0.45 }}
                  transition={{ duration: 0.4 }}
                />
                {label && active && (
                  <motion.text
                     x={
                      from === "compact"                      ? 90   :
                      from === "follow" && to === "done"      ? 944  :
                      from === "follow"                       ? 346  :
                      from === "stream" && to === "inflight"  ? 816  :
                      (getNode(from).x + getNode(to).x) / 2
                    }
                    y={
                      from === "compact"                      ? 345  :
                      from === "follow"                       ? 422  :
                      from === "stream" && to === "inflight"  ? 264  :
                      (getNode(from).y + getNode(to).y) / 2 - 6
                    }
                     textAnchor="middle" fontSize={18} fontFamily="monospace"
                    fill={COLOR_MAP[nc].stroke}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  >
                    {label}
                  </motion.text>
                )}
              </g>
            );
          })}

          {/* ── 节点 ── */}
          {NODES.map((n) => {
            const active = an.includes(n.id);
            const cm = COLOR_MAP[n.color];
            const isDiamond = n.shape === "diamond";

            if (isDiamond) {
              const hw = n.w / 2, hh = n.h / 2;
              return (
                <g key={n.id}>
                  <motion.polygon
                    points={`${n.x},${n.y - hh} ${n.x + hw},${n.y} ${n.x},${n.y + hh} ${n.x - hw},${n.y}`}
                    animate={{ fill: active ? cm.fill : "#18181b", stroke: active ? cm.stroke : "#3f3f46" }}
                    strokeWidth={2.5} filter={active ? `url(#gl1-${n.color})` : "none"}
                    transition={{ duration: 0.4 }}
                  />
                  <motion.text x={n.x} y={n.y + 8} textAnchor="middle"
                    fontSize={18} fontWeight={700} fontFamily="monospace"
                    animate={{ fill: active ? "#fff" : "#71717a" }} transition={{ duration: 0.4 }}>
                    {n.label}
                  </motion.text>
                </g>
              );
            }

            return (
              <g key={n.id}>
                <motion.rect
                  x={n.x - n.w / 2} y={n.y - n.h / 2} width={n.w} height={n.h} rx={10}
                  animate={{ fill: active ? cm.fill : "#18181b", stroke: active ? cm.stroke : "#3f3f46" }}
                  strokeWidth={2.5} filter={active ? `url(#gl1-${n.color})` : "none"}
                  transition={{ duration: 0.4 }}
                />
                <motion.text x={n.x} y={n.sublabel ? n.y - 6 : n.y + 8} textAnchor="middle"
                  fontSize={18} fontWeight={700} fontFamily="monospace"
                  animate={{ fill: active ? "#fff" : "#71717a" }} transition={{ duration: 0.4 }}>
                  {n.label}
                </motion.text>
                 {n.sublabel && (
                  <motion.text x={n.x} y={n.y + 20} textAnchor="middle"
                    fontSize={12} fontFamily="monospace"
                    animate={{ fill: active ? cm.stroke + "cc" : "#52525b" }} transition={{ duration: 0.4 }}>
                    {n.sublabel}
                  </motion.text>
                )}
              </g>
            );
          })}

          {/* 并行标注徽章 */}
          <AnimatePresence>
            {an.includes("inflight") && (
              <motion.g initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <rect x={840} y={228} width={224} height={28} rx={5} fill="#431407" stroke="#f97316" strokeWidth={1.2} />
                <text x={952} y={248} textAnchor="middle" fontSize={16} fontFamily="monospace" fill="#f97316">
                  工具与流式回复同时进行
                </text>
              </motion.g>
            )}
          </AnimatePresence>

          {/* 外层循环迭代计数 */}
          <AnimatePresence>
            {viz.currentStep >= 10 && (
              <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <rect x={26} y={40} width={100} height={28} rx={5} fill="#2e1065" stroke="#a855f7" strokeWidth={1.2} />
                <text x={76} y={58} textAnchor="middle" fontSize={15} fontFamily="monospace" fill="#a855f7">外层第2轮</text>
              </motion.g>
            )}
          </AnimatePresence>
        </svg>
      </div>

      {/* ── 事件日志 + 步骤说明 ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
          <div className="mb-2 font-mono text-xs text-zinc-500">ResponseEvent stream</div>
          <div className="min-h-[160px] overflow-auto rounded-md border border-zinc-800 bg-zinc-950 p-3">
            <AnimatePresence mode="popLayout">
              {visibleEvents.length === 0 ? (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="py-6 text-center text-xs text-zinc-600">— 等待用户输入 —</motion.div>
              ) : visibleEvents.map((ev, i) => {
                const isComment = ev.startsWith("//");
                const isRustEvent = ev.startsWith("ResponseEvent") || ev.startsWith("OutputItem") || ev.startsWith("SamplingRequest");
                const isArrow = ev.startsWith("→");
                const isBrace = ev.startsWith("}") || ev.startsWith("{");
                return (
                  <motion.div key={`${i}-${ev.slice(0, 16)}`}
                    initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.03 }}
                    className={`font-mono text-[11px] leading-relaxed ${
                      isComment  ? "text-zinc-600" :
                      isArrow    ? "text-orange-400" :
                      isRustEvent? "text-cyan-400" :
                      isBrace    ? "text-zinc-500" :
                      "text-zinc-400"
                    }`}
                  >
                    {ev}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={viz.currentStep}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}
            className="rounded-lg border border-zinc-700 bg-zinc-900 p-4"
          >
            <div className="mb-2 text-base font-semibold text-zinc-100">{step.title}</div>
            <div className="text-sm leading-relaxed text-zinc-400">{step.desc}</div>
            <div className="mt-3 font-mono text-xs text-zinc-600">{step.file}</div>
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
