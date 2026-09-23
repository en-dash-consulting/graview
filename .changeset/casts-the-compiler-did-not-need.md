---
"@graview/core": patch
"@graview/tools": patch
"@graview/react": patch
"@graview/primitives": patch
"@graview/pages": patch
"@graview/ship": patch
"@graview/studio": patch
---

Casts the compiler did not need are gone: 163 lines of `as never` and 52 `as unknown as` narrowed to a single cast, each removed only where the whole monorepo still type-checks without it. What is left is where the types genuinely cannot say it.
