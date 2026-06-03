"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useSteppedVisualization } from "@/hooks/useSteppedVisualization";
import { StepControls } from "@/components/visualizations/shared/step-controls";

// ─── 数据定义 ────────────────────────────────────────────────────────────────
//
// build_initial_context() 的组装过程分两路：
//   developer_sections  → 合并为一条 ResponseItem::DeveloperMessage
//   contextual_user_sections → 合并为一条 ResponseItem::UserMessage
// base_instructions 单独作为 BaseInstructions 字段传给 Prompt

interface Section {
  id: string;
  group: "base" | "dev" | "user" | "tools";
  label: string;
  sublabel: string;
  condition?: string;   // 启用条件
  color: string;
  stroke: string;
}

// 按 build_initial_context() 中的实际追加顺序排列
const SECTIONS: Section[] = [
  // base_instructions — 独立路径
  {
    id: "base", group: "base",
    label: "模型的基础人格与能力",
    sublabel: "base_instructions · models-manager/prompt.md",
    condition: "优先级：config 覆盖 → 历史保存值 → 默认 prompt.md",
    color: "#1d4ed8", stroke: "#3b82f6",
  },
  // developer_sections (codex.rs:2310)
  {
    id: "model_switch", group: "dev",
    label: "模型切换时注入新指令",
    sublabel: "build_model_instructions_update_item()",
    condition: "当前模型与上一轮不同时注入",
    color: "#164e63", stroke: "#06b6d4",
  },
  {
    id: "permissions", group: "dev",
    label: "沙箱权限规则",
    sublabel: "DeveloperInstructions::from_policy()",
    condition: "开启权限提示时注入",
    color: "#164e63", stroke: "#06b6d4",
  },
  {
    id: "developer", group: "dev",
    label: "AGENTS.md 自定义系统指令",
    sublabel: "developer_instructions",
    condition: "存在自定义系统提示时注入",
    color: "#164e63", stroke: "#06b6d4",
  },
  {
    id: "memory", group: "dev",
    label: "长期记忆工具使用规范",
    sublabel: "build_memory_tool_developer_instructions()",
    condition: "启用 MemoryTool 功能时注入",
    color: "#164e63", stroke: "#06b6d4",
  },
  {
    id: "collab", group: "dev",
    label: "协作模式行为约束",
    sublabel: "DeveloperInstructions::from_collaboration_mode()",
    condition: "Plan / Auto 等非默认模式时注入",
    color: "#164e63", stroke: "#06b6d4",
  },
  {
    id: "realtime", group: "dev",
    label: "环境变更实时更新",
    sublabel: "build_initial_realtime_item()",
    condition: "切换工作目录或沙箱策略时注入",
    color: "#164e63", stroke: "#06b6d4",
  },
  {
    id: "personality", group: "dev",
    label: "用户自定义沟通风格",
    sublabel: "personality_spec",
    condition: "模型未内置该人格时注入",
    color: "#164e63", stroke: "#06b6d4",
  },
  {
    id: "apps", group: "dev",
    label: "可用 App / Connector 列表",
    sublabel: "render_apps_section()",
    condition: "开启 Apps 且有可用 connector 时注入",
    color: "#164e63", stroke: "#06b6d4",
  },
  {
    id: "skills", group: "dev",
    label: "Skills 使用规则注入",
    sublabel: "render_skills_section() · SKILL.md",
    condition: "存在可隐式调用的 skill 时注入",
    color: "#164e63", stroke: "#06b6d4",
  },
  {
    id: "plugins", group: "dev",
    label: "已加载插件的能力摘要",
    sublabel: "render_plugins_section()",
    condition: "存在已加载插件时注入",
    color: "#164e63", stroke: "#06b6d4",
  },
  // contextual_user_sections (codex.rs:2311)
  {
    id: "user_inst", group: "user",
    label: "用户自定义偏好",
    sublabel: "UserInstructions · CODEX.md / --instructions",
    condition: "存在用户自定义指令时注入",
    color: "#14532d", stroke: "#22c55e",
  },
  {
    id: "env_ctx", group: "user",
    label: "当前环境信息",
    sublabel: "EnvironmentContext XML · cwd / shell / date / 网络",
    condition: "默认开启，始终注入",
    color: "#14532d", stroke: "#22c55e",
  },
  // tools
  {
    id: "tools", group: "tools",
    label: "发给模型的工具定义列表",
    sublabel: "model_visible_specs() · Vec<ToolSpec>",
    condition: "每次 turn 重新生成，code_mode 会过滤部分工具",
    color: "#7c2d12", stroke: "#f97316",
  },
];

// step → 高亮哪些 section id
const ACTIVE_SECTIONS: string[][] = [
  [],                                                          // 0 总览
  ["base"],                                                    // 1 base_instructions
  ["model_switch", "permissions", "developer"],               // 2 developer前三层
  ["memory", "collab", "realtime"],                           // 3 developer中间层
  ["personality", "apps", "skills", "plugins"],               // 4 developer后四层
  ["user_inst", "env_ctx"],                                    // 5 contextual_user_sections
  ["tools"],                                                   // 6 工具 schema
  ["base","model_switch","permissions","developer","memory",
   "collab","realtime","personality","apps","skills","plugins",
   "user_inst","env_ctx","tools"],                             // 7 合并输出
  ["base","model_switch","permissions","developer","memory",
   "collab","realtime","personality","apps","skills","plugins",
   "user_inst","env_ctx","tools"],                             // 8 发送给模型
];

const STEP_INFO = [
  {
    title: "build_initial_context()：每次 turn 重新组装",
    desc: "codex.rs:2306 — Prompt 不是缓存的，每次 run_turn() 都重新执行 build_initial_context()。组装分两路：developer_sections（合并为 DeveloperMessage）和 contextual_user_sections（合并为 UserMessage）。",
    file: "core/src/codex.rs:2306",
  },
  {
    title: "base_instructions：模型的基础人格",
    desc: "三级优先级：① config.base_instructions 覆盖 → ② 历史会话保存的 base_instructions → ③ model_info.get_model_instructions()（models-manager/prompt.md）。一旦确定，作为 BaseInstructions 字段单独传给 Prompt，不混入 developer_sections。",
    file: "core/src/codex.rs:544",
  },
  {
    title: "developer_sections 前三层",
    desc: "① model_switch：模型切换时注入新指令。② from_policy()：<permissions instructions> 包含 sandbox_policy + approval_policy + exec_policy，模型据此决定哪些命令需要申请批准。③ developer_instructions：来自 AGENTS.md 或 CLI --developer-instructions 的自定义系统级提示。",
    file: "core/src/codex.rs:2329",
  },
  {
    title: "developer_sections 中间层",
    desc: "④ memory 工具指令：当 MemoryTool Feature 启用时，注入长期记忆工具的使用规范。⑤ 协作模式指令：Plan/Default/Auto 模式各有不同的行为约束。⑥ realtime 上下文：diff 方式注入环境变更（切换工作目录、更新沙箱策略等）。",
    file: "core/src/codex.rs:2366",
  },
  {
    title: "developer_sections 后四层",
    desc: "⑦ personality：<personality_spec> 用户自定义的沟通风格，如果模型已内置该 personality 则跳过。⑧ apps：render_apps_section() 列出可用的 connector/app。⑨ skills：render_skills_section() 注入 SKILL.md 列表和使用规则（core-skills/src/render.rs）。⑩ plugins：已加载插件的能力摘要。",
    file: "core/src/codex.rs:2386",
  },
  {
    title: "contextual_user_sections：用户侧上下文",
    desc: "① UserInstructions：序列化为文本，包含用户偏好和 CWD 信息。② EnvironmentContext：serialize_to_xml() 生成 <environment_context> XML，包含 cwd / shell / current_date / timezone / network 允许域名列表。",
    file: "core/src/codex.rs:2440",
  },
  {
    title: "工具 schema：model_visible_specs()",
    desc: "build_prompt() 调用 router.model_visible_specs() 获取发送给模型的工具定义列表。code_mode_only 模式下会过滤掉 code_mode 嵌套工具。defer_loading 的动态工具也会从列表中移除。",
    file: "core/src/codex/turn.rs:957",
  },
  {
    title: "合并为 ResponseItem[] + Prompt",
    desc: "build_developer_update_item(developer_sections) 把所有 developer 层合并为一条 ResponseItem::DeveloperMessage。build_contextual_user_message(contextual_user_sections) 合并为 ResponseItem::UserMessage。最终构成 Prompt { input, tools, base_instructions, parallel_tool_calls, output_schema }。",
    file: "core/src/codex.rs:2462",
  },
  {
    title: "发送给模型 API",
    desc: "build_prompt() 返回的 Prompt 传入 try_run_sampling_request() → client_session.stream(prompt, model_info)，整个 prompt 作为 Responses API 的 input 字段发出，base_instructions 对应 instructions 参数。",
    file: "core/src/codex/turn.rs:1036",
  },
];

const GROUP_LABEL: Record<string, string> = {
  base: "基础人格（BaseInstructions）",
  dev:  "开发者指令层  →  合并为一条 DeveloperMessage",
  user: "用户上下文层  →  合并为一条 UserMessage",
  tools:"工具定义层（Prompt.tools）",
};

const GROUP_COLOR: Record<string, string> = {
  base:  "#1d4ed8",
  dev:   "#0e7490",
  user:  "#15803d",
  tools: "#c2410c",
};

// ─── 主组件 ─────────────────────────────────────────────────────────────────
export default function PromptEngineeringVisualization() {
  const viz = useSteppedVisualization({ totalSteps: 9, autoPlayInterval: 2800 });
  const as_ = ACTIVE_SECTIONS[viz.currentStep];
  const step = STEP_INFO[viz.currentStep];

  // 按 group 分组展示
  const groups = ["base", "dev", "user", "tools"] as const;

  return (
    <section className="space-y-4">

      {/* ── 分层 Prompt 组装图 ── */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-6">
        <div className="mb-4 flex items-center gap-2 font-mono text-sm text-zinc-500">
          <span className="text-blue-400">core/src/codex.rs</span>
          <span>:2306  build_initial_context()</span>
        </div>

        {/* 两列：左=base+dev+user，右=合并结果 */}
        <div className="flex flex-col gap-4 xl:flex-row xl:gap-6">

          {/* 左列：section 堆叠 */}
          <div className="flex-1 xl:flex-[2] space-y-3">
            {groups.map((g) => {
              const secs = SECTIONS.filter(s => s.group === g);
              const anyActive = secs.some(s => as_.includes(s.id));
              return (
                <div key={g}>
                  {/* group 标题 */}
                  <motion.div
                    className="mb-1.5 rounded-t-md px-4 py-1.5 font-mono text-sm font-semibold"
                    animate={{
                      backgroundColor: anyActive ? `${GROUP_COLOR[g]}25` : "#18181b",
                      color: anyActive ? GROUP_COLOR[g] : "#52525b",
                    }}
                    transition={{ duration: 0.3 }}
                  >
                    {GROUP_LABEL[g]}
                  </motion.div>

                  {/* sections — flex-wrap 双列 */}
                  <div className="flex flex-wrap gap-2 rounded-b-md border border-zinc-800 p-3">
                    {secs.map((sec, idx) => {
                      const active = as_.includes(sec.id);
                      return (
                        <motion.div
                          key={sec.id}
                          initial={false}
                          animate={{
                            backgroundColor: active ? `${sec.color}cc` : "#18181b",
                            borderColor: active ? sec.stroke : "#3f3f46",
                            opacity: active ? 1 : 0.45,
                          }}
                          transition={{ duration: 0.3, delay: idx * 0.04 }}
                          className="rounded-md border px-5 py-4 min-w-[260px] flex-1 basis-[calc(50%-0.5rem)]"
                          style={{ filter: active ? `drop-shadow(0 0 6px ${sec.stroke}80)` : "none" }}
                        >
                          <motion.span
                            className="block font-mono text-base font-bold leading-snug"
                            animate={{ color: active ? "#fff" : "#71717a" }}
                            transition={{ duration: 0.3 }}
                          >
                            {sec.label}
                          </motion.span>
                          <motion.p
                            className="mt-1 font-mono text-sm leading-tight"
                            animate={{ color: active ? `${sec.stroke}cc` : "#52525b" }}
                            transition={{ duration: 0.3 }}
                          >
                            {sec.sublabel}
                          </motion.p>
                          {active && sec.condition && (
                            <motion.span
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="mt-1.5 block rounded bg-zinc-950/60 px-2 py-1 font-mono text-xs leading-tight text-zinc-400"
                            >
                              {sec.condition}
                            </motion.span>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 右列：合并输出 + Prompt 结构 */}
          <div className="w-full xl:flex-[1] space-y-4">
            <div className="text-base font-mono text-zinc-400 mb-2 font-semibold">合并输出</div>

            {/* ResponseItem 输出 */}
            {[
              { label: "基础人格",       note: "Prompt.base_instructions",   ids: ["base"],                                                          c: "#1d4ed8", s: "#3b82f6" },
              { label: "开发者系统指令",  note: "所有开发者层 → 1 条消息",     ids: ["model_switch","permissions","developer","memory","collab","realtime","personality","apps","skills","plugins"], c: "#164e63", s: "#06b6d4" },
              { label: "用户上下文",      note: "环境 + 用户偏好 → 1 条消息",  ids: ["user_inst","env_ctx"],                                           c: "#14532d", s: "#22c55e" },
              { label: "工具定义列表",    note: "Prompt.tools",               ids: ["tools"],                                                         c: "#7c2d12", s: "#f97316" },
            ].map(({ label, note, ids, c, s }) => {
              const active = ids.some(id => as_.includes(id));
              return (
                <motion.div
                  key={label}
                  animate={{
                    backgroundColor: active ? `${c}cc` : "#18181b",
                    borderColor: active ? s : "#3f3f46",
                    opacity: active ? 1 : 0.4,
                  }}
                  transition={{ duration: 0.35 }}
                  className="rounded-md border px-5 py-4"
                  style={{ filter: active ? `drop-shadow(0 0 8px ${s}60)` : "none" }}
                >
                  <div className="font-mono text-base font-bold" style={{ color: active ? "#fff" : "#71717a" }}>
                    {label}
                  </div>
                  <div className="font-mono text-sm mt-1" style={{ color: active ? `${s}cc` : "#52525b" }}>
                    {note}
                  </div>
                </motion.div>
              );
            })}

            {/* Prompt 结构框 */}
            <AnimatePresence>
              {viz.currentStep >= 7 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-md border border-blue-500/40 bg-blue-950/30 px-5 py-4"
                >
                  <div className="font-mono text-base text-blue-400 font-bold mb-2">最终 Prompt 结构 {`{`}</div>
                  {[
                    "  input:               对话历史 + 上下文",
                    "  tools:               工具定义列表",
                    "  base_instructions:   基础人格",
                    "  parallel_tool_calls: 是否允许并行",
                    "  output_schema:       结构化输出格式",
                  ].map(line => (
                    <div key={line} className="font-mono text-sm text-zinc-400 leading-relaxed">{line}</div>
                  ))}
                  <div className="font-mono text-base text-blue-400 mt-1">{`}`}</div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 发送标注 */}
            <AnimatePresence>
              {viz.currentStep >= 8 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded-md border border-emerald-500/40 bg-emerald-950/30 px-5 py-4 text-center"
                >
                  <div className="font-mono text-base text-emerald-400 font-semibold">→ 发送给模型 API</div>
                  <div className="font-mono text-sm text-zinc-500 mt-1">client_session.stream() · Responses API</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── 步骤说明 ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={viz.currentStep}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}
          className="rounded-lg border border-zinc-700 bg-zinc-900 p-4"
        >
          <div className="mb-1 text-base font-semibold text-zinc-100">{step.title}</div>
          <div className="text-sm leading-relaxed text-zinc-400">{step.desc}</div>
          <div className="mt-3 font-mono text-[11px] text-zinc-600">{step.file}</div>
        </motion.div>
      </AnimatePresence>

      <StepControls
        currentStep={viz.currentStep} totalSteps={viz.totalSteps}
        onPrev={viz.prev} onNext={viz.next} onReset={viz.reset}
        isPlaying={viz.isPlaying} onToggleAutoPlay={viz.toggleAutoPlay}
        stepTitle={step.title} stepDescription={step.desc}
      />
    </section>
  );
}
