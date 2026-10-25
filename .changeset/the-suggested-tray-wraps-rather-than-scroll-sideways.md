---
"@graview/primitives": patch
---

The Suggested tray never scrolls sideways (Roadmap f-suggested-tray-overflow). With seventeen suggestions in Threat Watch, each one's sentence ("Merge @tanstack/react-router into @tanstack/* (42 packages)"), its "based on …" line and its record chips ran past the panel's right edge, and the panel scrolled sideways. The panel is now no wider than the page (`min(320px, 100vw − 16px)`) and hides what would run sideways; its rows and their lines may shrink (`min-width: 0`, one `minmax(0, 1fr)` column), the sentence, the basis and a refusal break anywhere (`overflow-wrap: anywhere`), the chip row and the Accept, Decline and Not now row wrap, and a chip still too wide is cut with an ellipsis, its whole name in its title. `pnpm verify chrome` holds it at 320 px on both faces with a record named in 120 characters and no space (`theSuggestedTrayNeverScrollsSideways`): before, the panel held 932 px of content in 318.

Compatibility: ops and primitives, stored formats, the wire, the declaration and check finding codes, derived tool names and input schemas — unchanged. The look: the tray's lines carry `data-graview-suggestion-words` and its chip row `data-graview-suggestion-records`.
