---
"@graview/pages": patch
---

A design's shell registers without a cast. `surface("shell", Shell)` takes a `ShellComponent<S>` — `{ context, children }`, as the pages skill describes it — rather than a page's type, which has no children and made every design write `Shell as PageComponent<S>`.
