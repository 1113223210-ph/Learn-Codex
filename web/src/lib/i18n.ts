export type Locale = "zh" | "en";

/* ─── 通用 UI 文案（仅中文） ─── */
export const UI_TEXT: Record<Locale, {
  nav_home: string;
  nav_learn: string;
  nav_path: string;
  nav_arch: string;
  // hero
  hero_badge: string;
  hero_subtitle_1: string;
  hero_subtitle_2: string;
  hero_cta_start: string;
  hero_cta_arch: string;
  hero_cta_timeline: string;
  // agent loop section
  sec_agent_loop_tag: string;
  sec_agent_loop_title: string;
  sec_agent_loop_desc: string;
  agent_loop_footer: string;
  agent_loop_pause: string;
  agent_loop_play: string;
  // compare section
  sec_compare_tag: string;
  sec_compare_title: string;
  sec_compare_desc: string;
  compare_teaching: string;
  compare_teaching_lang: string;
  compare_teaching_comment: string;
  compare_production: string;
  compare_production_extra: string;
  // arch layers section
  sec_layers_tag: string;
  sec_layers_title: string;
  sec_layers_desc: string;
  layers_chapters_suffix: string;
  // codex features section
  sec_features_tag: string;
  sec_features_title: string;
  sec_features_desc: string;
  sec_features_cta: string;
  // crates section
  sec_crates_tag: string;
  sec_crates_title: string;
  sec_crates_desc: string;
  // learning path section
  sec_path_tag: string;
  sec_path_title: string;
  sec_path_desc: string;
  path_filter_all: string;
  // footer
  footer_quote: string;
  footer_quote_sub: string;
  footer_start: string;
  footer_arch: string;
  // timeline page
  timeline_breadcrumb_home: string;
  timeline_breadcrumb_current: string;
  timeline_title: string;
  timeline_desc: string;
  // architecture page
  arch_breadcrumb_home: string;
  arch_breadcrumb_current: string;
  arch_title: string;
  arch_desc: string;
  arch_data_flow_title: string;
  arch_stats_title: string;
  arch_stats_files: string;
  arch_stats_crates: string;
  arch_stats_lines: string;
  arch_stats_largest: string;
  // chapter page
  chapter_prev: string;
  chapter_next: string;
  chapter_tab_visual: string;
  chapter_tab_sim: string;
  chapter_tab_deep: string;
  chapter_source_files: string;
  chapter_total_size: string;
  chapter_view_source: string;
  // simulator
  sim_title: string;
  sim_no_scenario: string;
  sim_start_hint: string;
}> = {
  zh: {
    nav_home: "首页",
    nav_learn: "学习",
    nav_path: "路径",
    nav_arch: "架构",
    hero_badge: "基于 Codex 开源源码 · 13 章交互式教学",
    hero_subtitle_1: "OpenAI Codex 有 66 万行 Rust 代码，1000+ 文件，6 个核心 crate",
    hero_subtitle_2: "这 13 章带你从 Agent 循环到工程全貌，逐层拆解 Rust 实现。",
    hero_cta_start: "从源码开始",
    hero_cta_arch: "架构总览",
    hero_cta_timeline: "学习路径",
    sec_agent_loop_tag: "SOURCE CODE WALKTHROUGH",
    sec_agent_loop_title: "核心 Agent Loop",
    sec_agent_loop_desc: "所有 AI Agent 的本质是一个循环。Codex 的核心在 core/src/codex/turn.rs (2203行) 中实现。点击每个步骤查看对应的 Rust 源码位置。",
    agent_loop_footer: "工具结果反馈，循环继续",
    agent_loop_pause: "⏸ 暂停自动播放",
    agent_loop_play: "▶ 自动播放",
    sec_compare_tag: "WHY DEEP DIVE",
    sec_compare_title: "30 行代码到 66 万行 Rust",
    sec_compare_desc: "教学版 Agent 的核心循环只要 30 行，但生产级的 Codex 在同一个循环上叠加了多少工程？",
    compare_teaching: "教学版",
    compare_teaching_lang: "~30 行 Python",
    compare_teaching_comment: "# 一个完整的 Agent 核心",
    compare_production: "生产版 Codex (Rust)",
    compare_production_extra: "同一个循环 + 12 层工程",
    sec_layers_tag: "ARCHITECTURE LAYERS",
    sec_layers_title: "四层架构",
    sec_layers_desc: "66 万行 Rust 代码按功能分为四个架构层。点击展开查看每层的核心文件、设计模式和对应章节。",
    layers_chapters_suffix: "章深度解析",
    sec_features_tag: "CODEX 工程特性",
    sec_features_title: "Codex 的 8 个关键工程特性",
    sec_features_desc: "这些特性不是配置选项，而是深入 Rust 源码的架构决策——每一个都值得单独一章。",
    sec_features_cta: "深入 Ch05: 沙箱安全完整解析 →",
    sec_crates_tag: "CORE CRATES",
    sec_crates_title: "核心 Rust Crate",
    sec_crates_desc: "理解这 6 个 crate 的边界，就掌握了整个系统的脉络。代码行数反映了工程复杂度。",
    sec_path_tag: "LEARNING PATH",
    sec_path_title: "13 章源码深潜",
    sec_path_desc: "每章聚焦一个核心子系统，包含 Rust 源码解析 + 架构可视化 + 最小复现示例。按架构层过滤，或按顺序学习。",
    path_filter_all: "全部",
    footer_quote: "给模型工具，然后让开。",
    footer_quote_sub: "但这个「让开」需要 66 万行 Rust、完整的沙箱体系和精心设计的 Agent 循环。",
    footer_start: "开始阅读 →",
    footer_arch: "架构总览 →",
    timeline_breadcrumb_home: "首页",
    timeline_breadcrumb_current: "学习路径",
    timeline_title: "学习路径",
    timeline_desc: "13 章由浅入深，从 Agent 循环到多 Agent 协作",
    arch_breadcrumb_home: "首页",
    arch_breadcrumb_current: "架构总览",
    arch_title: "Codex 架构总览",
    arch_desc: "从顶到底的分层架构，~66 万行 Rust 代码",
    arch_data_flow_title: "数据流",
    arch_stats_title: "代码量统计",
    arch_stats_files: "Rust 文件",
    arch_stats_crates: "核心 Crate",
    arch_stats_lines: "总代码行数",
    arch_stats_largest: "最大文件",
    chapter_prev: "← 上一章",
    chapter_next: "下一章 →",
    chapter_tab_visual: "可视化",
    chapter_tab_sim: "模拟器",
    chapter_tab_deep: "深入",
    chapter_source_files: "核心源码文件",
    chapter_total_size: "代码规模",
    chapter_view_source: "在 GitHub 查看源码 →",
    sim_title: "Agent 循环模拟器",
    sim_no_scenario: "该章节暂无模拟场景",
    sim_start_hint: "点击 播放 或 单步 开始模拟",
  },
  en: {} as never, // 仅中文
};

// en 指向 zh
(UI_TEXT as Record<string, unknown>).en = UI_TEXT.zh;

/* ─── 章节双语标题（en 复用 zh） ─── */
export const CHAPTER_META_I18N: Record<string, Record<Locale, { title: string; subtitle: string; motto: string }>> = {
  ch01: {
    zh: { title: "Agent 循环", subtitle: "每次对话的状态机核心", motto: "所有 Agent 的本质是一个循环：调用模型 → 检查 stop_reason → 分发工具 → 回传结果" },
    en: { title: "Agent 循环", subtitle: "每次对话的状态机核心", motto: "所有 Agent 的本质是一个循环：调用模型 → 检查 stop_reason → 分发工具 → 回传结果" },
  },
  ch02: {
    zh: { title: "工具系统", subtitle: "路由器、Handler 与分发管线", motto: "工具不过是一个 Rust async fn 挂上名字——路由器永远不变" },
    en: { title: "工具系统", subtitle: "路由器、Handler 与分发管线", motto: "工具不过是一个 Rust async fn 挂上名字——路由器永远不变" },
  },
  ch03: {
    zh: { title: "提示词工程", subtitle: "build_initial_context 与动态组装", motto: "System Prompt 不是一个字符串，而是每次对话重新组装的管线" },
    en: { title: "提示词工程", subtitle: "build_initial_context 与动态组装", motto: "System Prompt 不是一个字符串，而是每次对话重新组装的管线" },
  },
  ch04: {
    zh: { title: "Shell 执行", subtitle: "从工具调用到子进程再到结果", motto: "执行 Shell 命令是 Agent 能做的最危险的事——必须如此对待" },
    en: { title: "Shell 执行", subtitle: "从工具调用到子进程再到结果", motto: "执行 Shell 命令是 Agent 能做的最危险的事——必须如此对待" },
  },
  ch05: {
    zh: { title: "沙箱安全", subtitle: "跨平台隔离：macOS / Linux / Windows", motto: "沙箱不是可选项——它是不可信代码能够运行的前提" },
    en: { title: "沙箱安全", subtitle: "跨平台隔离：macOS / Linux / Windows", motto: "沙箱不是可选项——它是不可信代码能够运行的前提" },
  },
  ch06: {
    zh: { title: "权限引擎", subtitle: "每次工具调用前的三阶段编排", motto: "问一次，记一辈子——但执行前永远要验证" },
    en: { title: "权限引擎", subtitle: "每次工具调用前的三阶段编排", motto: "问一次，记一辈子——但执行前永远要验证" },
  },
  ch07: {
    zh: { title: "上下文压缩", subtitle: "控制 Token 预算不超限", motto: "上下文总会满——关键是如何优雅地恢复" },
    en: { title: "上下文压缩", subtitle: "控制 Token 预算不超限", motto: "上下文总会满——关键是如何优雅地恢复" },
  },
  ch08: {
    zh: { title: "短期记忆", subtitle: "会话内的消息历史管理", motto: "对话就是状态——请认真管理它" },
    en: { title: "短期记忆", subtitle: "会话内的消息历史管理", motto: "对话就是状态——请认真管理它" },
  },
  ch09: {
    zh: { title: "长期记忆", subtitle: "两阶段提取与检索管线", motto: "记忆是让无状态模型变成会学习的 Agent 的关键" },
    en: { title: "长期记忆", subtitle: "两阶段提取与检索管线", motto: "记忆是让无状态模型变成会学习的 Agent 的关键" },
  },
  ch10: {
    zh: { title: "MCP 集成", subtitle: "模型上下文协议客户端与工具桥接", motto: "MCP 让任何服务都能成为 Agent 的一等公民工具，无需 fork Agent" },
    en: { title: "MCP 集成", subtitle: "模型上下文协议客户端与工具桥接", motto: "MCP 让任何服务都能成为 Agent 的一等公民工具，无需 fork Agent" },
  },
  ch11: {
    zh: { title: "Skills 注入", subtitle: "运行时加载的可复用指令集", motto: "Skills 是提示词工程的可组合化——写一次，处处复用" },
    en: { title: "Skills 注入", subtitle: "运行时加载的可复用指令集", motto: "Skills 是提示词工程的可组合化——写一次，处处复用" },
  },
  ch12: {
    zh: { title: "Plan 模式", subtitle: "行动前的只读推理阶段", motto: "先想清楚再动手——Plan 模式在架构层面强制执行这一原则" },
    en: { title: "Plan 模式", subtitle: "行动前的只读推理阶段", motto: "先想清楚再动手——Plan 模式在架构层面强制执行这一原则" },
  },
  ch13: {
    zh: { title: "多 Agent", subtitle: "生成和协调子 Agent", motto: "规模化来自拆分问题，而不是更大的上下文窗口" },
    en: { title: "多 Agent", subtitle: "生成和协调子 Agent", motto: "规模化来自拆分问题，而不是更大的上下文窗口" },
  },
};

/* ─── 架构层双语 ─── */
export const LAYER_LABELS_I18N: Record<string, Record<Locale, string>> = {
  engine:    { zh: "引擎核心",   en: "引擎核心" },
  tools:     { zh: "工具与安全", en: "工具与安全" },
  context:   { zh: "上下文管理", en: "上下文管理" },
  ecosystem: { zh: "协议与生态", en: "协议与生态" },
};

/* ─── 架构层详情 ─── */
export const LAYER_DETAILS_I18N: Record<string, Record<Locale, { desc: string; keyPatterns: string[] }>> = {
  engine: {
    zh: {
      desc: "从 codex.rs 的 build_initial_context 开始，经过 turn.rs 的状态机循环，通过 tools/router.rs 分发工具调用。这是整个 Agent 的骨架——3 章、~6000 行 Rust。",
      keyPatterns: ["State Machine Loop", "Tool Router", "Prompt Assembly", "AsyncGenerator Stream"],
    },
    en: {
      desc: "从 codex.rs 的 build_initial_context 开始，经过 turn.rs 的状态机循环，通过 tools/router.rs 分发工具调用。这是整个 Agent 的骨架——3 章、~6000 行 Rust。",
      keyPatterns: ["State Machine Loop", "Tool Router", "Prompt Assembly", "AsyncGenerator Stream"],
    },
  },
  tools: {
    zh: {
      desc: "exec.rs 负责子进程执行，sandboxing/ 实现跨平台沙箱隔离（macOS Seatbelt、Linux seccomp、Windows Job Object），orchestrator.rs 实现三阶段权限编排。",
      keyPatterns: ["Subprocess Execution", "Cross-platform Sandbox", "Permission Orchestration", "execpolicy DSL"],
    },
    en: {
      desc: "exec.rs 负责子进程执行，sandboxing/ 实现跨平台沙箱隔离（macOS Seatbelt、Linux seccomp、Windows Job Object），orchestrator.rs 实现三阶段权限编排。",
      keyPatterns: ["Subprocess Execution", "Cross-platform Sandbox", "Permission Orchestration", "execpolicy DSL"],
    },
  },
  context: {
    zh: {
      desc: "compact.rs 处理 Token 预算超限时的压缩策略，message_history.rs 管理会话内消息历史，memories/ 实现跨会话的两阶段长期记忆提取与检索。",
      keyPatterns: ["Token Budget", "Compaction Strategy", "Message History", "Two-phase Memory"],
    },
    en: {
      desc: "compact.rs 处理 Token 预算超限时的压缩策略，message_history.rs 管理会话内消息历史，memories/ 实现跨会话的两阶段长期记忆提取与检索。",
      keyPatterns: ["Token Budget", "Compaction Strategy", "Message History", "Two-phase Memory"],
    },
  },
  ecosystem: {
    zh: {
      desc: "mcp_tool_call.rs 实现 MCP 协议客户端，skills.rs 运行时加载可复用指令集，turn.rs 的 Plan 分支实现只读推理模式，tools/handlers/ 支持多 Agent 子任务编排。",
      keyPatterns: ["MCP Protocol", "Skills Injection", "Plan Mode", "Sub-Agent Orchestration"],
    },
    en: {
      desc: "mcp_tool_call.rs 实现 MCP 协议客户端，skills.rs 运行时加载可复用指令集，turn.rs 的 Plan 分支实现只读推理模式，tools/handlers/ 支持多 Agent 子任务编排。",
      keyPatterns: ["MCP Protocol", "Skills Injection", "Plan Mode", "Sub-Agent Orchestration"],
    },
  },
};

/* ─── Codex 工程特性卡片 ─── */
export const CODEX_FEATURES_I18N: Record<Locale, Array<{ name: string; flag: string; desc: string; color: string; icon: string }>> = {
  zh: [
    { name: "原生 TUI",      flag: "tui crate",           desc: "Rust 原生终端 UI · 无 Electron · 基于 ratatui 实现",  color: "#3B82F6", icon: "🖥️" },
    { name: "Plan 模式",     flag: "turn.rs",              desc: "只读推理阶段 · 行动前强制规划 · collaboration_mode 架构级实现", color: "#8B5CF6", icon: "📋" },
    { name: "三平台沙箱",    flag: "sandboxing crate",     desc: "macOS Seatbelt · Linux bubblewrap/landlock · Windows restricted token", color: "#10B981", icon: "🛡️" },
    { name: "Ghost Commit",  flag: "ghost_snapshot.rs",    desc: "每个 turn 自动创建 Git 快照 · 支持一键 undo · 完整追踪 Agent 每步修改", color: "#F59E0B", icon: "👻" },
    { name: "Skills 注入",   flag: "skills.rs",            desc: "每 turn 从文件系统动态加载指令集 · 可组合 · 无需修改 Agent 代码", color: "#EF4444", icon: "💉" },
    { name: "MCP 协议",      flag: "mcp_tool_call.rs",     desc: "标准 MCP 客户端实现 · 任意外部服务成为工具 · codex-mcp crate", color: "#06B6D4", icon: "🔌" },
    { name: "两阶段记忆",    flag: "memories/phase1,2.rs", desc: "Phase1 提取 + Phase2 整合 · SQLite 持久化 + Markdown 文件树 · 跨会话积累", color: "#A855F7", icon: "🧠" },
    { name: "Rust 性能",     flag: "core crate",           desc: "零 GC 停顿 · 并发安全 · 无运行时开销",               color: "#F97316", icon: "⚡" },
  ],
  en: [] as never,
};
(CODEX_FEATURES_I18N as Record<string, unknown>).en = CODEX_FEATURES_I18N.zh;

/* ─── Codex 核心 Crate 列表 ─── */
export const CODEX_CRATES_I18N: Record<Locale, Array<{ crate: string; size: string; desc: string; layer: string; detail: string }>> = {
  zh: [
    { crate: "core",          size: "14万行 / 308文件", desc: "Agent 引擎核心",          layer: "engine",    detail: "codex.rs · turn.rs · tools/ · compact.rs · memories/ · skills.rs" },
    { crate: "tui",           size: "13万行",           desc: "原生终端 UI",             layer: "engine",    detail: "Rust 原生 TUI，无 Electron，基于 ratatui 实现" },
    { crate: "app-server",    size: "3.2万行",          desc: "WebSocket/JSON-RPC 服务", layer: "ecosystem", detail: "IDE 插件与 Web 客户端的后端接口，处理会话消息与事件流" },
    { crate: "sandboxing",    size: "~4200行",          desc: "跨平台沙箱隔离",          layer: "tools",     detail: "macOS Seatbelt · Linux bubblewrap/landlock · Windows restricted token" },
    { crate: "execpolicy",    size: "~1800行",          desc: "执行策略 DSL",            layer: "tools",     detail: "声明式规则引擎，定义哪些命令在哪些条件下可执行" },
    { crate: "models-manager",size: "~2100行",          desc: "模型目录与协作模式配置",  layer: "engine",    detail: "models.json 模型目录 · ModelPreset · collaboration_mode 预设" },
  ],
  en: [] as never,
};
(CODEX_CRATES_I18N as Record<string, unknown>).en = CODEX_CRATES_I18N.zh;

/* ─── Agent Loop 步骤 ─── */
export const AGENT_LOOP_STEPS_I18N: Record<Locale, Array<{ id: string; label: string; desc: string; color: string }>> = {
  zh: [
    { id: "input",   label: "用户输入",     desc: "用户在 TUI/CLI 中输入自然语言指令",                             color: "#3B82F6" },
    { id: "build",   label: "构建上下文",   desc: "build_initial_context() 组装系统提示词、记忆、Skills",         color: "#8B5CF6" },
    { id: "call",    label: "调用模型 API", desc: "将完整消息列表发送给模型，等待流式响应",                        color: "#06B6D4" },
    { id: "check",   label: "检查 stop_reason", desc: "判断响应类型：文本输出 / tool_call / end_turn",            color: "#F59E0B" },
    { id: "execute", label: "执行工具",     desc: "三阶段权限检查 → 沙箱隔离 → exec.rs 执行子进程",              color: "#10B981" },
    { id: "loop",    label: "结果回传",     desc: "工具结果追加到消息历史，检查 Token 预算，返回步骤 2 继续推理", color: "#EF4444" },
  ],
  en: [] as never,
};
(AGENT_LOOP_STEPS_I18N as Record<string, unknown>).en = AGENT_LOOP_STEPS_I18N.zh;

/* ─── 生产版对比列表 ─── */
export const COMPARE_ITEMS_I18N: Record<Locale, Array<{ label: string; desc: string; ch: string }>> = {
  zh: [
    { label: "状态机循环",   desc: "turn.rs 的多状态推进，处理 tool_call / end_turn / error", ch: "Ch01" },
    { label: "工具路由",     desc: "router.rs 统一分发，async handler 注册机制",              ch: "Ch02" },
    { label: "动态 Prompt",  desc: "build_initial_context 每次重新组装，Skills 热注入",       ch: "Ch03" },
    { label: "沙箱执行",     desc: "macOS/Linux/Windows 三平台沙箱，exec.rs 子进程隔离",     ch: "Ch04/05" },
    { label: "权限三阶段",   desc: "orchestrator.rs: 审批 → 选择沙箱 → 执行（拒绝时升级沙箱重试）", ch: "Ch06" },
    { label: "Token 压缩",   desc: "compact.rs 阈值检测，自动摘要，预算守护",                 ch: "Ch07" },
    { label: "长期记忆",     desc: "两阶段提取管线，向量存储，跨会话持久化",                  ch: "Ch09" },
    { label: "MCP 协议",     desc: "mcp_tool_call.rs，任意外部服务成为工具",                  ch: "Ch10" },
  ],
  en: [] as never,
};
(COMPARE_ITEMS_I18N as Record<string, unknown>).en = COMPARE_ITEMS_I18N.zh;

/* ─── 教学版缺失项 ─── */
export const TEACHING_LACKS_I18N: Record<Locale, string[]> = {
  zh: ["同步 API 调用", "无沙箱隔离", "无权限检查", "无上下文压缩", "单 Agent"],
  en: [] as never,
};
(TEACHING_LACKS_I18N as Record<string, unknown>).en = TEACHING_LACKS_I18N.zh;

/* ─── 架构层名称（architecture page） ─── */
export const ARCH_LAYERS_I18N: Record<Locale, Array<{ name: string; files: string; size: string; color: string }>> = {
  zh: [
    { name: "TUI 入口",              color: "#3B82F6", files: "tui/src/",                                    size: "13万行" },
    { name: "Agent 引擎 (codex.rs)", color: "#3B82F6", files: "core/src/codex.rs + codex/turn.rs",           size: "~5300行" },
    { name: "Prompt 组装",           color: "#3B82F6", files: "core/src/codex.rs build_initial_context()",   size: "~500行" },
    { name: "工具路由",              color: "#10B981", files: "core/src/tools/router.rs + handlers/",         size: "~2000行" },
    { name: "Shell 执行",            color: "#10B981", files: "core/src/exec.rs",                             size: "1405行" },
    { name: "沙箱隔离",              color: "#10B981", files: "sandboxing/src/ + execpolicy/src/",            size: "~3000行" },
    { name: "权限编排",              color: "#10B981", files: "core/src/tools/orchestrator.rs",               size: "~600行" },
    { name: "上下文压缩",            color: "#8B5CF6", files: "core/src/compact.rs",                          size: "~500行" },
    { name: "记忆系统",              color: "#8B5CF6", files: "core/src/message_history.rs + memories/",      size: "~1200行" },
    { name: "MCP + Skills",          color: "#EF4444", files: "core/src/mcp_tool_call.rs + skills.rs",        size: "~1000行" },
    { name: "Plan 模式 + 多 Agent",  color: "#EF4444", files: "core/src/codex/turn.rs (plan) + handlers/",   size: "~3700行" },
    { name: "HTTP API 服务",         color: "#EF4444", files: "app-server/src/",                              size: "6.8万行" },
  ],
  en: [] as never,
};
(ARCH_LAYERS_I18N as Record<string, unknown>).en = ARCH_LAYERS_I18N.zh;

/* ─── 本地化文本辅助函数 ─── */
import { LocalizedText } from "@/types/agent-data";

export function getLocalizedText(text: LocalizedText, locale: Locale = "zh"): string {
  if (typeof text === "string") {
    return text;
  }
  return text[locale] || text.zh;
}
