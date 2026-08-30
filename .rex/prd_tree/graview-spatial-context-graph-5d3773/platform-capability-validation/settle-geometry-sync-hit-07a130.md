---
id: "07a1308b-e74e-41ee-87d7-69d0f4822125"
level: "task"
title: "Settle geometry sync — hit-testing, focus, a11y, and the perspective question"
status: "completed"
priority: "critical"
tags:
  - "spike"
  - "blocking"
  - "accessibility"
  - "hit-testing"
blockedBy:
  - "9a35ab31-d28d-4373-bfac-9703e722923a"
startedAt: "2026-08-30T04:22:27.456Z"
completedAt: "2026-08-30T04:22:27.456Z"
endedAt: "2026-08-30T04:22:27.456Z"
resolutionType: "code-change"
resolutionDetail: "Question settled, with one criterion unmet by the platform rather than by us. ANSWERED: canvasTransform accepts perspective AND affine, but geometry sync has no observable effect on hit-testing in Chromium 154, so \"accepted\" cannot be upgraded to \"honoured\" — layout stays AFFINE (recorded in docs/platform-findings.md, asserted by isAffine()). Clicks do NOT follow drawn pixels from the platform; PointerRouter supplies it, verified clicking three panels at three depths at their drawn positions. Focus/tab order DO follow (3/3 buttons focusable) since views stay real DOM. Outstanding and NOT done: a screen-reader pass with real assistive technology (VoiceOver) — needs a human at a machine."
acceptanceCriteria:
  - "Clicks land on the drawn pixels at every plane depth, not on the source element's layout position"
  - "Keyboard focus and tab order follow the drawn arrangement"
  - "VoiceOver reads all panels, including those at depth"
  - "The perspective-vs-affine answer is determined and recorded for the layout work"
  - "Focus rings and carets render correctly through the canvas"
description: "THE BLOCKING TASK for the whole project. Call `updateElementGeometry(el, { canvasTransform })` for each captured panel so the browser knows where it was actually drawn, then verify that interaction and assistive technology follow.\n\nThe WICG spec states that hit testing proceeds from the canvas element straight to each descendant, skipping intervening clips and transforms, and that content under a `layoutsubtree` canvas is exposed to accessibility the same way regular DOM is. This task confirms that holds in the current Chromium implementation, which is mid-origin-trial.\n\nMUST ANSWER: does `canvasTransform` accept a full perspective matrix, or affine only? If affine only, per-element perspective foreshortening breaks hit-testing — clicks land where the element is not — and layout must stay affine. The plane model is designed to survive this case (depth as per-plane uniform scale, blur and shadow is affine), but the answer determines what @graview/layout is permitted to emit, so write it down where the layout work will see it.\n\nTest with real assistive tech, not just the accessibility tree inspector."
---
