"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useSteppedVisualization } from "@/hooks/useSteppedVisualization";
import { StepControls } from "@/components/visualizations/shared/step-controls";

// ─── ch11 Skills 注入系统（codex-rs 真实源码）────────────────────────────────
//
// core-skills/src/loader.rs       — 多层 skill 根目录发现 + SKILL.md 解析
// core-skills/src/render.rs       — render_skills_section() → 隐式注入
// core-skills/src/injection.rs    — build_skill_injections() → 显式注入
// core/src/codex.rs:2417          — developer_sections.push(skills_section)
// core/src/codex/turn.rs:210      — collect_explicit_skill_mentions()
// instructions/src/fragment.rs    — SKILL_FRAGMENT (<skill>...</skill>)
// core/src/mcp_skill_dependencies.rs — MCP 依赖自动安装
// skills/src/lib.rs               — 内嵌系统 skills（编译时 include_dir!）
//
// 两条注入路径：
//   ① 隐式：每轮 render_skills_section() → <skills_instructions> 系统提示词
//   ② 显式：用户 $mention → build_skill_injections() → <skill> user 消息

const STEP_INFO = [
  {
    title: "Skills 注入架构",
    desc: "Skills 有两条注入路径：① 隐式——每轮把 allowed skills 的 name+description 渲染进系统提示词，让模型知道有哪些 skill 可用；② 显式——用户 $mention 后 SKILL.md 全文以 <skill> XML user 消息注入，模型按其指令执行。",
  },
  {
    title: "Layer Stack：多优先级 Skill 根目录",
    desc: "loader.rs:243 — skill_roots_from_layer_stack_inner() 按优先级从高到低扫描四个根目录：Repo (./.agents/skills/) > User (~/.agents/skills/) > System ($CODEX_HOME/skills/.system/) > Admin (/etc/codex/skills/)。同名 skill 高优先级覆盖低优先级。",
  },
  {
    title: "隐式注入：render_skills_section()",
    desc: "core-skills/src/render.rs:5 — 对所有 policy.allow_implicit_invocation=true 的 skill，只注入 name + description + 文件路径，包裹在 <skills_instructions> 标签中。模型从此列表判断当前任务是否匹配某个 skill，cost 极低。",
  },
  {
    title: "显式注入：$mention → SKILL.md 全文",
    desc: "injection.rs:26 — 用户输入含 $skill-name 时，build_skill_injections() 读取 SKILL.md 全文，以 <skill><name>...</name><path>...</path>...content...</skill> 格式注入为 role=user 的 ResponseItem。模型在这一 turn 内完整执行 skill 指令。",
  },
  {
    title: "MCP 依赖自动安装",
    desc: "mcp_skill_dependencies.rs — skill 被 mention 后，检查 agents/openai.yaml 中的 dependencies.tools[].type='mcp'。若 MCP server 未安装，弹窗询问用户，Install 后自动写入 MCP 配置并建立连接。Feature::SkillMcpDependencyInstall 默认开启。",
  },
  {
    title: "内嵌系统 Skills（System Skills）",
    desc: "skills/src/lib.rs — 5 个系统 skills 在编译时通过 include_dir!() 打包进二进制。启动时解压到 $CODEX_HOME/skills/.system/，指纹比较避免重复。skill-creator 可帮用户创建新 skill，skill-installer 可从 GitHub 安装。",
  },
];

// ─── Step 1：Layer Stack 发现动画 ─────────────────────────────────────────────

const LAYERS = [
  {
    priority: "最高",
    label: "Repo",
    path: "./.agents/skills/",
    desc: "当前仓库，从 cwd 向上搜索",
    color: "#10b981",
    border: "border-emerald-700",
    bg: "bg-emerald-950/30",
    text: "text-emerald-300",
    badge: "bg-emerald-900/60 text-emerald-300",
    skills: ["auth-helper", "ci-runner"],
  },
  {
    priority: "高",
    label: "User",
    path: "~/.agents/skills/",
    desc: "用户级，跨仓库共享",
    color: "#0ea5e9",
    border: "border-sky-700",
    bg: "bg-sky-950/30",
    text: "text-sky-300",
    badge: "bg-sky-900/60 text-sky-300",
    skills: ["imagegen", "openai-docs"],
  },
  {
    priority: "低",
    label: "System",
    path: "$CODEX_HOME/skills/.system/",
    desc: "编译内嵌，启动时解压",
    color: "#8b5cf6",
    border: "border-violet-700",
    bg: "bg-violet-950/30",
    text: "text-violet-300",
    badge: "bg-violet-900/60 text-violet-300",
    skills: ["skill-creator", "skill-installer", "plugin-creator"],
  },
  {
    priority: "最低",
    label: "Admin",
    path: "/etc/codex/skills/",
    desc: "系统管理员级，机构部署",
    color: "#52525b",
    border: "border-zinc-700",
    bg: "bg-zinc-900",
    text: "text-zinc-400",
    badge: "bg-zinc-800 text-zinc-400",
    skills: ["corp-policy"],
  },
];

function LayerStackViz() {
  return (
    <div className="space-y-3">
      <div className="font-mono text-xs text-zinc-500 mb-1">
        loader.rs:243 — skill_roots_from_layer_stack_inner()  ·  同名 skill 高优先级覆盖低优先级
      </div>
      {LAYERS.map((layer, i) => (
        <motion.div
          key={layer.label}
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.18 }}
          className={`rounded-lg border p-4 ${layer.border} ${layer.bg}`}
        >
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className={`font-mono text-xs rounded px-2 py-0.5 ${layer.badge}`}>{layer.priority}</span>
            <span className={`font-mono text-base font-bold ${layer.text}`}>{layer.label}</span>
            <span className="font-mono text-sm text-zinc-400">{layer.path}</span>
            <span className="font-mono text-xs text-zinc-600 ml-auto">{layer.desc}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {layer.skills.map((s, si) => (
              <motion.span
                key={s}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.18 + si * 0.07 + 0.15 }}
                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-mono text-xs text-zinc-300"
              >
                {s}
              </motion.span>
            ))}
          </div>
        </motion.div>
      ))}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.95 }}
        className="rounded border border-amber-800 bg-amber-950/20 px-4 py-2 font-mono text-sm"
      >
        <span className="text-amber-400">合并规则：</span>
        <span className="text-zinc-300"> Repo 的 </span>
        <span className="text-emerald-300">auth-helper</span>
        <span className="text-zinc-300"> 覆盖 System 的同名 skill；</span>
        <span className="text-sky-300">imagegen</span>
        <span className="text-zinc-300"> 仅在 User 层，不被覆盖</span>
      </motion.div>
    </div>
  );
}

// ─── Step 2：隐式注入 ─────────────────────────────────────────────────────────

const IMPLICIT_SKILLS = [
  { name: "imagegen",        desc: "Generate an image using DALL-E. Triggered when user asks to create/draw/generate images.", allowed: true  },
  { name: "auth-helper",     desc: "Assists with OAuth setup, token management, and auth module debugging.",                  allowed: true  },
  { name: "skill-installer", desc: "Install skills from GitHub or the curated skill registry.",                               allowed: true  },
  { name: "corp-policy",     desc: "Company coding standards and compliance checks.",                                          allowed: false },
];

function ImplicitInjectionViz() {
  return (
    <div className="space-y-3">
      <div className="font-mono text-xs text-zinc-500">
        core/src/codex.rs:2417 → core-skills/src/render.rs:5 — render_skills_section()
      </div>

      {/* 注入到系统提示词的 XML 块 */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 space-y-2">
        <div className="font-mono text-xs text-zinc-500 mb-2">
          developer_sections 中注入的 &lt;skills_instructions&gt; 块（每轮重建）
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="font-mono text-xs text-zinc-600"
        >
          {"<skills_instructions>"}
        </motion.div>

        {IMPLICIT_SKILLS.map((skill, i) => (
          <motion.div
            key={skill.name}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.15 + 0.1 }}
            className={`ml-4 flex items-start gap-3 rounded border px-3 py-2.5 ${
              skill.allowed
                ? "border-zinc-700 bg-zinc-950"
                : "border-zinc-800 bg-zinc-900/50 opacity-40"
            }`}
          >
            {/* name */}
            <span className={`font-mono text-sm font-bold shrink-0 w-36 ${skill.allowed ? "text-emerald-300" : "text-zinc-600"}`}>
              {skill.name}
            </span>
            {/* description */}
            <span className="font-mono text-xs text-zinc-400 leading-relaxed">
              {skill.desc}
            </span>
            {/* policy badge */}
            {!skill.allowed && (
              <span className="ml-auto shrink-0 rounded bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-600">
                allow_implicit=false
              </span>
            )}
          </motion.div>
        ))}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="font-mono text-xs text-zinc-600"
        >
          {"</skills_instructions>"}
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="grid grid-cols-2 gap-3 font-mono text-sm"
      >
        <div className="rounded border border-emerald-800 bg-emerald-950/20 px-4 py-2.5">
          <div className="text-emerald-400 font-bold mb-1">注入内容（极轻量）</div>
          <div className="text-zinc-400 text-xs">name + description + 文件路径<br/>SKILL.md 正文<span className="text-red-400">不</span>注入</div>
        </div>
        <div className="rounded border border-sky-800 bg-sky-950/20 px-4 py-2.5">
          <div className="text-sky-400 font-bold mb-1">模型的响应</div>
          <div className="text-zinc-400 text-xs">对比 description 与当前任务<br/>匹配则打开 SKILL.md → 显式路径</div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Step 3：显式注入 ─────────────────────────────────────────────────────────

const SKILL_MD_CONTENT = `---
name: imagegen
description: Generate an image using DALL-E. Triggered when
  user asks to create/draw/generate images or artwork.
---

# Image Generation Skill

## Prerequisites
Ensure OPENAI_API_KEY is set in your environment.

## Usage
Use the \`image_gen\` tool or the CLI fallback:

\`\`\`bash
python3 scripts/generate.py "a cat in space" --size 1024x1024
\`\`\`

## Guidelines
- Always confirm the prompt before generating
- Use --model dall-e-3 for best quality`;

function ExplicitInjectionViz() {
  return (
    <div className="space-y-3">
      {/* 用户输入 */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-zinc-700 bg-zinc-900 p-4"
      >
        <div className="font-mono text-xs text-zinc-500 mb-2">用户输入（UserInput::Text）</div>
        <div className="font-mono text-base">
          <span className="text-zinc-300">帮我画一只猫在宇宙中 — 使用 </span>
          <span className="rounded bg-emerald-900/60 border border-emerald-700 px-2 py-0.5 text-emerald-300 font-bold">
            $imagegen
          </span>
        </div>
        <div className="mt-2 font-mono text-xs text-zinc-600">
          inject.rs:252 extract_tool_mentions_with_sigil() — 识别 $ 前缀 token
        </div>
      </motion.div>

      {/* 触发流程 */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* 左：触发 + 依赖检查 */}
        <div className="space-y-2">
          {[
            { step: "① mention 解析",  detail: "collect_explicit_skill_mentions()",       color: "text-amber-300",  border: "border-amber-800",  bg: "bg-amber-950/20",  delay: 0.2 },
            { step: "② 依赖检查",       detail: "collect_env_var_dependencies() → OPENAI_API_KEY ✓", color: "text-sky-300",    border: "border-sky-800",    bg: "bg-sky-950/20",    delay: 0.4 },
            { step: "③ 读取 SKILL.md", detail: "fs.read_file_text(SKILL.md)",             color: "text-violet-300", border: "border-violet-800", bg: "bg-violet-950/20", delay: 0.6 },
            { step: "④ 注入 context",  detail: "ResponseItem::Message { role: user }",    color: "text-emerald-300",border: "border-emerald-800",bg: "bg-emerald-950/20",delay: 0.8 },
          ].map(item => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: item.delay }}
              className={`rounded border px-3 py-2 ${item.border} ${item.bg}`}
            >
              <span className={`font-mono text-sm font-bold ${item.color}`}>{item.step}</span>
              <div className="font-mono text-xs text-zinc-400 mt-0.5">{item.detail}</div>
            </motion.div>
          ))}
        </div>

        {/* 右：注入的 XML 结构 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="rounded-lg border border-zinc-700 bg-zinc-900 p-4"
        >
          <div className="font-mono text-xs text-zinc-500 mb-2">
            注入的 ResponseItem（role: user）— fragment.rs:6
          </div>
          <div className="space-y-0.5 font-mono text-xs">
            <div className="text-zinc-600">{"<skill>"}</div>
            <div className="ml-3 text-sky-300">{"<name>imagegen</name>"}</div>
            <div className="ml-3 text-violet-300">{"<path>~/.agents/skills/imagegen/SKILL.md</path>"}</div>
            <div className="ml-3 text-zinc-500 mt-1">--- frontmatter ---</div>
            {SKILL_MD_CONTENT.split("\n").slice(0, 12).map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 + i * 0.04 }}
                className="ml-3 text-zinc-400 leading-snug"
              >
                {line || "\u00a0"}
              </motion.div>
            ))}
            <div className="ml-3 text-zinc-600">{"..."}</div>
            <div className="text-zinc-600">{"</skill>"}</div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Step 4：MCP 依赖自动安装 ──────────────────────────────────────────────────

const MCP_DEP_STAGES = [
  {
    id: "yaml",
    label: "读取 agents/openai.yaml",
    detail: "dependencies.tools[].type = \"mcp\"  →  github",
    color: "text-sky-300",
    border: "border-sky-800",
    bg: "bg-sky-950/20",
  },
  {
    id: "check",
    label: "检查 MCP server 是否已安装",
    detail: "collect_missing_mcp_dependencies()  →  github: 未找到",
    color: "text-amber-300",
    border: "border-amber-800",
    bg: "bg-amber-950/20",
  },
  {
    id: "prompt",
    label: "弹窗询问用户",
    detail: "should_install_mcp_dependencies()  →  \"Install\" 选项",
    color: "text-violet-300",
    border: "border-violet-800",
    bg: "bg-violet-950/20",
  },
  {
    id: "install",
    label: "写入配置 + 建立连接",
    detail: "write MCP config  →  OAuth 认证  →  McpConnectionManager 重载",
    color: "text-emerald-300",
    border: "border-emerald-800",
    bg: "bg-emerald-950/20",
  },
];

function McpDependencyViz() {
  return (
    <div className="space-y-3">
      <div className="font-mono text-xs text-zinc-500">
        core/src/mcp_skill_dependencies.rs  ·  Feature::SkillMcpDependencyInstall（默认开启）
      </div>

      {/* skill yaml */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-lg border border-zinc-700 bg-zinc-900 p-4"
      >
        <div className="font-mono text-xs text-zinc-500 mb-2">ci-runner/agents/openai.yaml</div>
        <div className="space-y-0.5 font-mono text-sm">
          <div className="text-zinc-500">dependencies:</div>
          <div className="ml-4 text-zinc-500">tools:</div>
          <div className="ml-6 text-zinc-400">- type: <span className="text-amber-300">"mcp"</span></div>
          <div className="ml-8 text-zinc-400">value: <span className="text-sky-300">"github"</span></div>
          <div className="ml-8 text-zinc-400">description: <span className="text-zinc-300">"GitHub MCP server"</span></div>
          <div className="ml-8 text-zinc-400">transport: <span className="text-violet-300">"streamable_http"</span></div>
          <div className="ml-8 text-zinc-400">url: <span className="text-zinc-300">"https://api.githubcopilot.com/mcp/"</span></div>
        </div>
      </motion.div>

      {/* 阶段流程 */}
      <div className="space-y-2">
        {MCP_DEP_STAGES.map((s, i) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.2 + 0.3 }}
            className={`flex items-start gap-3 rounded border px-4 py-3 ${s.border} ${s.bg}`}
          >
            <span className={`font-mono text-sm font-bold shrink-0 ${s.color}`}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <div className={`font-mono text-sm font-bold ${s.color}`}>{s.label}</div>
              <div className="font-mono text-xs text-zinc-400 mt-0.5">{s.detail}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* 用户 prompt */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1 }}
        className="rounded-lg border border-violet-700 bg-violet-950/20 p-4"
      >
        <div className="font-mono text-sm text-violet-300 mb-2">弹出的安装提示（should_install_mcp_dependencies()）</div>
        <div className="font-mono text-sm text-zinc-300 mb-3">
          "ci-runner skill 需要 <span className="text-sky-300">GitHub MCP server</span>。是否自动安装？"
        </div>
        <div className="flex gap-2">
          <span className="rounded border border-emerald-700 bg-emerald-900/40 px-4 py-1.5 font-mono text-sm text-emerald-300">Install</span>
          <span className="rounded border border-zinc-700 bg-zinc-900 px-4 py-1.5 font-mono text-sm text-zinc-400">Continue anyway</span>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Step 5：内嵌系统 Skills ───────────────────────────────────────────────────

const SYSTEM_SKILLS = [
  { name: "skill-creator",   desc: "向导式创建或更新 skill，生成 SKILL.md + agents/openai.yaml",  icon: "✦", color: "text-amber-300",  border: "border-amber-800",  bg: "bg-amber-950/20"  },
  { name: "skill-installer", desc: "从 GitHub 仓库或内置 skill 目录安装 skill",                  icon: "↓", color: "text-sky-300",    border: "border-sky-800",    bg: "bg-sky-950/20"    },
  { name: "imagegen",        desc: "DALL-E 图像生成，内置 image_gen 工具 + scripts/ 备用路径",   icon: "🖼", color: "text-violet-300", border: "border-violet-800", bg: "bg-violet-950/20" },
  { name: "openai-docs",     desc: "OpenAI 文档检索与参考，结合 references/ 按需加载",            icon: "📖", color: "text-emerald-300",border: "border-emerald-800",bg: "bg-emerald-950/20"},
  { name: "plugin-creator",  desc: "创建 Codex 插件的向导",                                      icon: "⬡", color: "text-rose-300",   border: "border-rose-800",   bg: "bg-rose-950/20"   },
];

function SystemSkillsViz() {
  return (
    <div className="space-y-3">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded border border-zinc-700 bg-zinc-900 px-4 py-2.5 font-mono text-sm"
      >
        <span className="text-zinc-500">skills/src/lib.rs — </span>
        <span className="text-amber-300">include_dir!("src/assets/samples")</span>
        <span className="text-zinc-500"> 编译时打包 → 启动时解压到 </span>
        <span className="text-violet-300">$CODEX_HOME/skills/.system/</span>
      </motion.div>

      <div className="space-y-2">
        {SYSTEM_SKILLS.map((s, i) => (
          <motion.div
            key={s.name}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.12 }}
            className={`flex items-center gap-4 rounded border px-4 py-3 ${s.border} ${s.bg}`}
          >
            <span className="text-xl w-7 text-center">{s.icon}</span>
            <span className={`font-mono text-sm font-bold w-36 shrink-0 ${s.color}`}>{s.name}</span>
            <span className="font-mono text-sm text-zinc-400">{s.desc}</span>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="grid grid-cols-3 gap-3 font-mono text-xs"
      >
        {[
          ["install_system_skills()", "指纹比较避免重复解压", "text-zinc-400"],
          ["skills_watcher.rs", "文件系统热重载，无需重启", "text-sky-300"],
          ["config bundled.enabled", "可统一禁用所有系统 skill", "text-amber-300"],
        ].map(([k, v, c]) => (
          <div key={k as string} className="rounded border border-zinc-800 bg-zinc-950 p-3">
            <div className={`font-mono text-xs font-bold mb-1 ${c}`}>{k}</div>
            <div className="text-zinc-500">{v}</div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────

export default function SkillsVisualization() {
  const viz = useSteppedVisualization({ totalSteps: STEP_INFO.length, autoPlayInterval: 5000 });
  const step = STEP_INFO[viz.currentStep];

  return (
    <section className="space-y-4">

      {/* SVG 架构图（固定） */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3">
        <div className="mb-2 font-mono text-xs text-zinc-500">
          <span className="text-emerald-400">core-skills/</span> · <span className="text-sky-400">core/src/codex/turn.rs:210</span> · <span className="text-amber-400">instructions/src/fragment.rs</span>
        </div>
        <svg viewBox="0 0 1280 246" className="w-full rounded border border-zinc-800 bg-zinc-950">
          <defs>
            {(["#10b981","#0ea5e9","#8b5cf6","#52525b","#f59e0b","#f43f5e"] as const).map((c,i)=>(
              <marker key={i} id={`sk${i}`} markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto">
                <polygon points="0 0,10 4,0 8" fill={c}/>
              </marker>
            ))}
          </defs>

          {/* Layer Stack（左列） */}
          <text x="28" y="20" fontSize={11} fontFamily="monospace" fill="#52525b">Layer Stack（优先级 ↑）</text>
          {([
            { y:28,  label:"Repo",   path:"./.agents/skills/", stroke:"#10b981", fill:"#0f1a0a", tc:"#4ade80" },
            { y:78,  label:"User",   path:"~/.agents/skills/", stroke:"#0ea5e9", fill:"#03131f", tc:"#38bdf8" },
            { y:128, label:"System", path:"$CODEX_HOME/.system/", stroke:"#8b5cf6", fill:"#100a1f", tc:"#a78bfa" },
            { y:178, label:"Admin",  path:"/etc/codex/skills/",   stroke:"#52525b", fill:"#111", tc:"#71717a" },
          ] as {y:number;label:string;path:string;stroke:string;fill:string;tc:string}[]).map(n=>(
            <g key={n.y}>
              <rect x="18" y={n.y} width="210" height="40" rx="6" fill={n.fill} stroke={n.stroke} strokeWidth={1.5}/>
              <text x="118" y={n.y+16} textAnchor="middle" fontSize={13} fontWeight={700} fontFamily="monospace" fill={n.tc}>{n.label}</text>
              <text x="118" y={n.y+32} textAnchor="middle" fontSize={10} fontFamily="monospace" fill={n.stroke+"80"}>{n.path}</text>
            </g>
          ))}
          {/* arrows from layers → SkillsManager */}
          {[48, 98, 148, 198].map((y, i) => (
            <line key={i} x1="228" y1={y} x2="310" y2={120} stroke={["#10b981","#0ea5e9","#8b5cf6","#52525b"][i]} strokeWidth={1.2} strokeDasharray="3 2" markerEnd={`url(#sk${i})`}/>
          ))}

          {/* SkillsManager（中） */}
          <rect x="310" y="82" width="180" height="76" rx="8" fill="#0f1a0a" stroke="#10b981" strokeWidth={2}/>
          <text x="400" y="111" textAnchor="middle" fontSize={14} fontWeight={700} fontFamily="monospace" fill="#34d399">SkillsManager</text>
          <text x="400" y="129" textAnchor="middle" fontSize={11} fontFamily="monospace" fill="#6ee7b7">loader.rs</text>
          <text x="400" y="147" textAnchor="middle" fontSize={10} fontFamily="monospace" fill="#10b98170">SkillLoadOutcome</text>

          {/* SkillsManager → 隐式 */}
          <line x1="490" y1="100" x2="570" y2="65" stroke="#f59e0b" strokeWidth={1.5} markerEnd="url(#sk4)"/>
          {/* SkillsManager → 显式 */}
          <line x1="490" y1="140" x2="570" y2="170" stroke="#8b5cf6" strokeWidth={1.5} markerEnd="url(#sk2)"/>

          {/* 隐式注入框 */}
          <rect x="570" y="28" width="300" height="70" rx="8" fill="#1a1200" stroke="#f59e0b" strokeWidth={1.5}/>
          <text x="720" y="52" textAnchor="middle" fontSize={14} fontWeight={700} fontFamily="monospace" fill="#fbbf24">① 隐式注入</text>
          <text x="720" y="69" textAnchor="middle" fontSize={11} fontFamily="monospace" fill="#fde68a">render_skills_section() → &lt;skills_instructions&gt;</text>
          <text x="720" y="87" textAnchor="middle" fontSize={10} fontFamily="monospace" fill="#f59e0b60">name + description only  ·  每轮重建</text>

          {/* 显式注入框 */}
          <rect x="570" y="140" width="300" height="70" rx="8" fill="#120818" stroke="#8b5cf6" strokeWidth={1.5}/>
          <text x="720" y="164" textAnchor="middle" fontSize={14} fontWeight={700} fontFamily="monospace" fill="#c4b5fd">② 显式注入</text>
          <text x="720" y="181" textAnchor="middle" fontSize={11} fontFamily="monospace" fill="#ddd6fe">build_skill_injections() → &lt;skill&gt; XML</text>
          <text x="720" y="199" textAnchor="middle" fontSize={10} fontFamily="monospace" fill="#8b5cf660">$mention  ·  SKILL.md 全文  ·  role=user</text>

          {/* 隐式 → 模型 */}
          <line x1="870" y1="63" x2="970" y2="95" stroke="#f59e0b" strokeWidth={1.5} markerEnd="url(#sk4)"/>
          {/* 显式 → 模型 */}
          <line x1="870" y1="175" x2="970" y2="145" stroke="#8b5cf6" strokeWidth={1.5} markerEnd="url(#sk2)"/>

          {/* $mention 触发标注 — 显式注入框下方，明确指向该框 */}
          <rect x="614" y="218" width="112" height="20" rx="4" fill="#1e0a3c" stroke="#8b5cf6" strokeWidth={1.2}/>
          <text x="670" y="232" textAnchor="middle" fontSize={10} fontFamily="monospace" fill="#c4b5fd">$skill-name 触发</text>
          <line x1="670" y1="217" x2="670" y2="212" stroke="#8b5cf6" strokeWidth={1.2} markerEnd="url(#sk2)"/>

          {/* 模型框 */}
          <rect x="970" y="90" width="200" height="60" rx="8" fill="#03131f" stroke="#0ea5e9" strokeWidth={1.8}/>
          <text x="1070" y="116" textAnchor="middle" fontSize={14} fontWeight={700} fontFamily="monospace" fill="#38bdf8">Model</text>
          <text x="1070" y="134" textAnchor="middle" fontSize={11} fontFamily="monospace" fill="#7dd3fc">context assembled</text>

          {/* MCP 依赖标注 */}
          <rect x="1200" y="80" width="68" height="40" rx="5" fill="#1f080c" stroke="#f43f5e" strokeWidth={1.2} strokeDasharray="3 2"/>
          <text x="1234" y="98" textAnchor="middle" fontSize={10} fontFamily="monospace" fill="#fb7185">MCP</text>
          <text x="1234" y="113" textAnchor="middle" fontSize={10} fontFamily="monospace" fill="#fb7185">依赖</text>
          <line x1="1170" y1="155" x2="1204" y2="118" stroke="#f43f5e" strokeWidth={1} strokeDasharray="3 2"/>
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
              <p className="text-base text-zinc-300">Skills 是 Codex 的可编程指令包，有两条注入路径，按需加载以节省 context：</p>
              <div className="space-y-2.5 font-mono text-sm">
                {[
                  ["Layer Stack",  "emerald", "四层目录：Repo > User > System > Admin，同名 skill 高优先级覆盖低优先级"],
                  ["① 隐式注入",   "amber",   "render_skills_section() — 只注入 name+description，每轮重建，cost 极低"],
                  ["② 显式注入",   "violet",  "build_skill_injections() — $mention 后读取 SKILL.md 全文，<skill> XML 注入"],
                  ["MCP 依赖",     "rose",    "agents/openai.yaml 声明依赖 → 自动检查 → 询问安装 → 建立连接"],
                  ["系统 Skills",  "sky",     "5 个内嵌 skill（imagegen/skill-creator 等）编译时打包，启动解压"],
                ].map(([label, color, desc]) => (
                  <div key={label as string} className="flex gap-3">
                    <span className={`text-${color}-400 shrink-0 w-24`}>{label}</span>
                    <span className="text-zinc-400">{desc as string}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {viz.currentStep === 1 && <LayerStackViz />}
          {viz.currentStep === 2 && <ImplicitInjectionViz />}
          {viz.currentStep === 3 && <ExplicitInjectionViz />}
          {viz.currentStep === 4 && <McpDependencyViz />}
          {viz.currentStep === 5 && <SystemSkillsViz />}
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
