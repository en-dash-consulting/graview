---
id: "cc6c7380-a8ee-4630-a3a3-4fb1e6f940c6"
type: "capability"
title: "A hosted page carries at most 600 KB of framework up front, and zod at most 150 KB of it (FR-57)"
slug: "a-hosted-page-carries-at-most-600-kb"
statement: "A hosted page mounted through openRemote and the embed carries at most 600 KB of minified framework up front, of which zod is at most 150 KB."
criteria: [{"id":"c1","text":"When a page mounting the vendors fixture through openRemote and the embed is built as Cloud's client build builds it (esbuild ESM, splitting, minified), the page shall carry at most 150 KB of zod."},{"id":"c2","text":"When a page mounting the vendors fixture through openRemote and the embed is built as Cloud's client build builds it, the page shall carry at most 600 KB minified up front in all, as measured from esbuild's metafile."},{"id":"c3","text":"Code that only some apps use shall load through a lazy import() rather than up front, as the embed's studio does."}]
tags:
  - "graview-cloud"
  - "FR-57"
source: "Graview Cloud, 2026-10-04 (brief after 0.1.4)"
priority: "high"
---

Cloud's shell loads 1,113 KB before the app draws: zod 443 KB, @graview/core 251 KB, react-dom 204 KB, @graview/primitives 183 KB, @graview/react 94 KB, @graview/pages 64 KB, @graview/tools 48 KB. zod is classic zod (the z object), which a bundler keeps whole.
