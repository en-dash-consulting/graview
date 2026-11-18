---
"@graview/core": patch
"@graview/layout": patch
"@graview/pages": patch
"@graview/primitives": patch
"@graview/react": patch
"@graview/render": patch
"@graview/ship": patch
"@graview/studio": patch
"@graview/tools": patch
---

Security fixes in what the packages depend on. Every package that depends on zod now asks for `^4.6.7`, so an install no longer resolves a zod version with a published high-severity advisory (GHSA-mrhx-c7xc-m3w5) alongside Graview. Each pull request and each release now fail on a high or critical advisory reaching a published package's dependencies and check every installed package's registry signature (`scripts/dependency-check.mjs`), and the lockfile takes no version published in the last seven days.

Compatibility: the look, the JavaScript API, ops and primitives, stored formats, the wire, the declaration and check finding codes, derived tool names and input schemas — unchanged. A host that pins zod below 4.6.7 next to Graview moves to 4.6.7 or later.
