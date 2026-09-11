---
id: "3198508f-c841-4bcb-b283-74524a097c20"
level: "task"
title: "Walkthrough E · The pages, customised"
status: "completed"
priority: "critical"
tags:
  - "walkthrough"
  - "pages"
startedAt: "2026-09-11T17:42:53.937Z"
completedAt: "2026-09-11T17:49:18.838Z"
endedAt: "2026-09-11T17:49:18.838Z"
resolutionType: "code-change"
resolutionDetail: "Stage E walked: the scaffold's own record page is rung one, and Walk then got a design of its own over every surface (shell, home, problems, and a list and record per kind) in src/ui/design.tsx, following graview-pages — one model (readWalk), theme tokens tinted with color-mix rather than a palette of its own, and PageMain throughout. Two findings: W-017 the framework checkout's installed skills were stale, so stage E named a skill that could not be loaded here (criterion: skills \"keeps this repository's own installed copies current\"); W-018 a page's form asked a wider question than the act it was for — DerivedForm's node picker ignored the affordance's narrowed candidates, so a record's own \"depends on\" offered the record and handing a thing on offered whoever already had it, and the skill itself sent a design to scan the mutations rather than to facts.actions (criteria: three in parity.test.tsx plus a prose assertion in skills.test.ts). Verified: every route renders (including a record id that does not exist), the design re-renders on every op with no reload, it offers acts by store.permits through facts.actions and states what is withheld, PageMain gives an embedded copy a section rather than a second main, aria-label=\"Kinds\" is absent everywhere, no control is under 24px, and axe is clean on all seven routes at 1280 and 390 in both schemes."
acceptanceCriteria:
  - "a custom page re-renders on every op, offers acts by store.permits, and uses PageMain"
  - "the full design passes axe at 390 and 1280 in both schemes; every control is at least 24px; its colours hold AA on both grounds"
  - "the derived face is nowhere in it and every route renders"
description: "Stage E of docs/walkthrough.md: following graview-pages, replace one record page, then every surface with a design of the app's own."
lastModified: "2026-09-11T17:49:18.849Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
