---
id: "ebbcef1a-944c-4534-a9ea-7a1a3f5c4251"
type: "capability"
title: "graview create: a scaffolder, its rehearsal, and the door package"
slug: "graview-create-a-scaffolder-its"
statement: "graview create scaffolds a new Graview project from a pure generator, and `npm create graview` reaches the same command."
criteria: [{"id":"c1","text":"When a person runs `pnpm graview create ../my-app --link .`, the scaffolder shall produce a project whose own verify passes."},{"id":"c2","text":"When a person runs `npm create graview`, the create-graview package shall delegate to the same `graview create` command."},{"id":"c3","text":"The smoke-create rehearsal shall pass in CI with 25 criteria across chromium, webkit and firefox."},{"id":"c4","text":"The graview-new-app skill shall lead with the scaffolder."}]
tags:
  - "scaffold"
  - "onboarding"
  - "cli"
source: "claude-code session 2026-09-07..10"
priority: "high"
---

`graview create <dir>` in @graview/core over a pure generator (`@graview/core/scaffold`, no fs, for graview-cloud to provision in-process) plus `packages/create-graview` so `npm create graview` works. Writes an 18-file project: one kind with creates/connects/severs/writes/lifecycle, one invariant with a repair, the Shell, the pages face with a custom record page, browser adapter, headless test, CI workflow. `--link <framework>` emits link: deps, vite aliases and a zod dedupe through tsconfig paths (two zod copies made tsc OOM). Refuses an unbuilt framework, warns inside the checkout, git-inits, writes a link-mode CI that checks the framework out as a sibling. `scripts/smoke-create.mjs` rehearses it from packed tarballs in npm, pnpm, door and link modes, runs the project's own verify, installs skills, opens it in a browser; 25 criteria across chromium, webkit, firefox; in CI.
