---
"@graview/primitives": patch
---

The stylesheet's notes stay in the source and out of the page. `themeCss` explained its rules in CSS comments inside the template it returns, so every page carried them and every embed parsed them into its `<style>`: 25 KB of the 60 KB the function was. They are now JavaScript comments in an empty interpolation, `${/* … */ ""}`, beside the rules they explain, and a minifier folds them away; the CSS a page receives is the same rules, without the prose.

Compatibility: unchanged. `themeCss` returns the same rules in the same order; only the comments between them are gone from its output.
