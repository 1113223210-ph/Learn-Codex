# AGENTS.md

## Commands

All commands run from `web/`, not the repo root (there is no root-level package.json).

```bash
cd web
npm install       # first-time setup
npm run dev       # dev server → http://localhost:3200
npm run build     # static export → web/out/
npm run start     # serve the static build locally
```

Typecheck (no lint script is defined):
```bash
cd web && npx tsc --noEmit
```

## Non-obvious facts

- **Dev port is 3200**, not Next.js's default 3000. The dev script also binds to `0.0.0.0`.
- **Static export**: `next.config.ts` sets `output: "export"`. `npm run build` produces static HTML/CSS/JS in `web/out/`. There is no persistent server — no SSR, no stateful API routes.
- **Deployment target is Cloudflare Pages** (static files only).
- **No test or lint scripts** are configured in `package.json`. No ESLint config exists.
- **Tailwind CSS v4** via `@tailwindcss/postcss`. The v4 API differs from v3 — no `tailwind.config.js`, configuration is in CSS/PostCSS only.
- **Path alias**: `@/*` resolves to `web/src/*`.

## Architecture

```
learn-codex/
└── web/                          # only package; entire app lives here
    └── src/
        ├── app/                  # Next.js App Router pages
        │   ├── chapter/[id]/     # dynamic chapter routes
        │   ├── architecture/     # architecture overview page
        │   └── timeline/         # timeline page
        ├── components/
        │   └── visualizations/   # one .tsx per chapter (ch01–ch13)
        ├── data/
        │   ├── generated/docs.json   # deep-dive doc content (manually maintained; scripts/ is empty)
        │   └── scenarios/ch01–ch13.json  # simulator step data per chapter
        └── lib/
            ├── i18n.ts           # bilingual zh/en strings
            ├── locale-context.tsx
            ├── constants.ts
            └── utils.ts
```

- The site is **bilingual (zh/en)**. String translations live in `web/src/lib/i18n.ts`.
- `docs.json` is in `data/generated/` but there is no codegen script — edit it directly.
- Each chapter has three pieces: a visualization component in `visualizations/`, simulator data in `scenarios/chNN.json`, and doc content in `docs.json`.
