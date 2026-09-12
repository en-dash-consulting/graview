---
id: "057c0e18-34d7-4f04-8a9d-abd1c2788f50"
level: "task"
title: "Walkthrough H · On somebody else's page"
status: "in_progress"
priority: "high"
tags:
  - "walkthrough"
  - "embed"
startedAt: "2026-09-11T18:23:12.633Z"
resolutionType: "code-change"
resolutionDetail: "Stage H walked: Walk mounted with @graview/embed into a plain serif article page (walk/embed.html) twice, at two stops, over one store, each with both seats. Two findings fixed with criteria: W-028 an embed was not a landmark, so on a host page the strip, the seats and the picture sat outside any landmark (axe `region`, ten nodes) and two embeds were indistinguishable at the top — the root is a named `<section>` now, and the scaffolder's own embed.html gained the `<main>` the embed deliberately does not bring; W-029 in a narrow Graview the actions strip sat on the thing you were acting on, covering 85% of the focused card in a 350-wide embed — the rail's need is measured against the scene's box now, and where there is no room beside the picture the pane goes along the bottom while the scene gives up that height. Verified at 390 and 1280 in both schemes: both embeds are themed to themselves and the host page's typeface, ground and :root are untouched; two embeds are two named regions; the strip's faces, places and seats all work in each and the pages face inside an embed keeps the host's single main; nothing — menus, inspector, popovers — escapes either box and nothing is buried under the pane; axe clean on all sixteen combinations. pnpm smoke:create 30/30 including the two new embed verdicts."
acceptanceCriteria:
  - "both embeds are themed to themselves and the host's theme is untouched; two embeds have two landmark names; faces, places and seats work in each"
  - "nothing in either embed escapes its box: menus, inspector, popovers"
description: "Stage H of docs/walkthrough.md: mount the app with @graview/embed into a plain HTML page beside a paragraph, twice, at two stops."
lastModified: "2026-09-12T13:19:27.034Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
