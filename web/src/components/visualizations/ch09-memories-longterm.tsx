"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useSteppedVisualization } from "@/hooks/useSteppedVisualization";
import { StepControls } from "@/components/visualizations/shared/step-controls";

// core/src/memories/ — 长期记忆系统
// mod.rs: Phase1 model=gpt-5.4-mini effort=Low concurrency=8
//         Phase2 model=gpt-5.4     effort=Medium heartbeat=90s
//         memory_summary injection limit = 5_000 tokens
//         rollout token limit = 150_000 (70% context window)
// start.rs:  start_memories_startup_task() — session.rs:836
// phase1.rs: claim → sample → persist → enqueue
// phase2.rs: claim_global → get_config → sync_fs → spawn_subagent → handle
// prompts.rs: build_stage_one_input_message, build_consolidation_prompt,
//             build_memory_tool_developer_instructions
// storage.rs: rebuild_raw_memories_file, sync_rollout_summaries,
//             rollout_summary_file_stem (timestamp-hash-slug)
// citations.rs: parse <oai-mem-citation> → MemoryCitation
// extensions.rs: EXTENSION_RESOURCE_RETENTION_DAYS = 7

type TabId = "overview" | "phase1" | "phase2" | "inject" | "citation" | "files";

interface StepData {
  id: string;
  title: string;
  source: string;
  code: string;
  detail: string;
}

const PHASE1_STEPS: StepData[] = [
  {
    id: "p1-skip",
    title: "跳过检查",
    source: "start.rs:19",
    code: `// start.rs:19
if config.ephemeral
    || !config.features.enabled(Feature::MemoryTool)
    || matches!(source, SessionSource::SubAgent(_))
{
    return;
}
if session.services.state_db.is_none() {
    warn!("state db unavailable; skipping");
    return;
}`,
    detail: "三个跳过条件：①临时会话 ②Feature::MemoryTool 未启用 ③SubAgent 会话。state_db 不存在也跳过（需要 Feature::Sqlite）。",
  },
  {
    id: "p1-claim",
    title: "争抢 Stage1 Jobs",
    source: "phase1.rs:196",
    code: `// phase1.rs — claim_startup_jobs()
state_db.claim_stage1_jobs_for_startup(
    session.conversation_id,
    Stage1StartupClaimParams {
        scan_limit:             5_000,
        max_claimed:            config.memories.max_rollouts_per_startup, // default 16
        max_age_days:           config.memories.max_rollout_age_days,     // default 30
        min_rollout_idle_hours: config.memories.min_rollout_idle_hours,   // default 6
        allowed_sources:        INTERACTIVE_SESSION_SOURCES,
        lease_seconds:          3_600,
    },
).await`,
    detail: "从 SQLite threads 表扫描：memory_mode='enabled', idle≥6h, 30天内, stage1_outputs 已过期。返回 ≤16 个 Stage1JobClaim。",
  },
  {
    id: "p1-sample",
    title: "LLM 提取",
    source: "phase1.rs:312",
    code: `// phase1.rs — job::sample()
// 1. 加载 rollout .jsonl 文件
let (rollout_items, _, _) =
    RolloutRecorder::load_rollout_items(rollout_path).await?;
// 2. 过滤：去掉 developer role, memory-excluded 片段
let rollout_contents =
    serialize_filtered_rollout_response_items(&rollout_items)?;
// 3. 构建 prompt（截断到 70% context window）
let msg = build_stage_one_input_message(
    &model_info, rollout_path, rollout_cwd, &rollout_contents)?;
// 4. 调用模型（结构化输出 JSON schema）
// 系统提示: stage_one_system.md (569行 Memory Writing Agent)
// 模型: gpt-5.4-mini, effort: Low
// 输出 schema: {raw_memory, rollout_summary, rollout_slug}
let mut output: StageOneOutput = serde_json::from_str(&result)?;
output.raw_memory = redact_secrets(output.raw_memory);`,
    detail: "stage_one_system.md 是 569 行的 Memory Writing Agent 提示，包含高信号记忆定义、NO-OP 规则、安全规范。rollout 内容截断到 70% context window（默认 150K token 兜底）。",
  },
  {
    id: "p1-persist",
    title: "持久化 + 触发 Phase2",
    source: "phase1.rs:448",
    code: `// phase1.rs — result::success()
state_db.mark_stage1_job_succeeded(
    thread_id,
    &claim.ownership_token,
    source_updated_at,        // = thread.updated_at.timestamp()
    &stage_one_output.raw_memory,
    &stage_one_output.rollout_summary,
    stage_one_output.rollout_slug.as_deref(),
).await?;
// 内部自动调用：
// enqueue_global_consolidation(source_updated_at)
// → jobs 表 kind='memory_consolidate_global' input_watermark 推进`,
    detail: "stage1_outputs 表 upsert：只有 source_updated_at 更新或相等时才替换。成功后立即 enqueue Phase2，input_watermark 推进保证下次 Phase2 能感知到新数据。",
  },
];

const PHASE2_STEPS: StepData[] = [
  {
    id: "p2-claim",
    title: "争抢全局单例 Job",
    source: "phase2.rs:212",
    code: `// phase2.rs — job::claim()
// 全局单例：kind='memory_consolidate_global', job_key='global'
state_db.try_claim_global_phase2_job(
    session.conversation_id,
    JOB_LEASE_SECONDS, // 3_600s
).await?
// 返回值：
// Claimed { ownership_token, input_watermark } → 继续
// SkippedNotDirty → input_watermark <= last_success_watermark，无新数据
// SkippedRunning  → 另一 worker 持有有效 lease`,
    detail: "全局单例意味着集群中所有并发会话只有一个 Phase2 在运行。input_watermark > last_success_watermark 才触发，避免无谓 LLM 调用。",
  },
  {
    id: "p2-config",
    title: "构建 SubAgent 配置",
    source: "phase2.rs:295",
    code: `// phase2.rs — agent::get_config()
agent_config.cwd = memory_root(&config.codex_home); // ~/.codex/memories/
agent_config.memories.generate_memories = false;    // 禁止递归记忆生成
agent_config.permissions.approval_policy =
    Constrained::allow_only(AskForApproval::Never);
// 禁用不必要的 features
let _ = agent_config.features.disable(Feature::SpawnCsv);
let _ = agent_config.features.disable(Feature::Collab);
let _ = agent_config.features.disable(Feature::MemoryTool);
// 沙箱：只允许写 codex_home，无网络
agent_config.permissions.sandbox_policy =
    SandboxPolicy::WorkspaceWrite {
        writable_roots: vec![codex_home],
        network_access: false, ..
    };
agent_config.model = Some("gpt-5.4".into());
agent_config.model_reasoning_effort = Some(ReasoningEffort::Medium);`,
    detail: "Phase2 运行为 SubAgent，CWD 是 ~/.codex/memories/。禁用了 SpawnCsv/Collab/MemoryTool，防止递归或无限扩展。沙箱仅允许写 codex_home，无网络访问。",
  },
  {
    id: "p2-sync",
    title: "同步文件系统",
    source: "phase2.rs:100",
    code: `// phase2.rs — 同步 FS（在 spawn agent 之前）
// 1. 同步 rollout_summaries/*.md
sync_rollout_summaries_from_memories(
    &root, &artifact_memories, max_raw_memories).await?;
// 2. 重建 raw_memories.md
rebuild_raw_memories_file_from_memories(
    &root, &artifact_memories, max_raw_memories).await?;
// 3. 查找过期 extension 资源（7天）
let pending_removals =
    find_old_extension_resources(&root).await;

// storage.rs — rollout_summary_file_stem 格式：
// {YYYY-MM-DDTHH-MM-SS}-{4char-base62-hash}[-{slug}]
// 例: 2026-05-29T10-30-00-3aB9-auth_module_refactor.md`,
    detail: "先同步 FS 再 spawn agent，确保 agent 能读到最新的 raw_memories.md 和 rollout_summaries/。4字符 base62 hash 来自 UUID 低32位，确保文件名唯一且可读。",
  },
  {
    id: "p2-agent",
    title: "Spawn SubAgent + Heartbeat",
    source: "phase2.rs:139",
    code: `// phase2.rs — 构建 consolidation prompt
let prompt = build_consolidation_prompt(
    &root, &selection, &removed_extension_resources);
// consolidation.md (835行) 包含：
//   Phase2 diff: added/retained/removed thread_ids
//   输出文件要求: MEMORY.md, memory_summary.md, skills/*
//   INIT vs INCREMENTAL UPDATE 模式
//   渐进式遗忘机制

// Spawn SubAgent
let thread_id = session.services.agent_control
    .spawn_agent(agent_config, prompt.into(),
        Some(SessionSource::SubAgent(
            SubAgentSource::MemoryConsolidation
        ))).await?;

// Heartbeat 循环（每 90s 续约 lease）
// 若 heartbeat 失败 → AgentStatus::Errored
// 成功后 mark_global_phase2_job_succeeded() + 删除 extension 资源`,
    detail: "Phase2 agent 以完整的 SubAgent 身份运行，有独立的 session/rollout。Heartbeat 每 90s 续约 3600s lease，防止长时间整合因 lease 过期被抢占。",
  },
];

const INJECT_STEPS: StepData[] = [
  {
    id: "inj-build",
    title: "构建开发者指令",
    source: "prompts.rs:265",
    code: `// prompts.rs — build_memory_tool_developer_instructions()
pub(crate) async fn build_memory_tool_developer_instructions(
    codex_home: &AbsolutePathBuf,
) -> Option<String> {
    let base_path = memory_root(codex_home); // ~/.codex/memories/
    let memory_summary_path = base_path.join("memory_summary.md");
    let memory_summary =
        fs::read_to_string(&memory_summary_path).await.ok()?
            .trim().to_string();
    // 截断到 5_000 tokens
    let memory_summary = truncate_text(
        &memory_summary,
        TruncationPolicy::Tokens(5_000));
    if memory_summary.is_empty() { return None; }
    // 渲染 read_path.md 模板
    MEMORY_TOOL_DEVELOPER_INSTRUCTIONS_TEMPLATE.render([
        ("base_path", base_path.as_str()),
        ("memory_summary", memory_summary.as_str()),
    ]).ok()
}`,
    detail: "只有 memory_summary.md 存在且非空时才注入。截断到 5K tokens 防止占用过多 context。read_path.md 模板（129行）包含内存布局、quick pass 协议、引用要求。",
  },
  {
    id: "inj-when",
    title: "注入时机（每轮）",
    source: "codex.rs:2366",
    code: `// core/src/codex.rs:2366 — 每次 turn 的 developer instructions 组装
if turn_context.features.enabled(Feature::MemoryTool)
    && turn_context.config.memories.use_memories
    && let Some(memory_prompt) =
        build_memory_tool_developer_instructions(
            &turn_context.config.codex_home).await
{
    developer_sections.push(memory_prompt);
}
// 条件：Feature::MemoryTool 启用
//      config.memories.use_memories = true
//      memory_summary.md 存在且非空`,
    detail: "注入是 per-turn 的，每次采样前重新构建。这意味着 memory_summary.md 更新后，下一个 turn 立即生效。",
  },
  {
    id: "inj-template",
    title: "read_path.md 内容要点",
    source: "templates/memories/read_path.md",
    code: `// read_path.md (129行) 关键内容：

## Memory Layout (general -> specific):
- {base_path}/memory_summary.md (已嵌入，不要重复打开)
- {base_path}/MEMORY.md         (关键词检索；主文件)
- {base_path}/skills/<name>/    (SKILL.md 入口)
- {base_path}/rollout_summaries/ (per-rollout 摘要)

## Quick Memory Pass (≤4-6 步):
1. 从 MEMORY_SUMMARY 提取关键词
2. 检索 MEMORY.md
3. 仅在 MEMORY.md 指向时才打开 rollout_summaries/ 或 skills/
4. 若需精确证据，检索 rollout_path 原始文件
5. 无命中 → 停止，正常继续

## Memory Citation 要求：
// 若使用了任何记忆文件，在回复末尾追加：
<oai-mem-citation>
<citation_entries>
MEMORY.md:234-236|note=[...]
</citation_entries>
<rollout_ids>
019c6e27-e55b-73d1-87d8-4e01f1f75043
</rollout_ids>
</oai-mem-citation>`,
    detail: "Quick memory pass 有严格的 budget：≤4-6 步。避免全量扫描 rollout_summaries/。citation 是强制要求，使用了记忆文件就必须附。",
  },
];

const CITATION_CONTENT = {
  code: `// citations.rs — parse_memory_citation()
// 解析格式：
<oai-mem-citation>
<citation_entries>
MEMORY.md:234-236|note=[auth module refactor pointer]
rollout_summaries/2026-05-29T10-30-00-3aB9-auth_module_refactor.md:10-12|note=[OAuth fix]
</citation_entries>
<rollout_ids>
019c6e27-e55b-73d1-87d8-4e01f1f75043
</rollout_ids>
</oai-mem-citation>

// 解析结果：
MemoryCitation {
    entries: [
        MemoryCitationEntry {
            path: "MEMORY.md",
            line_start: 234, line_end: 236,
            note: "auth module refactor pointer",
        },
    ],
    rollout_ids: ["019c6e27-..."],
}

// 后续处理：
// get_thread_id_from_citations() → Vec<ThreadId>
// state_db.record_stage1_output_usage(thread_ids)
// → UPDATE stage1_outputs
//     SET usage_count = usage_count + 1, last_usage = now
//     WHERE thread_id = ?
// usage_count 影响 Phase2 selection 排序：
// ORDER BY usage_count DESC, last_usage DESC`,
  detail: "引用追踪是 memories 系统的闭环：Phase2 选择记忆时优先选 usage_count 高的，这些记忆是被模型实际使用过的，形成正向反馈。",
};

const FILE_LAYOUT = `~/.codex/
└── memories/
    ├── memory_summary.md          ← 每轮注入（≤5K tokens），高度导航性
    ├── MEMORY.md                  ← 手册条目，关键词检索，Phase2 主要维护
    ├── raw_memories.md            ← Phase2 输入：合并 Stage1 raw_memory
    ├── rollout_summaries/
    │   └── <timestamp>-<hash>[-<slug>].md   ← per-rollout 摘要
    │       # 例: 2026-05-29T10-30-00-3aB9-auth_module_refactor.md
    │       # 内容: thread_id, updated_at, cwd, git_branch, rollout_summary
    └── skills/
        └── <skill-name>/
            ├── SKILL.md           ← 入口指令
            ├── scripts/
            ├── templates/
            └── examples/

~/.codex/memories_extensions/      ← 与 memories/ 同级（不在其内）
    └── <extension-name>/
        ├── instructions.md        ← 必须存在才被识别
        └── resources/
            └── <YYYY-MM-DDTHH-MM-SS>-<id>.md   ← 7天后被修剪

~/.codex/state.db                  ← SQLite（Feature::Sqlite）
    ├── stage1_outputs             ← Phase1 输出
    └── jobs                       ← memory_stage1 / memory_consolidate_global`;

export default function LongTermMemoryVisualization() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const phase1Viz = useSteppedVisualization({ totalSteps: PHASE1_STEPS.length, autoPlayInterval: 5000 });
  const phase2Viz = useSteppedVisualization({ totalSteps: PHASE2_STEPS.length, autoPlayInterval: 5000 });
  const injectViz = useSteppedVisualization({ totalSteps: INJECT_STEPS.length, autoPlayInterval: 5000 });

  const TABS: { id: TabId; label: string; active: string; inactive: string }[] = [
    { id: "overview", label: "全局流程", active: "border-emerald-500 text-emerald-300 bg-emerald-950/40", inactive: "border-zinc-700 text-zinc-400 hover:text-zinc-200" },
    { id: "phase1",   label: "Phase1 提取", active: "border-amber-500 text-amber-300 bg-amber-950/40", inactive: "border-zinc-700 text-zinc-400 hover:text-zinc-200" },
    { id: "phase2",   label: "Phase2 整合", active: "border-violet-500 text-violet-300 bg-violet-950/40", inactive: "border-zinc-700 text-zinc-400 hover:text-zinc-200" },
    { id: "inject",   label: "注入读取", active: "border-sky-500 text-sky-300 bg-sky-950/40", inactive: "border-zinc-700 text-zinc-400 hover:text-zinc-200" },
    { id: "citation", label: "引用追踪", active: "border-rose-500 text-rose-300 bg-rose-950/40", inactive: "border-zinc-700 text-zinc-400 hover:text-zinc-200" },
    { id: "files",    label: "文件布局", active: "border-zinc-400 text-zinc-200 bg-zinc-800/60", inactive: "border-zinc-700 text-zinc-400 hover:text-zinc-200" },
  ];

  return (
    <section className="space-y-4">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded border px-3 py-1.5 font-mono text-sm transition-colors ${activeTab === tab.id ? tab.active : tab.inactive}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

          {/* ── 全局流程 ── */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              <svg viewBox="0 0 1280 380" className="w-full rounded-md border border-zinc-800 bg-zinc-950">
                <defs>
                  {(["#0ea5e9","#f59e0b","#22c55e","#8b5cf6","#10b981","#f43f5e"] as const).map((c, i) => (
                    <marker key={i} id={`a9${i}`} markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto">
                      <polygon points="0 0,10 4,0 8" fill={c}/>
                    </marker>
                  ))}
                </defs>

                {/* 外框 + 标题 */}
                <rect x="8" y="8" width="1264" height="364" rx="10" fill="none" stroke="#10b98128" strokeWidth={1.5} strokeDasharray="8 5"/>
                <rect x="12" y="0" width="280" height="20" fill="#09090b"/>
                <text x="16" y="15" fontSize={13} fontFamily="monospace" fill="#34d399">Codex 长期记忆 — core/src/memories/</text>

                {/* ── 行1 标签（写入路径）── */}
                <text x="28" y="36" fontSize={11} fontFamily="monospace" fill="#52525b">① 写入路径（后台，会话启动触发）→</text>

                {/* ── 行1 方块 x=[28,284,540,796,1052] w=200 y=44 h=70 center_y=79 ── */}
                {([
                  { x:28,   label:"会话启动",     sub:"session.rs:836",    sub2:"start_memories_startup_task()",  stroke:"#0ea5e9", fill:"#03131f", tc:"#38bdf8", sc:"#7dd3fc" },
                  { x:284,  label:"prune 清理",   sub:"phase1.rs:126",     sub2:"stale stage1_outputs 修剪",       stroke:"#f59e0b", fill:"#1a1008", tc:"#fbbf24", sc:"#fde68a" },
                  { x:540,  label:"Phase1 提取",  sub:"gpt-5.4-mini  ×8",  sub2:"≤16 rollouts 并发提取",           stroke:"#22c55e", fill:"#0f1a0a", tc:"#4ade80", sc:"#86efac" },
                  { x:796,  label:"Phase1 持久化",sub:"stage1_outputs",     sub2:"enqueue Phase2",                  stroke:"#8b5cf6", fill:"#100a1f", tc:"#a78bfa", sc:"#ddd6fe" },
                  { x:1052, label:"Phase2 整合",  sub:"gpt-5.4 SubAgent",  sub2:"spawn consolidation agent",       stroke:"#10b981", fill:"#0d1f0d", tc:"#34d399", sc:"#6ee7b7" },
                ] as {x:number;label:string;sub:string;sub2:string;stroke:string;fill:string;tc:string;sc:string}[]).map(n => (
                  <g key={n.x}>
                    <rect x={n.x} y="44" width="200" height="70" rx="8" fill={n.fill} stroke={n.stroke} strokeWidth={1.8}/>
                    <text x={n.x+100} y="68" textAnchor="middle" fontSize={15} fontWeight={700} fontFamily="monospace" fill={n.tc}>{n.label}</text>
                    <text x={n.x+100} y="85" textAnchor="middle" fontSize={12} fontFamily="monospace" fill={n.sc}>{n.sub}</text>
                    <text x={n.x+100} y="102" textAnchor="middle" fontSize={11} fontFamily="monospace" fill={n.stroke+"70"}>{n.sub2}</text>
                  </g>
                ))}

                {/* ── 行1 箭头 y=79（方块中心）x1=右边缘 x2=下个方块左边缘 ── */}
                {([[228,284,"#0ea5e9",0],[484,540,"#f59e0b",1],[740,796,"#22c55e",2],[996,1052,"#8b5cf6",3]] as [number,number,string,number][]).map(([x1,x2,c,mi],idx)=>(
                  <line key={idx} x1={x1} y1={79} x2={x2} y2={79} stroke={c} strokeWidth={1.5} markerEnd={`url(#a9${mi})`}/>
                ))}

                {/* ── 垂直连接：Phase2整合 bottom → 记忆文件 top（x=center of box[4]=1152）── */}
                <line x1="1152" y1="114" x2="1152" y2="176" stroke="#10b981" strokeWidth={1.5} markerEnd="url(#a94)"/>

                {/* ── 行2 标签（读取路径）── */}
                <text x="28" y="175" fontSize={11} fontFamily="monospace" fill="#52525b">← ② 读取路径（前台，每个 turn，形成正向反馈闭环）</text>

                {/* ── 行2 方块 x=[28,284,540,796,1052] w=200 y=183 h=70 center_y=218 ── */}
                {([
                  { x:28,   label:"usage 反馈",  sub:"citations.rs",      sub2:"usage_count → Phase2 排序",       stroke:"#ef4444", fill:"#1a0808", tc:"#fca5a5", sc:"#fca5a5" },
                  { x:284,  label:"引用追踪",    sub:"<oai-mem-citation>", sub2:"record_stage1_output_usage()",    stroke:"#f43f5e", fill:"#1f080c", tc:"#fb7185", sc:"#fda4af" },
                  { x:540,  label:"模型读取",    sub:"grep MEMORY.md",     sub2:"Quick Pass ≤4-6 步",              stroke:"#f43f5e", fill:"#1f080c", tc:"#fb7185", sc:"#fda4af" },
                  { x:796,  label:"记忆注入",    sub:"codex.rs:2366",      sub2:"memory_summary.md ≤5K",           stroke:"#f43f5e", fill:"#1f080c", tc:"#fb7185", sc:"#fda4af" },
                  { x:1052, label:"记忆文件",    sub:"~/.codex/memories/", sub2:"MEMORY.md + memory_summary.md",   stroke:"#10b981", fill:"#0d1f0d", tc:"#34d399", sc:"#6ee7b7" },
                ] as {x:number;label:string;sub:string;sub2:string;stroke:string;fill:string;tc:string;sc:string}[]).map(n => (
                  <g key={n.x}>
                    <rect x={n.x} y="183" width="200" height="70" rx="8" fill={n.fill} stroke={n.stroke} strokeWidth={1.8}/>
                    <text x={n.x+100} y="207" textAnchor="middle" fontSize={15} fontWeight={700} fontFamily="monospace" fill={n.tc}>{n.label}</text>
                    <text x={n.x+100} y="224" textAnchor="middle" fontSize={12} fontFamily="monospace" fill={n.sc}>{n.sub}</text>
                    <text x={n.x+100} y="241" textAnchor="middle" fontSize={11} fontFamily="monospace" fill={n.stroke+"70"}>{n.sub2}</text>
                  </g>
                ))}

                {/* ── 行2 箭头 y=218（方块中心）x1=左边缘 x2=前一方块右边缘（向左）── */}
                {([[1052,996,"#10b981",4],[796,740,"#f43f5e",5],[540,484,"#f43f5e",5],[284,228,"#ef4444",5]] as [number,number,string,number][]).map(([x1,x2,c,mi],idx)=>(
                  <line key={idx} x1={x1} y1={218} x2={x2} y2={218} stroke={c} strokeWidth={1.5} markerEnd={`url(#a9${mi})`}/>
                ))}

                {/* ── 常量区 ── */}
                <rect x="28" y="292" width="1224" height="62" rx="6" fill="#0a0a0a" stroke="#27272a"/>
                {([
                  ["Phase1 模型","gpt-5.4-mini  effort=Low","#fbbf24"],
                  ["Phase1 并发","CONCURRENCY_LIMIT = 8","#fbbf24"],
                  ["rollout token","150_000 (70% ctx window)","#fbbf24"],
                  ["Phase2 模型","gpt-5.4  effort=Medium","#c4b5fd"],
                  ["Phase2 heartbeat","每 90s 续约 3600s lease","#c4b5fd"],
                  ["注入上限","memory_summary ≤5000 tokens","#c4b5fd"],
                ] as [string,string,string][]).map(([k,v,c],i) => (
                  <g key={i}>
                    <text x={44+i*204} y="312" fontSize={11} fontFamily="monospace" fill="#52525b">{k}</text>
                    <text x={44+i*204} y="340" fontSize={12} fontFamily="monospace" fill={c}>{v}</text>
                  </g>
                ))}
              </svg>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                {[
                  ["Feature 开关","Feature::MemoryTool  key=\"memories\"","text-amber-300"],
                  ["跳过条件","ephemeral || SubAgent || !state_db","text-red-400"],
                  ["Phase1 重试","DEFAULT_RETRY_REMAINING=3  backoff=3600s","text-orange-300"],
                  ["Phase2 单例","job_key='global'  全系统只运行一个","text-violet-300"],
                  ["污染检测","web_search → memory_mode='polluted'","text-rose-300"],
                  ["extensions TTL","EXTENSION_RESOURCE_RETENTION_DAYS=7","text-zinc-400"],
                ].map(([k,v,c]) => (
                  <div key={k} className="rounded border border-zinc-800 bg-zinc-950 p-3">
                    <div className="text-xs text-zinc-500 font-mono mb-1">{k}</div>
                    <div className={`text-sm font-mono ${c}`}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Phase1 ── */}
          {activeTab === "phase1" && (
            <div className="space-y-4">
              <StepPanel steps={PHASE1_STEPS} viz={phase1Viz} accentColor="amber"/>
            </div>
          )}

          {/* ── Phase2 ── */}
          {activeTab === "phase2" && (
            <div className="space-y-4">
              <StepPanel steps={PHASE2_STEPS} viz={phase2Viz} accentColor="violet"/>
            </div>
          )}

          {/* ── 注入读取 ── */}
          {activeTab === "inject" && (
            <div className="space-y-4">
              <StepPanel steps={INJECT_STEPS} viz={injectViz} accentColor="sky"/>
            </div>
          )}

          {/* ── 引用追踪 ── */}
          {activeTab === "citation" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-rose-800 bg-rose-950/20 p-4">
                <div className="font-mono text-base font-bold text-rose-300 mb-2">引用追踪 — citations.rs</div>
                <p className="text-sm text-zinc-300 mb-3">{CITATION_CONTENT.detail}</p>
              </div>
              <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
                <div className="mb-2 font-mono text-xs text-zinc-500">citations.rs + usage 追踪流程</div>
                <pre className="overflow-x-auto rounded border border-zinc-800 bg-zinc-950 p-4 font-mono text-sm text-zinc-300 whitespace-pre leading-relaxed">
                  {CITATION_CONTENT.code}
                </pre>
              </div>
            </div>
          )}

          {/* ── 文件布局 ── */}
          {activeTab === "files" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
                <div className="mb-2 font-mono text-xs text-zinc-500">~/.codex/ 文件系统布局（storage.rs + mod.rs）</div>
                <pre className="overflow-x-auto rounded border border-zinc-800 bg-zinc-950 p-4 font-mono text-sm text-zinc-300 whitespace-pre leading-relaxed">
                  {FILE_LAYOUT}
                </pre>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["memory_summary.md","每轮注入，高度导航性。截断到 5K tokens。Phase2 维护。","text-rose-300"],
                  ["MEMORY.md","手册条目，关键词检索。Phase2 主要写入目标。agent 用 grep 查。","text-emerald-300"],
                  ["raw_memories.md","Phase2 临时输入文件。合并所有 Stage1 raw_memory，最新在前。","text-amber-300"],
                  ["rollout_summaries/*.md","格式: thread_id + updated_at + cwd + git_branch + rollout_summary。4char base62 hash 保证唯一性。","text-sky-300"],
                  ["skills/<name>/SKILL.md","可复用过程。Phase2 可选创建。含 scripts/templates/examples/。","text-violet-300"],
                  ["memories_extensions/","外部扩展，7天 TTL。每个 extension 必须有 instructions.md。","text-zinc-400"],
                ].map(([k,v,c]) => (
                  <div key={k} className="rounded border border-zinc-800 bg-zinc-950 p-3">
                    <div className={`text-sm font-mono mb-1 ${c}`}>{k}</div>
                    <div className="text-xs text-zinc-400">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </motion.div>
      </AnimatePresence>
    </section>
  );
}

// ─── 共享步骤面板组件 ─────────────────────────────────────────────────────────

type AccentColor = "amber" | "violet" | "sky";

const ACCENT: Record<AccentColor, { border: string; bg: string; text: string; dot: string }> = {
  amber:  { border: "border-amber-700",  bg: "bg-amber-950/30",  text: "text-amber-300",  dot: "#f59e0b" },
  violet: { border: "border-violet-700", bg: "bg-violet-950/30", text: "text-violet-300", dot: "#8b5cf6" },
  sky:    { border: "border-sky-700",    bg: "bg-sky-950/30",    text: "text-sky-300",    dot: "#0ea5e9" },
};

function StepPanel({
  steps, viz, accentColor,
}: {
  steps: StepData[];
  viz: ReturnType<typeof useSteppedVisualization>;
  accentColor: AccentColor;
}) {
  const a = ACCENT[accentColor];
  const current = steps[viz.currentStep] ?? steps[0];
  const stepInfos = steps.map(s => ({ title: s.title, description: s.detail }));
  const stepInfo = stepInfos[viz.currentStep] ?? stepInfos[0];

  return (
    <>
      {/* step indicator row */}
      <div className="flex gap-2 flex-wrap">
        {steps.map((s, i) => (
          <button
            key={s.id}
            onClick={() => { for (let k = viz.currentStep; k < i; k++) viz.next(); for (let k = viz.currentStep; k > i; k--) viz.prev(); }}
            className={`flex items-center gap-2 rounded border px-3 py-1.5 font-mono text-sm transition-colors ${i === viz.currentStep ? `${a.border} ${a.bg} ${a.text}` : "border-zinc-800 text-zinc-500 hover:text-zinc-300"}`}
          >
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: i === viz.currentStep ? a.dot : "#52525b" }}/>
            {s.title}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={current.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
          <div className={`rounded-lg border p-4 ${a.border} ${a.bg}`}>
            <div className="flex items-center gap-3 mb-2">
              <span className="h-3 w-3 rounded-full shrink-0" style={{ background: a.dot }}/>
              <span className={`font-mono text-base font-bold ${a.text}`}>{current.title}</span>
              <span className="font-mono text-xs text-zinc-500 ml-auto">{current.source}</span>
            </div>
            <p className="text-sm text-zinc-300">{current.detail}</p>
          </div>
          <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
            <div className="mb-2 font-mono text-xs text-zinc-500">源码 — {current.source}</div>
            <pre className="overflow-x-auto rounded border border-zinc-800 bg-zinc-950 p-4 font-mono text-sm text-zinc-300 whitespace-pre leading-relaxed">
              {current.code}
            </pre>
          </div>
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
        stepTitle={stepInfo.title}
        stepDescription={stepInfo.description}
      />
    </>
  );
}
