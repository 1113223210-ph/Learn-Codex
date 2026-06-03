"use client";

import dynamic from "next/dynamic";

const AgentLoopViz          = dynamic(() => import("./ch01-agent-loop"),        { ssr: false });
const ToolSystemViz         = dynamic(() => import("./ch02-tool-system"),       { ssr: false });
const PromptEngineeringViz  = dynamic(() => import("./ch03-prompt-engineering"),{ ssr: false });
const ShellExecutionViz     = dynamic(() => import("./ch04-shell-execution"),   { ssr: false });
const SandboxSecurityViz    = dynamic(() => import("./ch05-bash-security"),     { ssr: false });
const PermissionsViz        = dynamic(() => import("./ch06-permissions"),       { ssr: false });
const ContextCompactViz     = dynamic(() => import("./ch07-context-compact"),   { ssr: false });
const MemoriesViz           = dynamic(() => import("./ch08-memories"),          { ssr: false });
const LongTermMemoryViz     = dynamic(() => import("./ch09-memories-longterm"), { ssr: false });
const McpViz                = dynamic(() => import("./ch10-mcp"),               { ssr: false });
const SkillsViz             = dynamic(() => import("./ch11-skills"),            { ssr: false });
const PlanModeViz           = dynamic(() => import("./ch12-plan-mode"),         { ssr: false });
const MultiAgentViz         = dynamic(() => import("./ch13-multi-agent"),       { ssr: false });

const visualizations: Record<string, React.ComponentType> = {
  ch01: AgentLoopViz,
  ch02: ToolSystemViz,
  ch03: PromptEngineeringViz,
  ch04: ShellExecutionViz,
  ch05: SandboxSecurityViz,
  ch06: PermissionsViz,
  ch07: ContextCompactViz,
  ch08: MemoriesViz,
  ch09: LongTermMemoryViz,
  ch10: McpViz,
  ch11: SkillsViz,
  ch12: PlanModeViz,
  ch13: MultiAgentViz,
};

interface ChapterVisualizationProps {
  chapterId: string;
}

export function ChapterVisualization({ chapterId }: ChapterVisualizationProps) {
  const Viz = visualizations[chapterId];
  if (!Viz) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-sm text-zinc-500">
        该章节的交互式可视化正在开发中...
      </div>
    );
  }
  return <Viz />;
}
