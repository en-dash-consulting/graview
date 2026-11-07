---
id: "6badabc4-8621-488c-99c6-c0d0e6706461"
type: "capability"
title: "The scaffolder writes what a product actually needs"
slug: "the-scaffolder-writes-what-a-product"
statement: "graview create scaffolds a product, in a new or an existing repository, as a workspace with the app under app/, a first build that prints no size warning, and a dependency set that needs no approval step or path into another repository's package-manager internals."
criteria: [{"id":"c1","text":"When graview create runs with --link in an existing repository, the scaffolder shall yield a workspace whose first pnpm verify is clean with no warnings and no path into another repository's node_modules."},{"id":"c2","text":"When graview create runs with --merge, the scaffolder shall write only files that do not exist."},{"id":"c3","text":"When graview create runs with --merge and files collide, the scaffolder shall list every collision by name without writing it and exit non-zero."},{"id":"c4","text":"When graview create runs with --force, the scaffolder shall keep the meaning --force has today."},{"id":"c5","text":"When graview create runs with --workspace or by default, the scaffolder shall write the root package.json, pnpm-workspace.yaml, tsconfig.base.json and vitest.config.ts with the app under app/."},{"id":"c6","text":"When graview create runs with --workspace or by default, the scaffolder shall write stub harness scripts that say what they would measure."},{"id":"c7","text":"The scaffolded vite.config.ts shall set manualChunks that split the framework from app code along the tier boundary."},{"id":"c8","text":"When a one-kind scaffolded app is built for the first time, the build shall print no size warning."},{"id":"c9","text":"When graview create runs with --no-install, the scaffolder shall install the skills independently of the dependency install, or print 'skills: skipped (needs install)'."},{"id":"c10","text":"The scaffolded package.json shall ship pnpm.onlyBuiltDependencies set to ['esbuild']."},{"id":"c11","text":"The scaffolder shall not write a tsconfig paths entry into another repository's package-manager internals."},{"id":"c12","text":"The scaffolded product shall resolve the same zod for types and runtime, through a peer dependency or a re-export from @graview/core."}]
tags:
  - "groundskeeper-feedback"
  - "scaffolder"
source: "groundskeeper-graview/docs/graview-feedback.md"
priority: "high"
---

F-001 through F-005 and F-011 are all graview create: it cannot start in a repository that already exists, it writes a layout no first-party product uses, its first build warns about the framework's own size, --no-install silently skips the skills, pnpm's build-script approval is an unexplained wall, and zod's types are pinned to a versioned path inside a sibling repository's pnpm store. All met before a line of domain is written.
