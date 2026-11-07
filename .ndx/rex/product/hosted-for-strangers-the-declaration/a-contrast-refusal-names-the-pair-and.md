---
id: "62f3c6fd-eb28-4cac-97cb-c44f435d24c7"
type: "capability"
title: "A contrast refusal names the pair and the ratio, with a fix (FR-126)"
slug: "a-contrast-refusal-names-the-pair-and"
statement: "When an accent is refused for contrast, the product names the failing pair and its ratio and suggests the nearest passing shade."
criteria: [{"id":"c1","text":"When an accent is refused for contrast, the product shall name the failing pair and the ratio in the refusal, in the form 'white text on #e6c200 is 1.6:1; 4.5:1 is needed'."},{"id":"c2","text":"When an accent is refused for contrast, the product shall include a fix in the refusal that suggests the nearest passing shade."},{"id":"c3","text":"When set-brand is given { accent: \"#e6c200\" }, the product shall refuse it with the sentence naming the pair and ratio and a suggested accent."}]
tags:
  - "graview-cloud"
  - "FR-126"
  - "chat-authored"
  - "a11y"
source: "Graview Cloud, 2026-10-07 (handoff: brand and theme an app from a chat — docs/framework-handoff-branding.md)"
priority: "medium"
resolution: "Shipped in #133 (0.1.16): set-brand refuses an accent that does not read with the pair, the ratio and the nearest passing shade as its fix; graview check warns brand-accent on a document that holds one."
---

An accent refused for contrast doesn't say which pair failed, so a chat can't fix it.
