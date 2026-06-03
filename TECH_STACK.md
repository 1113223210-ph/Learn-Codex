# Learn Codex 技术栈总结

## 前端框架

| 技术 | 版本 | 用途 |
|------|------|------|
| **Next.js** | 15 | React 全栈框架，静态导出模式（`output: "export"`） |
| **React** | 19 | UI 组件库 |
| **TypeScript** | 5 | 类型安全 |
| **Tailwind CSS** | 4 | 原子化样式 |
| **Framer Motion** | 12 | 动画（流程图节点、页面过渡） |

## 数据层

| 技术 | 用途 |
|------|------|
| **JSON 文件**（`docs.json`、`ch0x.json`） | 静态数据，构建时打包进产物 |
| **unified / remark / rehype** | Markdown → HTML 渲染（深入文档章节） |

## 可视化

| 技术 | 用途 |
|------|------|
| **SVG** | 13 章流程图（节点、箭头、路径） |
| **Framer Motion** `animate()` | 节点高亮、边闪烁动画 |
| **自定义 Hook** `useSteppedVisualization` | 步进控制逻辑复用 |

## 部署

| 技术 | 用途 |
|------|------|
| **Cloudflare Pages** | 静态网站托管，全球 CDN |
| **GitHub** | 代码仓库，连接 Cloudflare 自动触发构建 |
| **Next.js 静态导出** | `output: "export"` 生成纯静态 `out/` 目录，绕过 Cloudflare 25MB 单文件限制 |

## 开发工具

| 工具 | 用途 |
|------|------|
| **git** | 版本控制，Personal Access Token 认证推送 |
| **`git -c http.proxy=""`** | 绕过本地代理推送到 GitHub |
| **`npx tsc --noEmit`** | TypeScript 类型检查，每次改动后验证 |

## 项目结构约定

```
learn-codex/
├── README.md              # 项目说明 + Live Demo 徽章 + 致谢
├── .gitignore             # 排除 node_modules/、.next/、tsconfig.tsbuildinfo
├── LICENSE
└── web/                   # Next.js 站点（Cloudflare Root directory = web）
    ├── next.config.ts     # output: "export", trailingSlash: true
    ├── src/
    │   ├── app/           # 页面路由
    │   ├── components/
    │   │   └── visualizations/   # ch01~ch13 可视化组件
    │   ├── data/
    │   │   ├── generated/docs.json     # 深入文档数据
    │   │   └── scenarios/ch0x.json     # 模拟器场景
    │   └── lib/
    │       ├── constants.ts   # 章节元数据、sourceFiles、sourceSize
    │       └── i18n.ts        # 中文文案（en 复用 zh）
    └── .gitignore
```

## 关键设计决策

- **静态导出**：项目无服务端逻辑（无 API Route、无 SSR），`output: "export"` 零损失，且适配所有静态托管平台
- **i18n 简化**：`locale-context` 初始值为 `"en"`，但 `i18n.ts` 中 `en = zh`，实际只维护中文一份内容
- **数据手写维护**：`docs.json` 直接手写，不依赖构建脚本从 Markdown 生成（旧脚本章节映射已与实际不符，已删除）
- **源码引用原则**：所有 `sourceFiles`、`sourceSize`、函数名、行号均须对照 `codex-rs` 真实源码核实，禁止估算或虚构
