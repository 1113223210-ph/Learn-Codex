"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useSteppedVisualization } from "@/hooks/useSteppedVisualization";
import { StepControls } from "@/components/visualizations/shared/step-controls";

// ── 节点定义（ViewBox 0 0 1280 530）────────────────────────────────────────
// 四行布局：
//   Row1 (y=80):  构建流水线 4 节点
//   Row2 (y=245): 并行监控层 3 节点（tokio::select! 框内）
//   Diamond (y=400): 进程退出决策
//   Row4 (y=494): 两条分支（超时 / 正常）
interface NodeDef {
  id: string;
  label: string;
  sublabel?: string;
  x: number; y: number; w: number; h: number;
  shape?: "diamond";
  color: "blue" | "purple" | "orange" | "cyan" | "yellow" | "red" | "green";
}

const NODES: NodeDef[] = [
  // ── Row 1：构建流水线
  { id: "input",   label: "收到 Shell 调用",     sublabel: "ExecParams · command / cwd / timeout",          x: 160,  y: 80,  w: 250, h: 60, color: "blue"   },
  { id: "sandbox", label: "选择沙箱策略",         sublabel: "select_process_exec_tool_sandbox_type()",       x: 480,  y: 80,  w: 285, h: 60, color: "purple" },
  { id: "build",   label: "构建执行请求",         sublabel: "build_exec_request() → ExecRequest",            x: 810,  y: 80,  w: 250, h: 60, color: "blue"   },
  { id: "spawn",   label: "启动子进程",           sublabel: "spawn_child_async() · StdioPolicy::Piped",      x: 1120, y: 80,  w: 280, h: 60, color: "orange" },

  // ── Row 2：并行监控层（tokio::select! 内）
  { id: "stdout",  label: "流式读取 stdout",      sublabel: "OutputDelta 事件实时推送",                      x: 470,  y: 245, w: 220, h: 56, color: "cyan"   },
  { id: "stderr",  label: "流式读取 stderr",      sublabel: "read_capped() · 上限截断",                     x: 740,  y: 245, w: 220, h: 56, color: "cyan"   },
  { id: "timeout", label: "超时 / 取消守卫",      sublabel: "ExecExpiration · 默认 10 秒",                   x: 1010, y: 245, w: 210, h: 56, color: "yellow" },

  // ── 决策菱形
  { id: "exit",    label: "timed_out == false?",      sublabel: "",                                              x: 620,  y: 400, w: 290, h: 76, shape: "diamond", color: "yellow" },

  // ── 分支
  { id: "sigkill", label: "强制终止进程",         sublabel: "kill_process_group() · 超时码 192",             x: 190,  y: 494, w: 220, h: 56, color: "red"    },
  { id: "result",  label: "聚合输出，返回结果",    sublabel: "finalize_exec_result() → ExecToolCallOutput",   x: 1070, y: 494, w: 300, h: 56, color: "green"  },
];

const COLOR_MAP = {
  blue:   { fill: "#1e3a5f", stroke: "#3b82f6" },
  purple: { fill: "#2e1065", stroke: "#a855f7" },
  orange: { fill: "#431407", stroke: "#f97316" },
  cyan:   { fill: "#0c3044", stroke: "#06b6d4" },
  yellow: { fill: "#422006", stroke: "#f59e0b" },
  red:    { fill: "#450a0a", stroke: "#ef4444" },
  green:  { fill: "#052e16", stroke: "#10b981" },
};

const ACTIVE_NODES: string[][] = [
  [],
  ["input"],
  ["sandbox"],
  ["build"],
  ["spawn"],
  ["stdout", "stderr", "timeout"],
  ["stdout"],
  ["timeout", "sigkill"],
  ["exit"],
  ["result"],
];

const ACTIVE_EDGES: string[][] = [
  [],
  [],
  ["input->sandbox"],
  ["sandbox->build"],
  ["build->spawn"],
  ["spawn->stdout", "spawn->stderr", "spawn->timeout"],
  ["spawn->stdout"],
  ["spawn->timeout", "exit->sigkill"],
  ["parallel->exit"],
  ["exit->result"],
];

const EVENTS: string[][] = [
  [],
  ['ExecParams {', '  command: ["cargo", "check"],', '  cwd: /home/user/myproject,', '  expiration: DefaultTimeout (10_000 ms),', '  sandbox_permissions: SandboxPermissions,', '}'],
  ['// select_process_exec_tool_sandbox_type()', '// FileSystemSandboxPolicy: WorkspaceWrite', '// NetworkSandboxPolicy: DenyAll', '→ SandboxType::Landlock  (Linux)'],
  ['// build_exec_request() → ExecRequest', 'ExecRequest {', '  argv: ["cargo", "check"],', '  env: { PATH: /usr/bin:..., CARGO_HOME: ... },', '  sandbox: Landlock {', '    allow_write: /home/user/myproject,', '  }', '}'],
  ['// spawn_child_async(exec_req)', '// StdioPolicy::RedirectForShellTool', '//   → stdout: Stdio::piped()', '//   → stderr: Stdio::piped()', 'Child { pid: 18372 } → running...'],
  ['// consume_output() 启动三路并行', 'tokio::spawn(read_output(stdout_reader, ...))', 'tokio::spawn(read_output(stderr_reader, ...))', '// expiration.wait() → sleep(10s) 开始计时', '// tokio::select! { child.wait() | timeout | ctrl_c }'],
  ['// stdout read_output() 持续读取', 'OutputDelta { stream: Stdout }', '  "   Compiling myproject v0.1.0"', 'OutputDelta { stream: Stdout }', '  "    Checking myproject v0.1.0"', 'OutputDelta { stream: Stdout }', '  "    Finished dev in 2.34s"', '// → ExecCommandOutputDeltaEvent 实时推送给 TUI'],
  ['// expiration.wait() → 10s 到期触发', '// tokio::select! 选中 timeout 分支', 'kill_child_process_group(pid=18372)', '→ SIGKILL 发送给整个进程组（含孙进程）', 'synthetic_exit_status(128 + 64) = 192', '// timed_out = true'],
  ['// child.wait() → exit_code = 0', '// tokio::select! 选中 child.wait() 分支', '// (timed_out = false)', '// 等待两个 pipe reader task 完成', '//   IO_DRAIN_TIMEOUT = 2s（防孙进程持有 fd）', 'stdout_handle.await ✓', 'stderr_handle.await ✓'],
  ['// finalize_exec_result()', 'ExecToolCallOutput {', '  exit_code: 0,', '  stdout: "   Compiling...\\n    Finished...",', '  stderr: "",', '  timed_out: false,', '}', '// → ResponseInputItem::FunctionCallOutput', '// → 写回 session history'],
];

const STEP_INFO = [
  { title: "Shell 执行全流程", desc: "exec.rs:219 — process_exec_tool_call() 是总入口，串联沙箱策略选择、子进程启动、并行 I/O 读取和超时控制四大功能。核心设计：用 tokio::select! 同时竞争进程退出、超时和用户取消三个事件。", file: "core/src/exec.rs:219" },
  { title: "收到调用参数 ExecParams", desc: "ExecParams 携带 command（Vec<String>）、工作目录（AbsolutePathBuf）、超时策略（ExecExpiration）、网络代理（NetworkProxy）和沙箱权限。DEFAULT_EXEC_COMMAND_TIMEOUT_MS = 10_000（10 秒）。", file: "exec.rs:83" },
  { title: "选择沙箱类型", desc: "根据 FileSystemSandboxPolicy 和 NetworkSandboxPolicy 自动选择平台沙箱：Linux 用 Landlock + Seccomp，macOS 用 Seatbelt，Windows 用 Restricted Token 或 Elevated。沙箱选择在子进程启动前完成，不可运行时切换。", file: "exec.rs:131" },
  { title: "构建执行请求", desc: "build_exec_request() 把 ExecParams 转换为平台相关的 ExecRequest：设置 argv、env（含网络代理环境变量）、沙箱类型。此时命令尚未执行，只是在组装启动参数。", file: "exec.rs:245" },
  { title: "启动子进程", desc: "exec() 内调用 spawn_child_async()，产生实际的 tokio::process::Child。stdout/stderr 均设为 StdioPolicy::RedirectForShellTool（即 Stdio::piped()），以便后续异步读取。子进程在沙箱内开始执行。", file: "exec.rs:877" },
  { title: "并行监控层启动", desc: "consume_output() 启动三路并行：tokio::spawn(read_output(stdout))、tokio::spawn(read_output(stderr))、expiration.wait()（睡眠计时）。三者在 tokio::select! 中竞争：哪个先触发决定走哪条分支。", file: "exec.rs:1234" },
  { title: "stdout 流式读取 + 实时推送", desc: "read_output() 持续调用 read_capped() 从 pipe 读取数据，每次读到 data 就生成 ExecCommandOutputDeltaEvent 发送给 TUI 和 app-server 实时展示。EXEC_OUTPUT_MAX_BYTES 上限防止内存耗尽。", file: "exec.rs:1333" },
  { title: "超时触发 → SIGKILL", desc: "expiration.wait() 到期（默认 10 秒）后，tokio::select! 选中 timeout 分支：kill_child_process_group() 向整个进程组（含孙进程）发送 SIGKILL，synthetic_exit_status(192) 表示超时退出，timed_out = true。", file: "exec.rs:1285" },
  { title: "进程正常退出", desc: "child.wait() 返回 ExitStatus 后，等待 stdout/stderr pipe reader task 各自完成（最多等 IO_DRAIN_TIMEOUT_MS = 2s）。2 秒兜底防止孙进程持有文件描述符导致 read() 永久阻塞。", file: "exec.rs:1305" },
  { title: "聚合输出，返回结果", desc: "aggregate_output() 合并 stdout/stderr 的 StreamOutput，finalize_exec_result() 生成 ExecToolCallOutput。再由调用方转换为 ResponseInputItem::FunctionCallOutput，写回 session history，供模型下轮使用。", file: "exec.rs:640" },
];

function getNode(id: string) { return NODES.find(n => n.id === id)!; }

function edgePath(fromId: string, toId: string): string {
  // "parallel" 是合成边：代表并行框底部中心 → 决策菱形顶点
  if (fromId === "parallel" && toId === "exit") {
    const t = getNode("exit");
    return `M 720 315 L ${t.x} ${t.y - t.h / 2}`;
  }

  const f = getNode(fromId);
  const t = getNode(toId);

  // Row 1 水平连接
  if ((fromId === "input"   && toId === "sandbox") ||
      (fromId === "sandbox" && toId === "build")   ||
      (fromId === "build"   && toId === "spawn")) {
    return `M ${f.x + f.w / 2} ${f.y} L ${t.x - t.w / 2} ${t.y}`;
  }

  // spawn 扇出到并行监控节点（从底部 → 各节点顶部）
  if (fromId === "spawn" && (toId === "stdout" || toId === "stderr" || toId === "timeout")) {
    return `M ${f.x} ${f.y + f.h / 2} L ${t.x} ${t.y - t.h / 2}`;
  }

  // 菱形 → 两条分支（先横移到分支中心 x，再下行到顶）
  if (fromId === "exit" && toId === "sigkill") {
    return `M ${f.x - f.w / 2} ${f.y} L ${t.x} ${f.y} L ${t.x} ${t.y - t.h / 2}`;
  }
  if (fromId === "exit" && toId === "result") {
    return `M ${f.x + f.w / 2} ${f.y} L ${t.x} ${f.y} L ${t.x} ${t.y - t.h / 2}`;
  }

  return `M ${f.x} ${f.y + f.h / 2} L ${t.x} ${t.y - t.h / 2}`;
}

// ── 主组件 ─────────────────────────────────────────────────────────────────
export default function ShellExecutionVisualization() {
  const viz = useSteppedVisualization({ totalSteps: 10, autoPlayInterval: 2800 });
  const an = ACTIVE_NODES[viz.currentStep];
  const ae = ACTIVE_EDGES[viz.currentStep];
  const step = STEP_INFO[viz.currentStep];

  const allEvents: string[] = [];
  for (let s = 1; s <= viz.currentStep; s++) {
    if (EVENTS[s].length > 0) allEvents.push(...EVENTS[s]);
  }
  const visibleEvents = allEvents.slice(-10);

  const parallelActive = an.some(id => ["stdout", "stderr", "timeout"].includes(id));

  return (
    <section className="space-y-4">

      {/* ── SVG 流程图 ── */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
        <div className="mb-2 flex items-center gap-2 font-mono text-xs text-zinc-500">
          <span className="text-orange-400">core/src/</span>exec.rs
        </div>

        <svg
          viewBox="0 0 1280 530"
          className="w-full rounded-md border border-zinc-800 bg-zinc-950"
          style={{ maxHeight: "510px" }}
        >
          <defs>
            {(Object.keys(COLOR_MAP) as Array<keyof typeof COLOR_MAP>).map(c => (
              <filter key={c} id={`gl4-${c}`}>
                <feDropShadow dx="0" dy="0" stdDeviation="7" floodColor={COLOR_MAP[c].stroke} floodOpacity="0.8" />
              </filter>
            ))}
            <marker id="m4" markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto">
              <polygon points="0 0,10 4,0 8" fill="#52525b" />
            </marker>
            {(Object.keys(COLOR_MAP) as Array<keyof typeof COLOR_MAP>).map(c => (
              <marker key={c} id={`m4-${c}`} markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto">
                <polygon points="0 0,10 4,0 8" fill={COLOR_MAP[c].stroke} />
              </marker>
            ))}
          </defs>

          {/* 外层 process_exec_tool_call 标注 */}
          <motion.rect x="8" y="10" width="1264" height="510" rx="14"
            fill="none" strokeDasharray="8 5" strokeWidth={2}
            animate={{ stroke: viz.currentStep >= 1 ? "#f97316" : "#f9731655" }}
            transition={{ duration: 0.5 }} />
          {/* 背景遮住框线，避免文字与虚线重叠 */}
          <rect x="14" y="3" width="418" height="18" fill="#09090b" />
          <text x="22" y="16" fontSize={16} fontFamily="monospace" fill="#fdba74">process_exec_tool_call()  — exec.rs:219</text>

          {/* 并行监控层框 */}
          <motion.rect x="270" y="148" width="900" height="170" rx="10"
            fill="none" strokeDasharray="5 3" strokeWidth={1.8}
            animate={{ stroke: parallelActive ? "#06b6d4" : "#06b6d488" }}
            transition={{ duration: 0.4 }} />
          <rect x="492" y="139" width="458" height="18" fill="#09090b" />
          <text x="720" y="152" textAnchor="middle" fontSize={16} fontFamily="monospace" fill="#a5f3fc">consume_output()  —  tokio::select! 三路竞争</text>

          {/* 并行监控层框 */}
          <motion.rect x="270" y="148" width="900" height="170" rx="10"
            fill="none" strokeDasharray="5 3" strokeWidth={1.5}
            animate={{ stroke: parallelActive ? "#06b6d455" : "#06b6d422" }}
            transition={{ duration: 0.4 }} />
          <text x="720" y="136" textAnchor="middle" fontSize={16} fontFamily="monospace" fill="#06b6d455">
            consume_output()  —  tokio::select! 三路竞争
          </text>

          {/* ── 边 ── */}
          {[
            { from: "input",    to: "sandbox", label: "" },
            { from: "sandbox",  to: "build",   label: "" },
            { from: "build",    to: "spawn",   label: "" },
            { from: "spawn",    to: "stdout",  label: "" },
            { from: "spawn",    to: "stderr",  label: "" },
            { from: "spawn",    to: "timeout", label: "" },
            { from: "parallel", to: "exit",    label: "" },
            { from: "exit",     to: "sigkill", label: "true · SIGKILL" },
            { from: "exit",     to: "result",  label: "false · 正常退出" },
          ].map(({ from, to, label }) => {
            const key = `${from}->${to}`;
            const active = ae.includes(key);
            const sourceNode = from === "parallel" ? getNode("timeout") : getNode(from);
            const nc = sourceNode.color;
            return (
              <g key={key}>
                <motion.path
                  d={edgePath(from, to)} fill="none"
                  strokeWidth={active ? 3 : 1.8}
                  markerEnd={`url(#m4${active ? `-${nc}` : ""})`}
                  animate={{ stroke: active ? COLOR_MAP[nc].stroke : "#3f3f46", opacity: active ? 1 : 0.4 }}
                  transition={{ duration: 0.4 }}
                />
                {label && active && (() => {
                  const lx = to === "sigkill" ? 345 : to === "result" ? 905 : 640;
                  const ly = 392;
                  return (
                    <motion.text x={lx} y={ly} textAnchor="middle" fontSize={18}
                      fontFamily="monospace" fill={COLOR_MAP[nc].stroke}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      {label}
                    </motion.text>
                  );
                })()}
              </g>
            );
          })}

          {/* ── 节点 ── */}
          {NODES.map(n => {
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
                    strokeWidth={2.5} filter={active ? `url(#gl4-${n.color})` : "none"}
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
                  strokeWidth={2.5} filter={active ? `url(#gl4-${n.color})` : "none"}
                  transition={{ duration: 0.4 }}
                />
                <motion.text x={n.x} y={n.sublabel ? n.y - 8 : n.y + 7} textAnchor="middle"
                  fontSize={18} fontWeight={700} fontFamily="monospace"
                  animate={{ fill: active ? "#fff" : "#71717a" }} transition={{ duration: 0.4 }}>
                  {n.label}
                </motion.text>
                {n.sublabel && (
                  <motion.text x={n.x} y={n.y + 18} textAnchor="middle"
                    fontSize={11} fontFamily="monospace"
                    animate={{ fill: active ? cm.stroke + "cc" : "#52525b" }} transition={{ duration: 0.4 }}>
                    {n.sublabel}
                  </motion.text>
                )}
              </g>
            );
          })}

          {/* IO_DRAIN_TIMEOUT 标注徽章 */}
          <AnimatePresence>
            {viz.currentStep === 8 && (
              <motion.g initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <rect x={860} y={155} width={290} height={28} rx={5} fill="#0c3044" stroke="#06b6d4" strokeWidth={1.2} />
                <text x={1005} y={174} textAnchor="middle" fontSize={14} fontFamily="monospace" fill="#06b6d4">
                  IO_DRAIN_TIMEOUT = 2s 兜底等待
                </text>
              </motion.g>
            )}
          </AnimatePresence>
        </svg>
      </div>

      {/* ── 事件日志 + 步骤说明 ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
          <div className="mb-2 font-mono text-xs text-zinc-500">exec log</div>
          <div className="min-h-[180px] overflow-auto rounded-md border border-zinc-800 bg-zinc-950 p-3">
            <AnimatePresence mode="popLayout">
              {visibleEvents.length === 0 ? (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="py-6 text-center text-xs text-zinc-600">— 等待 Shell 调用 —</motion.div>
              ) : visibleEvents.map((ev, i) => {
                const isComment  = ev.startsWith("//");
                const isArrow    = ev.startsWith("→");
                const isKey      = /^(ExecParams|ExecRequest|ExecToolCallOutput|Child|OutputDelta)/.test(ev);
                const isError    = ev.startsWith("SIGKILL") || ev.includes("timed_out");
                return (
                  <motion.div key={`${i}-${ev.slice(0, 18)}`}
                    initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.025 }}
                    className={`font-mono text-[11px] leading-relaxed ${
                      isComment ? "text-zinc-600" :
                      isArrow   ? "text-orange-400" :
                      isKey     ? "text-cyan-400" :
                      isError   ? "text-red-400" :
                      "text-zinc-400"
                    }`}>
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
