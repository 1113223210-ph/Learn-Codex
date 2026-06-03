# Learn Codex

**中文** | [English](#english)

> OpenAI Codex 有 662,000 行 Rust 代码、1000+ 文件、6 个核心 crate。  
> 这 13 章带你从 Agent 循环到工程全貌，逐层拆解 Rust 实现。

---

## 项目简介

本项目基于 [openai/codex](https://github.com/openai/codex) 的开源 Rust 源码，通过 **13 章交互式教学**，帮助开发者理解一个生产级 AI Coding Agent 的内部架构与工程决策。

每章包含：
- **可视化**：动态流程图，直观展示核心机制
- **模拟器**：步进式 Agent 循环模拟，附源码行号注释
- **深入文档**：对应 codex-rs 源码的详细解析

## 章节结构

| 章节 | 主题 | 核心源码 |
|------|------|---------|
| Ch01 | Agent 循环 | `core/src/codex/turn.rs` |
| Ch02 | 工具系统 | `core/src/tools/router.rs` |
| Ch03 | 提示词工程 | `core/src/codex.rs` |
| Ch04 | Shell 执行 | `core/src/exec.rs` |
| Ch05 | 沙箱安全 | `sandboxing/src/` |
| Ch06 | 权限引擎 | `core/src/tools/orchestrator.rs` |
| Ch07 | 上下文压缩 | `core/src/compact.rs` |
| Ch08 | 短期记忆 | `core/src/context_manager/history.rs` |
| Ch09 | 长期记忆 | `core/src/memories/` |
| Ch10 | MCP 集成 | `core/src/mcp_tool_call.rs` |
| Ch11 | Skills 注入 | `core/src/skills.rs` |
| Ch12 | Plan 模式 | `core/src/codex/turn.rs` |
| Ch13 | 多 Agent | `core/src/tools/handlers/` |

## 本地运行

```bash
cd web
npm install
npm run dev
# 访问 http://localhost:3200
```

## 目录结构

```
learn-codex/
└── web/                  # Next.js 教学站点
    ├── src/
    │   ├── app/          # 页面路由
    │   ├── components/
    │   │   └── visualizations/   # 13 章可视化组件
    │   ├── data/
    │   │   ├── generated/        # docs.json（深入文档数据）
    │   │   └── scenarios/        # ch01~ch13 模拟器场景
    │   └── lib/                  # 常量、i18n、工具函数
    └── package.json
```

## 技术栈

- **框架**：Next.js 15 + React 19
- **样式**：Tailwind CSS
- **动画**：Framer Motion
- **语言**：TypeScript

---

## English

> OpenAI Codex has 662,000 lines of Rust code, 1,000+ files, and 6 core crates.  
> These 13 chapters walk you through the Rust implementation layer by layer, from the Agent loop to the full engineering picture.

### About

Based on the open-source Rust code of [openai/codex](https://github.com/openai/codex), this project helps developers understand the internal architecture and engineering decisions of a production-grade AI Coding Agent through **13 interactive chapters**.

Each chapter includes a **visualization**, a **step-by-step simulator**, and a **deep-dive doc** mapped to real codex-rs source lines.

### Quick Start

```bash
cd web
npm install
npm run dev
# Visit http://localhost:3200
```
