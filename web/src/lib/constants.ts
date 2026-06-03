export const CHAPTER_ORDER = [
  "ch01","ch02","ch03","ch04","ch05","ch06",
  "ch07","ch08","ch09","ch10","ch11","ch12","ch13",
] as const;

export type ChapterId = typeof CHAPTER_ORDER[number];

export const CHAPTER_META: Record<string, {
  title: string;
  subtitle: string;
  motto: string;
  layer: "engine" | "tools" | "context" | "ecosystem";
  sourceFiles: string[];
  sourceSize: string;
  prev: string | null;
}> = {
  ch01: {
    title: "Agent Loop", subtitle: "The state machine at the heart of every turn",
    motto: "Every agent turn is a state machine: call model → check stop_reason → dispatch tool → feed result back",
    layer: "engine", sourceFiles: ["core/src/codex/turn.rs", "core/src/codex.rs"], sourceSize: "~2200 lines",
    prev: null,
  },
  ch02: {
    title: "Tool System", subtitle: "Router, handlers, and the dispatch pipeline",
    motto: "A tool is just a Rust async fn behind a name — the router never changes",
    layer: "engine", sourceFiles: ["core/src/tools/router.rs", "core/src/tools/handlers/"], sourceSize: "~1500 lines",
    prev: "ch01",
  },
  ch03: {
    title: "Prompt Engineering", subtitle: "build_initial_context and dynamic assembly",
    motto: "The system prompt is not a string — it is assembled fresh for every conversation",
    layer: "engine", sourceFiles: ["core/src/codex.rs"], sourceSize: "3106 lines",
    prev: "ch02",
  },
  ch04: {
    title: "Shell Execution", subtitle: "From tool call to subprocess and back",
    motto: "Executing a shell command is the most dangerous thing an agent can do — treat it that way",
    layer: "tools", sourceFiles: ["core/src/exec.rs"], sourceSize: "1405 lines",
    prev: "ch03",
  },
  ch05: {
    title: "Sandbox Security", subtitle: "Cross-platform isolation: macOS / Linux / Windows",
    motto: "Sandbox is not optional — it is the reason untrusted code can run at all",
    layer: "tools", sourceFiles: ["sandboxing/src/", "execpolicy/src/"], sourceSize: "~6000 lines",
    prev: "ch04",
  },
  ch06: {
    title: "Permission Engine", subtitle: "Three-phase orchestration before every tool call",
    motto: "Ask once, remember forever — but always verify before you trust",
    layer: "tools", sourceFiles: ["core/src/tools/orchestrator.rs"], sourceSize: "~370 lines",
    prev: "ch05",
  },
  ch07: {
    title: "Context Compaction", subtitle: "Keeping the token budget under control",
    motto: "Context always fills up — the question is how gracefully you recover",
    layer: "context", sourceFiles: ["core/src/compact.rs"], sourceSize: "~580 lines",
    prev: "ch06",
  },
  ch08: {
    title: "Short-term Memory", subtitle: "Message history within a session",
    motto: "The conversation is the state — manage it carefully",
    layer: "context", sourceFiles: ["core/src/context_manager/history.rs"], sourceSize: "~730 lines",
    prev: "ch07",
  },
  ch09: {
    title: "Long-term Memory", subtitle: "Two-phase extraction and retrieval pipeline",
    motto: "Memory is what turns a stateless model into an agent that learns",
    layer: "context", sourceFiles: ["core/src/memories/"], sourceSize: "~3800 lines",
    prev: "ch08",
  },
  ch10: {
    title: "MCP Integration", subtitle: "Model Context Protocol client and tool bridge",
    motto: "MCP lets any service become a first-class agent tool without forking the agent",
    layer: "ecosystem", sourceFiles: ["core/src/mcp_tool_call.rs"], sourceSize: "~1730 lines",
    prev: "ch09",
  },
  ch11: {
    title: "Skills Injection", subtitle: "Reusable instruction sets loaded at runtime",
    motto: "Skills are prompt engineering made composable and reusable",
    layer: "ecosystem", sourceFiles: ["core/src/skills.rs"], sourceSize: "~230 lines",
    prev: "ch10",
  },
  ch12: {
    title: "Plan Mode", subtitle: "Read-only reasoning before any action",
    motto: "Think before you act — Plan mode enforces this at the architecture level",
    layer: "ecosystem", sourceFiles: ["core/src/codex/turn.rs", "protocol/src/"], sourceSize: "~15900 lines",
    prev: "ch11",
  },
  ch13: {
    title: "Multi-Agent", subtitle: "Spawning and coordinating sub-agents",
    motto: "Scale comes from splitting the problem, not from a bigger context window",
    layer: "ecosystem", sourceFiles: ["core/src/tools/handlers/"], sourceSize: "~1500 lines",
    prev: "ch12",
  },
};

export const LAYERS = [
  { id: "engine" as const,    label: "Engine Core",           color: "#3B82F6", chapters: ["ch01","ch02","ch03"] },
  { id: "tools" as const,     label: "Tools & Security",      color: "#10B981", chapters: ["ch04","ch05","ch06"] },
  { id: "context" as const,   label: "Context Management",    color: "#8B5CF6", chapters: ["ch07","ch08","ch09"] },
  { id: "ecosystem" as const, label: "Protocols & Ecosystem", color: "#EF4444", chapters: ["ch10","ch11","ch12","ch13"] },
] as const;

export const LAYER_COLORS: Record<string, string> = {
  engine:    "#3B82F6",
  tools:     "#10B981",
  context:   "#8B5CF6",
  ecosystem: "#EF4444",
};
