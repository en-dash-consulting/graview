---
id: "cc6c7380-a8ee-4630-a3a3-4fb1e6f940c6"
level: "feature"
title: "A hosted page carries at most 600 KB of framework up front, and zod at most 150 KB of it (FR-57)"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-57"
source: "Graview Cloud, 2026-10-04 (brief after 0.1.4)"
startedAt: "2026-10-04T16:23:50.000Z"
completedAt: "2026-10-04T16:23:50.000Z"
endedAt: "2026-10-04T16:23:50.000Z"
acceptanceCriteria:
  - "Built the way ../graview-cloud/packages/client/build.mjs builds it (esbuild ESM, splitting, minified), a page mounting the vendors fixture through openRemote and the embed carries at most 150 KB of zod"
  - "…and at most 600 KB minified up front in all, measured from esbuild's metafile"
  - "Anything only some apps use is a lazy import(), as the embed's studio already is"
  - "A test or harness in this repo measures it so it cannot regress"
description: "Cloud's shell loads 1,113 KB before the app draws: zod 443 KB, @graview/core 251 KB, react-dom 204 KB, @graview/primitives 183 KB, @graview/react 94 KB, @graview/pages 64 KB, @graview/tools 48 KB. zod is classic zod (the z object), which a bundler keeps whole."
lastModified: "2026-10-04T16:23:50.000Z"
---
