"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useSteppedVisualization } from "@/hooks/useSteppedVisualization";
import { StepControls } from "@/components/visualizations/shared/step-controls";

// ─── ch10 MCP 集成可视化 ───────────────────────────────────────────────────────
//
// 模式参照 ch06（场景步骤）和 ch07（状态变化动画）：
//   固定 SVG 架构图 + 下方步骤动画（无代码块）
//
// 数据来源（codex-rs 真实源码）：
//   config/src/mcp_types.rs              — McpServerConfig, 传输类型
//   codex-mcp/src/mcp_connection_manager — AsyncManagedClient, 启动状态
//   codex-mcp/src/mcp_tool_names.rs      — qualify_tools(), 64字符上限
//   core/src/mcp_tool_call.rs            — 审批决策, 沙箱注入
//   protocol/src/mcp.rs                  — CallToolResult

const STEP_INFO = [
  {
    title: "MCP 集成架构",
    desc: "config.toml 配置 MCP server → McpConnectionManager 并发启动 → RmcpClient 连接（Stdio 子进程 / StreamableHttp）→ initialize 握手（协议 2025-06-18）→ qualify_tools() 命名 → McpHandler 路由 → 审批 + 沙箱注入 → JSON-RPC tools/call。",
  },
  {
    title: "Server 启动：Connecting → Ready",
    desc: "McpConnectionManager::new() 为每个 enabled server 创建 AsyncManagedClient（懒初始化）。Stdio 分支调用 env_clear() 清空父进程环境变量（安全核心），process_group(0) 确保 Kill 时整个进程树终止。initialize 握手完成后立即 list_tools()。",
  },
  {
    title: "qualify_tools()：工具命名转换",
    desc: "mcp_tool_names.rs:111 — 所有 MCP 工具统一命名为 mcp__{server}__{tool}，字符集限 [a-zA-Z0-9_]，最长 64 字符（OpenAI Responses API 限制）。命名冲突时附加 SHA-1 前 12 字节 hex 后缀。工具数量 ≥ 100 时触发延迟暴露策略。",
  },
  {
    title: "只读工具调用 — 跳过审批",
    desc: "handle_mcp_tool_call() 检查 ToolAnnotations：read_only_hint=true → requires_mcp_tool_approval() 返回 false，跳过审批直接执行。工具名 mcp__filesystem__read_file 经 McpHandler 路由后，沙箱状态注入 _meta，发送 JSON-RPC tools/call。",
  },
  {
    title: "破坏性工具调用 — 触发审批",
    desc: "destructive_hint=true → requires_mcp_tool_approval() 返回 true，弹出审批 UI。用户可选择 Accept / AcceptForSession / AcceptAndRemember / Decline。AcceptAndRemember 持久化审批结果，下次同类调用不再提示。",
  },
  {
    title: "沙箱状态注入 _meta",
    desc: "server 在 initialize 响应中声明 codex/sandbox-state-meta 扩展能力后，每次 tools/call 的 _meta 字段附加 SandboxState：sandbox_policy、sandbox_cwd、use_legacy_landlock、codex_linux_sandbox_exe。让 MCP server 实现服务端 defense-in-depth。",
  },
];

// ─── Step 1：Server 启动状态机 ────────────────────────────────────────────────

const SERVERS = [
  {
    name: "filesystem",
    transport: "Stdio",
    command: "npx -y @mcp/server-filesystem",
    tools: ["read_file", "write_file", "list_directory", "move_file", "search_files", "get_file_info", "create_directory", "delete_file"],
    color: "#10b981",
    borderColor: "border-emerald-700",
    bgColor: "bg-emerald-950/30",
    textColor: "text-emerald-300",
    badge: "bg-emerald-900/60 text-emerald-300",
  },
  {
    name: "github",
    transport: "StreamableHttp",
    command: "https://mcp.github.com",
    tools: ["list_repos", "create_issue", "create_pr", "get_commit", "search_code", "get_file_contents", "list_branches", "merge_pr", "add_comment", "list_issues", "close_issue"],
    color: "#8b5cf6",
    borderColor: "border-violet-700",
    bgColor: "bg-violet-950/30",
    textColor: "text-violet-300",
    badge: "bg-violet-900/60 text-violet-300",
  },
];

function ServerStartupViz() {
  return (
    <div className="space-y-3">
      {SERVERS.map((srv, si) => (
        <motion.div
          key={srv.name}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: si * 0.15 }}
          className={`rounded-lg border p-4 ${srv.borderColor} ${srv.bgColor}`}
        >
          {/* 服务器头部 */}
          <div className="flex items-center gap-3 mb-3">
            <motion.div
              className="h-3 w-3 rounded-full shrink-0"
              animate={{ backgroundColor: [srv.color + "40", srv.color], scale: [1, 1.2, 1] }}
              transition={{ delay: si * 0.3 + 0.4, duration: 0.5 }}
              style={{ backgroundColor: srv.color + "40" }}
            />
            <span className={`font-mono text-base font-bold ${srv.textColor}`}>{srv.name}</span>
            <span className={`rounded px-2 py-0.5 font-mono text-xs ${srv.badge}`}>{srv.transport}</span>
            <motion.span
              className="ml-auto font-mono text-xs text-zinc-500"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: si * 0.3 + 0.6 }}
            >
              {srv.command}
            </motion.span>
          </div>

          {/* 状态变化：Connecting → Ready */}
          <div className="flex items-center gap-3 mb-3 font-mono text-sm">
            <motion.span
              className="text-zinc-500"
              animate={{ opacity: [1, 0] }}
              transition={{ delay: si * 0.3 + 0.5, duration: 0.3 }}
            >
              Connecting…
            </motion.span>
            <motion.span
              className="text-zinc-600"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ delay: si * 0.3 + 0.5, duration: 0.6 }}
            >
              →
            </motion.span>
            <motion.span
              className="text-emerald-400 font-bold"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: si * 0.3 + 0.8 }}
            >
              Ready ✓ &nbsp;{srv.tools.length} tools
            </motion.span>
          </div>

          {/* 工具列表逐条出现 */}
          <div className="flex flex-wrap gap-1.5">
            {srv.tools.map((t, ti) => (
              <motion.span
                key={t}
                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-mono text-xs text-zinc-400"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: si * 0.3 + 0.9 + ti * 0.05 }}
              >
                {t}
              </motion.span>
            ))}
          </div>
        </motion.div>
      ))}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4 }}
        className="flex items-center gap-4 rounded border border-zinc-800 bg-zinc-950 px-4 py-2 font-mono text-sm"
      >
        <span className="text-zinc-500">mcp_connection_manager.rs:703</span>
        <span className="text-zinc-600">·</span>
        <span className="text-amber-300">env_clear()</span>
        <span className="text-zinc-600">·</span>
        <span className="text-sky-300">process_group(0)</span>
        <span className="text-zinc-600">·</span>
        <span className="text-emerald-300">initialize → list_tools()</span>
      </motion.div>
    </div>
  );
}

// ─── Step 2：qualify_tools() 命名转换 ─────────────────────────────────────────

const QUALIFY_ROWS = [
  { server: "filesystem", raw: "read_file",        qualified: "mcp__filesystem__read_file",       collision: false },
  { server: "filesystem", raw: "write_file",       qualified: "mcp__filesystem__write_file",      collision: false },
  { server: "filesystem", raw: "delete_file",      qualified: "mcp__filesystem__delete_file",     collision: false },
  { server: "github",     raw: "list_repos",       qualified: "mcp__github__list_repos",          collision: false },
  { server: "github",     raw: "create_issue",     qualified: "mcp__github__create_issue",        collision: false },
  { server: "db-tools",   raw: "query",            qualified: "mcp__db_tools__query",             collision: false },
  { server: "db-tools",   raw: "query",            qualified: "mcp__db_tools__query_a1b2c3d4e5f6",collision: true  },
];

function QualifyToolsViz() {
  return (
    <div className="space-y-3">
      {/* 标题行 */}
      <div className="grid grid-cols-12 gap-2 px-2 font-mono text-xs text-zinc-600">
        <span className="col-span-3">server</span>
        <span className="col-span-3">raw_name</span>
        <span className="col-span-1 text-center">→</span>
        <span className="col-span-5">qualified_name（模型可见）</span>
      </div>

      {QUALIFY_ROWS.map((row, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
          className={`grid grid-cols-12 gap-2 items-center rounded border px-3 py-2.5 ${
            row.collision ? "border-amber-800 bg-amber-950/25" : "border-zinc-800 bg-zinc-950"
          }`}
        >
          {/* server badge */}
          <span className={`col-span-3 rounded px-2 py-0.5 font-mono text-xs w-fit ${
            row.server === "filesystem" ? "bg-emerald-900/60 text-emerald-300" :
            row.server === "github"     ? "bg-violet-900/60 text-violet-300" :
                                          "bg-sky-900/60 text-sky-300"
          }`}>
            {row.server}
          </span>

          {/* raw name */}
          <span className="col-span-3 font-mono text-sm text-zinc-400">{row.raw}</span>

          {/* arrow */}
          <span className="col-span-1 text-center font-mono text-zinc-600">→</span>

          {/* qualified name */}
          <div className="col-span-5 flex items-center gap-2">
            <span className={`font-mono text-sm ${row.collision ? "text-amber-300" : "text-emerald-300"}`}>
              {row.qualified}
            </span>
            {row.collision && (
              <span className="rounded bg-amber-900/60 px-1.5 py-0.5 font-mono text-xs text-amber-300">
                SHA-1 hash 后缀
              </span>
            )}
          </div>
        </motion.div>
      ))}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.85 }}
        className="flex flex-wrap gap-4 rounded border border-zinc-800 bg-zinc-950 px-4 py-2.5 font-mono text-xs"
      >
        <span className="text-zinc-500">mcp_tool_names.rs:111</span>
        <span className="text-emerald-300">字符集：[a-zA-Z0-9_]</span>
        <span className="text-amber-300">最长 64 字符</span>
        <span className="text-violet-300">冲突 → SHA-1[:12]</span>
        <span className="text-sky-300">≥100 工具 → 延迟暴露</span>
      </motion.div>
    </div>
  );
}

// ─── Step 3 & 4：工具调用 + 审批决策 ─────────────────────────────────────────

interface CallScenario {
  toolName: string;
  annotations: { key: string; value: string; highlight: boolean }[];
  decision: { needsApproval: boolean; reason: string };
  requestArgs: { key: string; value: string }[];
  responseText: string;
  approvalOptions?: string[];
}

const SCENARIO_READONLY: CallScenario = {
  toolName: "mcp__filesystem__read_file",
  annotations: [
    { key: "read_only_hint",   value: "true",  highlight: true  },
    { key: "destructive_hint", value: "false", highlight: false },
    { key: "open_world_hint",  value: "false", highlight: false },
  ],
  decision: { needsApproval: false, reason: "read_only_hint = true → 跳过审批" },
  requestArgs: [{ key: "path", value: '"/workspace/src/main.rs"' }],
  responseText: 'content: [{ type: "text", text: "fn main() {..." }]\nisError: false',
};

const SCENARIO_DESTRUCTIVE: CallScenario = {
  toolName: "mcp__filesystem__delete_file",
  annotations: [
    { key: "destructive_hint", value: "true",  highlight: true  },
    { key: "read_only_hint",   value: "false", highlight: false },
    { key: "open_world_hint",  value: "true",  highlight: false },
  ],
  decision: { needsApproval: true, reason: "destructive_hint = true → 需要审批" },
  requestArgs: [{ key: "path", value: '"/workspace/old_file.txt"' }],
  responseText: 'content: [{ type: "text", text: "File deleted." }]\nisError: false',
  approvalOptions: ["Accept", "AcceptForSession", "AcceptAndRemember", "Decline"],
};

function ToolCallViz({ scenario }: { scenario: CallScenario }) {
  const approved = !scenario.decision.needsApproval;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">

        {/* 左：ToolAnnotations */}
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 space-y-3">
          <div className="font-mono text-xs text-zinc-500 mb-1">ToolAnnotations（MCP 2025-06-18）</div>
          <div className="font-mono text-sm text-sky-300 mb-2">{scenario.toolName}</div>
          {scenario.annotations.map((a, i) => (
            <motion.div
              key={a.key}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.12 }}
              className={`flex items-center justify-between rounded border px-3 py-2 ${
                a.highlight
                  ? approved
                    ? "border-emerald-700 bg-emerald-950/40"
                    : "border-red-700 bg-red-950/40"
                  : "border-zinc-800 bg-zinc-950"
              }`}
            >
              <span className={`font-mono text-sm ${a.highlight ? (approved ? "text-emerald-300" : "text-red-300") : "text-zinc-500"}`}>
                {a.key}
              </span>
              <span className={`font-mono text-sm font-bold ${
                a.value === "true"
                  ? a.highlight ? (approved ? "text-emerald-400" : "text-red-400") : "text-zinc-400"
                  : "text-zinc-600"
              }`}>
                {a.value}
              </span>
            </motion.div>
          ))}
        </div>

        {/* 中：审批决策 */}
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 flex flex-col justify-center space-y-4">
          <div className="font-mono text-xs text-zinc-500">mcp_tool_call.rs:785</div>
          <div className="font-mono text-sm text-zinc-400">requires_mcp_tool_approval()</div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className={`rounded-lg border p-4 text-center ${
              approved
                ? "border-emerald-700 bg-emerald-950/40"
                : "border-red-700 bg-red-950/40"
            }`}
          >
            <div className={`font-mono text-2xl font-bold mb-1 ${approved ? "text-emerald-300" : "text-red-300"}`}>
              {approved ? "→ 跳过" : "→ 审批"}
            </div>
            <div className={`font-mono text-xs ${approved ? "text-emerald-500" : "text-red-500"}`}>
              {scenario.decision.reason}
            </div>
          </motion.div>

          {!approved && scenario.approvalOptions && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="space-y-1.5"
            >
              <div className="font-mono text-xs text-zinc-600 mb-2">McpToolApprovalDecision</div>
              {scenario.approvalOptions.map((opt, i) => (
                <motion.div
                  key={opt}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.9 + i * 0.08 }}
                  className={`rounded border px-3 py-1.5 font-mono text-sm ${
                    opt === "Accept"           ? "border-emerald-800 text-emerald-300 bg-emerald-950/30" :
                    opt === "AcceptForSession" ? "border-sky-800 text-sky-300 bg-sky-950/30" :
                    opt === "AcceptAndRemember"? "border-violet-800 text-violet-300 bg-violet-950/30" :
                                                "border-red-800 text-red-300 bg-red-950/30"
                  }`}
                >
                  {opt}
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>

        {/* 右：请求 / 响应 */}
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 space-y-3">
          <div className="font-mono text-xs text-zinc-500">JSON-RPC tools/call</div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: approved ? 0.4 : 1.4 }}
            className="rounded border border-amber-800 bg-amber-950/20 p-3 space-y-1"
          >
            <div className="font-mono text-xs text-amber-400 mb-1.5">→ Request</div>
            <div className="font-mono text-sm text-zinc-400">name: <span className="text-sky-300">{scenario.toolName.split("__")[2]}</span></div>
            {scenario.requestArgs.map(a => (
              <div key={a.key} className="font-mono text-sm text-zinc-400">
                {a.key}: <span className="text-zinc-300">{a.value}</span>
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: approved ? 0.8 : 1.8 }}
            className="rounded border border-emerald-800 bg-emerald-950/20 p-3"
          >
            <div className="font-mono text-xs text-emerald-400 mb-1.5">← CallToolResult</div>
            <div className="font-mono text-sm text-zinc-300 whitespace-pre-wrap">{scenario.responseText}</div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 5：沙箱状态注入 ─────────────────────────────────────────────────────

const SANDBOX_FIELDS = [
  { key: "sandbox_policy",          value: 'WorkspaceWrite { writable_roots: ["/workspace"] }', color: "text-amber-300",  border: "border-amber-800",  bg: "bg-amber-950/20" },
  { key: "sandbox_cwd",             value: '"/workspace/project"',                              color: "text-sky-300",    border: "border-sky-800",    bg: "bg-sky-950/20"   },
  { key: "use_legacy_landlock",     value: "false",                                              color: "text-zinc-400",   border: "border-zinc-700",   bg: "bg-zinc-900"     },
  { key: "codex_linux_sandbox_exe", value: "null",                                               color: "text-zinc-600",   border: "border-zinc-800",   bg: "bg-zinc-950"     },
];

function SandboxInjectionViz() {
  return (
    <div className="space-y-3">
      {/* 触发条件 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded border border-violet-800 bg-violet-950/20 px-4 py-3 font-mono text-sm"
      >
        <span className="text-violet-400">前提条件：</span>
        <span className="text-zinc-300"> server initialize 响应中声明了</span>
        <span className="text-emerald-300"> capabilities.experimental["codex/sandbox-state-meta"]</span>
      </motion.div>

      {/* _meta 对象构建动画 */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 space-y-2">
        <div className="font-mono text-xs text-zinc-500 mb-3">tools/call 请求中的 _meta 字段（mcp_tool_call.rs:515）</div>
        <div className="font-mono text-sm text-zinc-500 mb-1">_meta["codex/sandbox-state-meta"] = SandboxState {"{{"}</div>

        {SANDBOX_FIELDS.map((f, i) => (
          <motion.div
            key={f.key}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.2 + 0.2 }}
            className={`ml-4 flex items-center gap-3 rounded border px-3 py-2 ${f.border} ${f.bg}`}
          >
            <span className="font-mono text-sm text-zinc-500 w-44 shrink-0">{f.key}:</span>
            <span className={`font-mono text-sm ${f.color}`}>{f.value}</span>
          </motion.div>
        ))}

        <div className="font-mono text-sm text-zinc-500">{"}"}</div>
      </div>

      {/* 效果说明 */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1 }}
        className="grid grid-cols-1 gap-3 lg:grid-cols-3"
      >
        {[
          { label: "MCP server 能验证", desc: "调用方是否在受信任沙箱中", color: "text-emerald-300", border: "border-emerald-800", bg: "bg-emerald-950/20" },
          { label: "按 cwd 限制路径",    desc: "防止访问 /workspace 以外的文件", color: "text-sky-300", border: "border-sky-800", bg: "bg-sky-950/20" },
          { label: "Defense-in-depth",  desc: "Codex 沙箱 + MCP server 双层验证", color: "text-violet-300", border: "border-violet-800", bg: "bg-violet-950/20" },
        ].map(item => (
          <div key={item.label} className={`rounded border px-4 py-3 ${item.border} ${item.bg}`}>
            <div className={`font-mono text-sm font-bold mb-1 ${item.color}`}>{item.label}</div>
            <div className="font-mono text-xs text-zinc-400">{item.desc}</div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────

export default function McpVisualization() {
  const viz = useSteppedVisualization({ totalSteps: STEP_INFO.length, autoPlayInterval: 5000 });
  const step = STEP_INFO[viz.currentStep];

  return (
    <section className="space-y-4">

      {/* SVG 架构图（固定） */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3">
        <div className="mb-2 font-mono text-xs text-zinc-500">
          <span className="text-emerald-400">codex-mcp/</span> · <span className="text-sky-400">core/src/mcp*</span> · <span className="text-violet-400">rmcp-client/</span>
        </div>
        <svg viewBox="0 0 1280 220" className="w-full rounded border border-zinc-800 bg-zinc-950">
          <defs>
            {(["#0ea5e9","#f59e0b","#22c55e","#8b5cf6","#10b981","#f43f5e"] as const).map((c,i)=>(
              <marker key={i} id={`mc${i}`} markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto">
                <polygon points="0 0,10 4,0 8" fill={c}/>
              </marker>
            ))}
          </defs>

          {/* 行1：初始化路径 */}
          <text x="28" y="22" fontSize={11} fontFamily="monospace" fill="#52525b">① 初始化路径 →</text>
          {([
            { x:28,   label:"config.toml",       sub:"McpServerConfig",        stroke:"#0ea5e9", fill:"#03131f", tc:"#38bdf8", sc:"#7dd3fc" },
            { x:284,  label:"McpConnection",      sub:"AsyncManagedClient",     stroke:"#f59e0b", fill:"#1a1008", tc:"#fbbf24", sc:"#fde68a" },
            { x:540,  label:"RmcpClient",         sub:"Stdio / HTTP",           stroke:"#22c55e", fill:"#0f1a0a", tc:"#4ade80", sc:"#86efac" },
            { x:796,  label:"initialize",         sub:"protocol 2025-06-18",    stroke:"#8b5cf6", fill:"#100a1f", tc:"#a78bfa", sc:"#ddd6fe" },
            { x:1052, label:"qualify_tools()",    sub:"mcp__{server}__{tool}",  stroke:"#10b981", fill:"#0d1f0d", tc:"#34d399", sc:"#6ee7b7" },
          ] as {x:number;label:string;sub:string;stroke:string;fill:string;tc:string;sc:string}[]).map(n=>(
            <g key={n.x}>
              <rect x={n.x} y="30" width="200" height="56" rx="7" fill={n.fill} stroke={n.stroke} strokeWidth={1.6}/>
              <text x={n.x+100} y="52"  textAnchor="middle" fontSize={14} fontWeight={700} fontFamily="monospace" fill={n.tc}>{n.label}</text>
              <text x={n.x+100} y="70" textAnchor="middle" fontSize={11} fontFamily="monospace" fill={n.sc}>{n.sub}</text>
            </g>
          ))}
          {([[228,284,"#0ea5e9",0],[484,540,"#f59e0b",1],[740,796,"#22c55e",2],[996,1052,"#8b5cf6",3]] as [number,number,string,number][]).map(([x1,x2,c,i],idx)=>(
            <line key={idx} x1={x1} y1={58} x2={x2} y2={58} stroke={c} strokeWidth={1.4} markerEnd={`url(#mc${i})`}/>
          ))}

          {/* 垂直连接 */}
          <line x1="1152" y1="86" x2="1152" y2="134" stroke="#10b981" strokeWidth={1.4} markerEnd="url(#mc4)"/>
          <text x="28" y="130" fontSize={11} fontFamily="monospace" fill="#52525b">← ② 调用路径</text>

          {/* 行2：调用路径 */}
          {([
            { x:28,   label:"CallToolResult",      sub:"content + is_error",     stroke:"#ef4444", fill:"#1a0808", tc:"#fca5a5", sc:"#fca5a5" },
            { x:284,  label:"tools/call RPC",      sub:"timeout 120s + 重连",    stroke:"#f43f5e", fill:"#1f080c", tc:"#fb7185", sc:"#fda4af" },
            { x:540,  label:"沙箱状态注入",        sub:"_meta sandbox-state",     stroke:"#f43f5e", fill:"#1f080c", tc:"#fb7185", sc:"#fda4af" },
            { x:796,  label:"审批检查",            sub:"ToolAnnotations hints",   stroke:"#f43f5e", fill:"#1f080c", tc:"#fb7185", sc:"#fda4af" },
            { x:1052, label:"McpHandler",          sub:"ToolRouter → mcp*",       stroke:"#10b981", fill:"#0d1f0d", tc:"#34d399", sc:"#6ee7b7" },
          ] as {x:number;label:string;sub:string;stroke:string;fill:string;tc:string;sc:string}[]).map(n=>(
            <g key={n.x}>
              <rect x={n.x} y="140" width="200" height="56" rx="7" fill={n.fill} stroke={n.stroke} strokeWidth={1.6}/>
              <text x={n.x+100} y="162" textAnchor="middle" fontSize={14} fontWeight={700} fontFamily="monospace" fill={n.tc}>{n.label}</text>
              <text x={n.x+100} y="180" textAnchor="middle" fontSize={11} fontFamily="monospace" fill={n.sc}>{n.sub}</text>
            </g>
          ))}
          {([[1052,996,"#10b981",4],[796,740,"#f43f5e",5],[540,484,"#f43f5e",5],[284,228,"#ef4444",5]] as [number,number,string,number][]).map(([x1,x2,c,i],idx)=>(
            <line key={idx} x1={x1} y1={168} x2={x2} y2={168} stroke={c} strokeWidth={1.4} markerEnd={`url(#mc${i})`}/>
          ))}
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
                MCP 让 Codex 动态接入任意外部服务工具，全程基于 JSON-RPC 2.0 协议（规范 2025-06-18）：
              </p>
              <div className="space-y-2 font-mono text-sm">
                {[
                  ["① 初始化", "sky",    "config.toml → AsyncManagedClient → env_clear() → process_group(0) → initialize → list_tools()"],
                  ["② 命名",   "amber",  "qualify_tools()：mcp__{server}__{tool}，≤64字符，SHA-1 冲突解决，≥100 工具触发延迟暴露"],
                  ["③ 路由",   "emerald","ToolRouter 识别 mcp__ 前缀 → McpHandler → handle_mcp_tool_call()"],
                  ["④ 审批",   "violet", "ToolAnnotations：read_only_hint=true → 跳过 / destructive_hint=true → 弹出审批 UI"],
                  ["⑤ 注入",   "rose",   "codex/sandbox-state-meta 扩展：_meta 附加沙箱状态，实现服务端 defense-in-depth"],
                ].map(([label, color, desc]) => (
                  <div key={label as string} className="flex gap-3">
                    <span className={`text-${color}-400 shrink-0 w-14`}>{label}</span>
                    <span className="text-zinc-400">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {viz.currentStep === 1 && <ServerStartupViz />}
          {viz.currentStep === 2 && <QualifyToolsViz />}
          {viz.currentStep === 3 && <ToolCallViz scenario={SCENARIO_READONLY} />}
          {viz.currentStep === 4 && <ToolCallViz scenario={SCENARIO_DESTRUCTIVE} />}
          {viz.currentStep === 5 && <SandboxInjectionViz />}
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
