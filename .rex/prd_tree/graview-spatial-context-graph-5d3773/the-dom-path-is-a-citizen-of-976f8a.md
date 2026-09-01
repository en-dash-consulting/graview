---
id: "976f8afb-00c4-4a4e-856f-59f9720443ab"
level: "feature"
title: "The DOM path is a citizen of every browser"
status: "in_progress"
priority: "high"
source: "Nick, 2026-09-01: \"what's the deal with the cross-browser functionality.. is that captured as outstanding in the prd?\" — it was not. Every harness runs only Chrome Canary; the shipped DOM path is unverified in WebKit and Gecko."
startedAt: "2026-09-01T18:39:28.470Z"
acceptanceCriteria:
  - "A three-engine harness matrix (Chromium, WebKit, Firefox) runs audit-core, direct-manipulation and pages-at-phone-width, with per-engine verdicts"
  - "No harness hardcodes a browser binary; the engine is a parameter and Canary is required only where the GPU flag genuinely is"
  - "The altitude morph degrades to a clean cut where @property is unsupported — verified in Firefox ESR-class engines"
  - "Line/tie hit paths and measured anchoring pass in WebKit at desktop and 390px"
  - "The local-AI rung's fallback to graph-native is verified in an engine without Prompt API/WebGPU, and the chat header says why"
  - "A supported-browsers statement lands in the README and the graview-new-app skill"
description: "Two paths, two stories. The GPU capture path is Chromium-only by nature (CanvasDrawElement) — experimental, opt-in, correctly gated. The DOM path is what ships, and it has never been run outside Chrome Canary: all ~22 harness scripts hardcode the Canary binary (GRAVIEW_BROWSER exists as an unused override), so every green verdict is a one-browser verdict. iOS Safari is the mobile browser and the pages face exists for mobile, so WebKit is a the household product launch-blocker, not polish.\n\nWork: (1) Harness matrix — Playwright already bundles WebKit and Firefox; run a core subset (audit, verify-direct-manipulation, verify-pages at 390px, one survey pass) against all three engines, with per-engine verdicts in the JSON; un-hardcode the browser (engine parameter, Canary only where the GPU flag is genuinely needed). (2) Verified degradation — the registered @property --graview-altitude drives the graview morph; where unsupported the transition must degrade to a clean cut, verified not assumed; audit adoptedStyleSheets floor (Safari 16.4+/FF 101+) and decide the supported-browser statement. (3) Measured geometry under WebKit — the DOM-measured anchoring (getBoundingClientRect under transforms) is where engine quirks live; the line/tie endpoints and hit paths need the matrix most. (4) Capability gating stated in the UI — Chrome's Prompt API and WebGPU-dependent WebLLM already fall back to the graph rung; verify the fallback in engines that lack them and keep the chat header honest about why. (5) Record the supported-browsers statement in the README/skills."
lastModified: "2026-09-01T18:39:28.481Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
