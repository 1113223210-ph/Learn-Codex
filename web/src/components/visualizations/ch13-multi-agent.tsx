"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useSteppedVisualization } from "@/hooks/useSteppedVisualization";
import { StepControls } from "@/components/visualizations/shared/step-controls";

// ─── ch13 多 Agent 系统 — 动态流程图（仿 ch01 模式）────────────────────────
//
// 节点布局（viewBox 0 0 1280 560）：
//
//  [父Agent] ──spawn──→ [AgentControl] ──创建──→ [ThreadSpawn]
//      │                                         [MemoryConsolidation]
//      │ (同属父线程)                             [Review]
//      ↕ 父线程读取                               [Other/CSV]
//  [Mailbox] ←── 完成通知 ────────────────────────────←┘
//                                                       ↓
//                                               [客户端可见]
//
// 每步高亮对应节点 + 边，下方事件日志同步更新

interface NodeDef {
  id: string;
  label: string;
  sublabel?: string;
  x: number; y: number; w: number; h: number;
  color: "green" | "amber" | "violet" | "sky" | "rose" | "zinc";
}

const NODES: NodeDef[] = [
  // 左列  x=130（中心）
  { id: "parent",  label: "父 Agent",           sublabel: "主线程 · spawn_agent 工具",           x: 130, y:  90, w: 220, h: 60, color: "green"  },
  { id: "mailbox", label: "Mailbox",              sublabel: "mailbox.rs · mpsc + watch<u64>",      x: 130, y: 250, w: 220, h: 60, color: "violet" },
  // 中列  x=420（中心）
  { id: "control", label: "AgentControl",        sublabel: "control.rs:132 · 同根树共享",         x: 420, y: 170, w: 220, h: 60, color: "amber"  },
  { id: "client",  label: "客户端可见",            sublabel: "CollabAgentToolCall · v2.rs:4631",    x: 420, y: 320, w: 220, h: 60, color: "sky"    },
  // 右列  x=835（中心），间距80px，从y=80开始
  { id: "spawn",   label: "ThreadSpawn",          sublabel: "模型主动 spawn",                      x: 835, y:  80, w: 230, h: 56, color: "green"  },
  { id: "memory",  label: "MemoryConsolidation",  sublabel: "Phase2 记忆整合",                     x: 835, y: 160, w: 230, h: 56, color: "violet" },
  { id: "review",  label: "Review",               sublabel: "代码审查",                            x: 835, y: 240, w: 230, h: 56, color: "sky"    },
  { id: "csv",     label: "Other / CSV worker",   sublabel: "agent_job:<id>",                      x: 835, y: 320, w: 230, h: 56, color: "amber"  },
];

const COLOR_MAP: Record<NodeDef["color"], { fill: string; stroke: string }> = {
  green:  { fill: "#0d1f0d", stroke: "#10b981" },
  amber:  { fill: "#1a1008", stroke: "#f59e0b" },
  violet: { fill: "#100a1f", stroke: "#8b5cf6" },
  sky:    { fill: "#03131f", stroke: "#0ea5e9" },
  rose:   { fill: "#1f080c", stroke: "#f43f5e" },
  zinc:   { fill: "#111",    stroke: "#52525b" },
};

// 每步激活的节点
const ACTIVE_NODES: string[][] = [
  [],                                          // 0 概览
  ["parent", "control"],                       // 1 spawn_agent 调用
  ["control", "spawn"],                        // 2 创建 ThreadSpawn
  ["control", "memory"],                       // 3 创建 MemoryConsolidation
  ["control", "review"],                       // 4 创建 Review
  ["control", "csv"],                          // 5 创建 CSV worker
  ["spawn", "mailbox", "parent"],              // 6 完成通知 → Mailbox
  ["mailbox", "parent"],                       // 7 父 Agent 读取 Mailbox
  ["spawn", "client"],                         // 8 app-server 协议事件
];

// 每步激活的边
const ACTIVE_EDGES: string[][] = [
  [],
  ["parent->control"],
  ["control->spawn"],
  ["control->memory"],
  ["control->review"],
  ["control->csv"],
  ["spawn->mailbox"],
  ["mailbox->parent"],
  ["spawn->client"],
];

// 每步事件日志
const EVENTS: string[][] = [
  [],
  [
    "// Feature::Collab (key=multi_agent) 已启用",
    "// 向模型提供 spawn_agent 工具集",
    "spawn_agent {",
    "  task_name: \"auth-service-docs\",",
    "  message: \"分析 services/auth/...\",",
    "  fork_turns: \"none\"",
    "}",
  ],
  [
    "// control.rs:151 spawn_agent_internal()",
    "01 reserve_spawn_slot()      → slot=3",
    "02 inherited_shell_snapshot() → Ok",
    "03 apply_spawn_agent_runtime_overrides()",
    "   sandbox_policy: WorkspaceWrite",
    "   approval_policy: inherited",
    "04 prepare_thread_spawn()",
    "   agent_path: /root/main/auth-service-docs",
  ],
  [
    "// SubAgentSource::MemoryConsolidation",
    "// core/src/memories/phase2.rs:139",
    "spawn_agent_internal(",
    "  session_source: Some(",
    "    SubAgentSource::MemoryConsolidation",
    "  ),",
    "  config.model: \"gpt-5.4\"",
    ")",
  ],
  [
    "// SubAgentSource::Review",
    "// core/src/tasks/review.rs:131",
    "spawn_agent_internal(",
    "  session_source: Some(",
    "    SubAgentSource::Review",
    "  ),",
    ")",
    "→ thread/started 通知发给所有客户端",
  ],
  [
    "// Feature::SpawnCsv (key=enable_fanout)",
    "spawn_agents_on_csv(",
    "  csv_path: \"repos.csv\",",
    "  max_concurrency: 16",
    ")",
    "→ 每行创建 AgentJobItem (SQLite)",
    "→ SubAgentSource::Other(\"agent_job:<id>\")",
    "→ 并发 spawn worker 子 Agent",
  ],
  [
    "// maybe_start_completion_watcher()",
    "// control.rs:898 — tokio::spawn 独立监听",
    "wait_for_final_status(",
    "  subscribe_status(child_thread_id)",
    ").await",
    "// 子 Agent 完成，写入父 Mailbox：",
    "send_inter_agent_communication(",
    "  parent_thread_id, communication",
    ")",
  ],
  [
    "// 父 Agent wait_agent 工具返回",
    "// V2: watch::Receiver<u64> seq number",
    "// V1: watch::Receiver<AgentStatus>",
    "wait_agent result: {",
    "  timed_out: false,",
    "  completed: [\"auth-service-docs\"]",
    "}",
    "inject_user_message_without_turn(...)",
  ],
  [
    "// app-server-protocol/v2.rs:4631",
    "ServerNotification::CollabAgentToolCall {",
    "  tool: CollabAgentTool::SpawnAgent,",
    "  status: CollabAgentToolCallStatus::Completed,",
    "  agents_states: {",
    "    thread_id: CollabAgentStatus::Completed",
    "  }",
    "}",
    "// thread/started · thread/status/changed",
  ],
];

const STEP_INFO = [
  { title: "多 Agent 系统架构", desc: "AgentControl 是所有同根 Agent 的共享控制平面。父 Agent 通过 spawn_agent 工具创建子 Agent，子 Agent 完成后向父线程的 Mailbox 写入通知，客户端通过 app-server 协议实时感知状态变化。", file: "core/src/agent/control.rs:132" },
  { title: "spawn_agent 工具调用", desc: "模型调用 spawn_agent（V2 格式，task_name 必填）。AgentControl::spawn_agent() 内部执行六步流程：reserve_spawn_slot → inherited_shell_snapshot → apply_runtime_overrides → prepare_thread_spawn → spawn_new_thread → send_input。", file: "control.rs:151" },
  { title: "创建 ThreadSpawn 子 Agent", desc: "SubAgentSource::ThreadSpawn 是模型主动 spawn 的变体，包含 parent_thread_id、depth、agent_path、agent_nickname。fork_turns=none 表示子 Agent history 完全隔离，不复制父线程上下文。", file: "protocol/src/protocol.rs:2629" },
  { title: "MemoryConsolidation 子 Agent", desc: "Phase2 记忆整合使用 SubAgentSource::MemoryConsolidation。这是 spawn_agent 的内部用例，由 memories/phase2.rs 触发，使用 gpt-5.4 + ReasoningEffort::Medium，CWD 指向 ~/.codex/memories/。", file: "core/src/memories/phase2.rs:139" },
  { title: "Review 子 Agent", desc: "代码审查使用 SubAgentSource::Review，由 tasks/review.rs:131 触发。每次 spawn 都会发送 thread/started 通知给所有 app-server 客户端，客户端可订阅新线程事件。", file: "core/src/tasks/review.rs:131" },
  { title: "CSV worker 子 Agent", desc: "Feature::SpawnCsv（key=enable_fanout，默认关闭）。spawn_agents_on_csv 解析 CSV，为每行创建 AgentJobItem 写入 SQLite，最多 max_concurrency=16（上限64）个 worker 并发。worker 用 SubAgentSource::Other(\"agent_job:<id>\") 标识。", file: "tools/src/agent_job_tool.rs" },
  { title: "完成通知 → Mailbox", desc: "maybe_start_completion_watcher()（control.rs:898）启动独立 tokio::spawn task，通过 watch::Receiver<AgentStatus> 监听子 Agent 状态。完成后调用 send_inter_agent_communication() 向父线程 Mailbox 写入通知。", file: "control.rs:898" },
  { title: "父 Agent 读取 Mailbox", desc: "V2 模式：wait_agent 工具订阅 mailbox seq number（watch::Receiver<u64>），任何子 Agent 发消息即触发。V1 模式：直接 watch AgentStatus channel。返回后通过 inject_user_message_without_turn 将完成信息注入父对话历史。", file: "multi_agents_v2/wait.rs:40" },
  { title: "app-server 协议事件", desc: "所有客户端通过 CollabAgentToolCall 事件（v2.rs:4631）实时感知：SpawnAgent/SendInput/Wait/CloseAgent 操作，以及每个子 Agent 的状态（PendingInit → Running → Completed）。", file: "app-server-protocol/src/protocol/v2.rs:4631" },
];

// ─── 节点查找辅助 ─────────────────────────────────────────────────────────────
function getNode(id: string) { return NODES.find(n => n.id === id)!; }

// ─── 边路径计算 ───────────────────────────────────────────────────────────────
function edgePath(fromId: string, toId: string): string {
  const f = getNode(fromId);
  const t = getNode(toId);

  // parent → control：parent 右边出发 → 水平到 control 正上方 x → 向下进入 control 正上边
  if (fromId === "parent" && toId === "control")
    return `M ${f.x+f.w/2} ${f.y} L ${t.x} ${f.y} L ${t.x} ${t.y-t.h/2}`;

  // control → 各子 Agent：control 右边中心 → 水平到子Agent左边中心
  if (fromId === "control" && ["spawn","memory","review","csv"].includes(toId))
    return `M ${f.x+f.w/2} ${f.y} L ${t.x-t.w/2} ${t.y}`;

  // spawn → mailbox：终点改为 mailbox 底边（可见箭头）
  if (fromId === "spawn" && toId === "mailbox")
    return `M ${f.x+f.w/2} ${f.y} L 965 ${f.y} L 965 410 L ${t.x} 410 L ${t.x} ${t.y+t.h/2}`;

  // mailbox → parent：从 mailbox 顶边垂直向上，直接进入 parent 底边
  if (fromId === "mailbox" && toId === "parent")
    return `M ${f.x} ${f.y-f.h/2} L ${t.x} ${t.y+t.h/2}`;

  // spawn → client：从右边出发，沿 x=900 竖线（与完成通知重合）→ 在 y=410 处 → 向左到 client 正中心 x → 向上进入 client 正下边
  if (fromId === "spawn" && toId === "client")
    return `M ${f.x+f.w/2} ${f.y} L 965 ${f.y} L 965 410 L ${t.x} 410 L ${t.x} ${t.y+t.h/2}`;

  return `M ${f.x} ${f.y} L ${t.x} ${t.y}`;
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────
export default function MultiAgentVisualization() {
  const viz = useSteppedVisualization({ totalSteps: STEP_INFO.length, autoPlayInterval: 3500 });
  const an = ACTIVE_NODES[viz.currentStep];
  const ae = ACTIVE_EDGES[viz.currentStep];
  const step = STEP_INFO[viz.currentStep];

  // 累积事件日志（最多显示最近 8 条）
  const allEvents: string[] = [];
  for (let s = 1; s <= viz.currentStep; s++) {
    if (EVENTS[s].length > 0) allEvents.push(...EVENTS[s]);
  }
  const visibleEvents = allEvents.slice(-8);

  const edges = [
    { from: "parent",  to: "control", label: "spawn"   },
    { from: "control", to: "spawn",   label: "创建"    },
    { from: "control", to: "memory",  label: "创建"    },
    { from: "control", to: "review",  label: "创建"    },
    { from: "control", to: "csv",     label: "创建"    },
    { from: "spawn",   to: "mailbox", label: "完成通知" },
    { from: "mailbox", to: "parent",  label: "读取"    },
    { from: "spawn",   to: "client",  label: "协议事件" },
  ];

  return (
    <section className="space-y-4">
      {/* SVG 动态流程图 */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
        <div className="mb-2 font-mono text-xs text-zinc-500">
          <span className="text-emerald-400">core/src/agent/</span>
          {" · "}
          <span className="text-sky-400">tools/src/agent_tool.rs</span>
          {" · "}
          <span className="text-amber-400">app-server-protocol/v2.rs:4631</span>
        </div>
        <svg viewBox="0 0 980 502" className="w-full rounded-md border border-zinc-800 bg-zinc-950">
          <defs>
            {(Object.entries(COLOR_MAP) as [NodeDef["color"], {fill:string;stroke:string}][]).map(([c, cm]) => (
              <filter key={c} id={`gl13-${c}`}>
                <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={cm.stroke} floodOpacity="0.9"/>
              </filter>
            ))}
            <marker id="ma13" markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto">
              <polygon points="0 0,10 4,0 8" fill="#52525b"/>
            </marker>
            {(Object.entries(COLOR_MAP) as [NodeDef["color"], {fill:string;stroke:string}][]).map(([c, cm]) => (
              <marker key={c} id={`ma13-${c}`} markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto">
                <polygon points="0 0,10 4,0 8" fill={cm.stroke}/>
              </marker>
            ))}
          </defs>

          {/* 外框 */}
          <rect x="8" y="8" width="964" height="486" rx="12" fill="none"
            stroke="#10b98128" strokeWidth={1.5} strokeDasharray="8 5"/>

          {/* 子 Agent 分组虚线框
              右列 x=835 w=230 → 左=720 右=950
              y: spawn顶=52, csv底=348 → padding8 → y=44, h=312 */}
          <motion.rect x="712" y="44" width="252" height="312" rx="10" fill="none"
            strokeDasharray="5 3" strokeWidth={1.5}
            animate={{ stroke: an.some(n=>["spawn","memory","review","csv"].includes(n)) ? "#71717a" : "#27272a" }}
            transition={{ duration: 0.4 }}/>
          <rect x="716" y="36" width="80" height="16" fill="#09090b"/>
          <text x="720" y="48" fontSize={11} fontFamily="monospace" fill="#52525b">子 Agent 列</text>

          {/* ── 边 ── */}
          {edges.map(({ from, to, label }) => {
            const key = `${from}->${to}`;
            const active = ae.includes(key);
            const nc = getNode(from).color;
            return (
              <g key={key}>
                <motion.path
                  d={edgePath(from, to)}
                  fill="none"
                  strokeWidth={active ? 2.5 : 1.5}
                  markerEnd={`url(#ma13${active ? `-${nc}` : ""})`}
                  animate={{
                    stroke: active ? COLOR_MAP[nc].stroke : "#3f3f46",
                    opacity: active ? 1 : 0.35,
                  }}
                  transition={{ duration: 0.4 }}
                />
                {label && active && (() => {
                  const lx =
                    from==="parent"  && to==="control" ? 275  :
                    from==="control" && to==="spawn"   ? 625  :
                    from==="control" && to==="memory"  ? 625  :
                    from==="control" && to==="review"  ? 625  :
                    from==="control" && to==="csv"     ? 625  :
                    from==="spawn"   && to==="mailbox" ? 580  :
                    from==="mailbox" && to==="parent"  ? 152  :
                    from==="spawn"   && to==="client"  ? 680  : 400;
                  const ly =
                    from==="parent"  && to==="control" ? 84   :
                    from==="control" && to==="spawn"   ? 120  :
                    from==="control" && to==="memory"  ? 163  :
                    from==="control" && to==="review"  ? 206  :
                    from==="control" && to==="csv"     ? 246  :
                    from==="spawn"   && to==="mailbox" ? 400  :
                    from==="mailbox" && to==="parent"  ? 170  :
                    from==="spawn"   && to==="client"  ? 400  : 200;
                  const bw = label.length * 7 + 10;
                  return (
                    <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.15 }}>
                      <rect x={lx - bw/2} y={ly - 11} width={bw} height={16}
                        rx={3} fill="#09090b" />
                      <text x={lx} y={ly} textAnchor="middle" fontSize={12}
                        fontFamily="monospace" fill={COLOR_MAP[nc].stroke}>
                        {label}
                      </text>
                    </motion.g>
                  );
                })()}
              </g>
            );
          })}

          {/* ── 节点 ── */}
          {NODES.map(n => {
            const active = an.includes(n.id);
            const cm = COLOR_MAP[n.color];
            return (
              <g key={n.id}>
                <motion.rect
                  x={n.x - n.w/2} y={n.y - n.h/2} width={n.w} height={n.h} rx={9}
                  animate={{
                    fill:   active ? cm.fill   : "#18181b",
                    stroke: active ? cm.stroke : "#3f3f46",
                  }}
                  strokeWidth={2.2}
                  filter={active ? `url(#gl13-${n.color})` : "none"}
                  transition={{ duration: 0.4 }}
                />
                <motion.text
                  x={n.x} y={n.sublabel ? n.y - 7 : n.y + 6}
                  textAnchor="middle" fontSize={14} fontWeight={700} fontFamily="monospace"
                  animate={{ fill: active ? "#fff" : "#71717a" }}
                  transition={{ duration: 0.4 }}
                >
                  {n.label}
                </motion.text>
                {n.sublabel && (
                  <motion.text
                    x={n.x} y={n.y + 13}
                    textAnchor="middle" fontSize={10} fontFamily="monospace"
                    animate={{ fill: active ? cm.stroke + "cc" : "#52525b" }}
                    transition={{ duration: 0.4 }}
                  >
                    {n.sublabel}
                  </motion.text>
                )}
              </g>
            );
          })}

          {/* Feature flags 区 — 三个独立卡片 */}
          {([
            {
              name:  "Feature::Collab",
              key:   "key=multi_agent · 默认开启",
              lines: ["基础多 Agent 工具集：", "spawn_agent / send_input", "wait_agent / close_agent / list_agents"],
              color: "#10b981", fill: "#0d1f0d", stroke: "#10b98160",
              x: 18,
            },
            {
              name:  "Feature::MultiAgentV2",
              key:   "key=multi_agent_v2 · 默认关闭（实验性）",
              lines: ["V2 工具集：task_name 必填", "新增 send_message / followup_task", "wait_agent 改用 Mailbox seq 等待"],
              color: "#8b5cf6", fill: "#100a1f", stroke: "#8b5cf660",
              x: 336,
            },
            {
              name:  "Feature::SpawnCsv",
              key:   "key=enable_fanout · 默认关闭",
              lines: ["CSV 批处理工具：", "spawn_agents_on_csv（每行一个 worker）", "max_concurrency=16 · report_result"],
              color: "#f59e0b", fill: "#1a1008", stroke: "#f59e0b60",
              x: 654,
            },
          ] as {name:string;key:string;lines:string[];color:string;fill:string;stroke:string;x:number}[]).map(item => (
            <g key={item.name}>
              <rect x={item.x} y="416" width="308" height="72" rx="5" fill={item.fill} stroke={item.stroke} strokeWidth={1.2}/>
              <text x={item.x+10} y="430" fontSize={11} fontFamily="monospace" fill={item.color} fontWeight={700}>{item.name}</text>
              <text x={item.x+10} y="443" fontSize={9}  fontFamily="monospace" fill={item.color+"99"}>{item.key}</text>
              {item.lines.map((line, li) => (
                <text key={li} x={item.x+10} y={456 + li*13} fontSize={9} fontFamily="monospace" fill={li===0 ? "#71717a" : "#52525b"}>{line}</text>
              ))}
            </g>
          ))}
        </svg>
      </div>

      {/* 事件日志 + 步骤说明 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
          <div className="mb-2 font-mono text-xs text-zinc-500">执行日志</div>
          <div className="min-h-[160px] overflow-auto rounded-md border border-zinc-800 bg-zinc-950 p-3">
            <AnimatePresence mode="popLayout">
              {visibleEvents.length === 0 ? (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="py-6 text-center text-xs text-zinc-600">— 等待操作 —</motion.div>
              ) : visibleEvents.map((ev, i) => {
                const isComment = ev.startsWith("//");
                const isArrow   = ev.startsWith("→");
                const isKey     = ev.includes(":") && !ev.startsWith(" ") && !isComment;
                return (
                  <motion.div key={`${i}-${ev.slice(0,16)}`}
                    initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.03 }}
                    className={`font-mono text-[11px] leading-relaxed ${
                      isComment ? "text-zinc-600" :
                      isArrow   ? "text-emerald-400" :
                      isKey     ? "text-amber-300" :
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
