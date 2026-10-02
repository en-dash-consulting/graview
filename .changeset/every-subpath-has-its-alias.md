---
"@graview/core": patch
---

A linked project's dev server and tests reach every entry a package exports: `graview create` aliases `@graview/core/testing`, `/cli`, `/scaffold` and `/sqlite`, `@graview/tools/cli` and `@graview/ship/dev` and `/cli` ahead of their bare names, where `@graview/core` alone used to take `@graview/core/testing` and point it inside core's index file — a product's tests that reached for the testing entry did not load at all.
