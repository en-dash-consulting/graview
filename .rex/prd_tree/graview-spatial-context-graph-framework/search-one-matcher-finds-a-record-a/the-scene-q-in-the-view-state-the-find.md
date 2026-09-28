---
id: "f3a98697-b72a-46a5-adc3-724848221708"
level: "task"
title: "The scene: q in the view state, the Find box in the Shell, hits lit and the rest dimmed, descent carrying in.q"
status: "completed"
priority: "high"
blockedBy:
  - "5b35ff0b-e2b8-435f-a968-167c628c84ee"
startedAt: "2026-09-28T21:53:14.006Z"
completedAt: "2026-09-28T21:53:14.502Z"
endedAt: "2026-09-28T21:53:14.502Z"
resolutionType: "code-change"
resolutionDetail: "ViewState.q (#q=, withQuery; outlives withFocus). adjustment(): q never compared and within's q ignored, so typing in the Find box or a row replaces; a lit district's descent pushes. FoundProvider in GraviewProvider runs search() once (kinds = drawn kinds, from = selection + focus) → useFound(); useImplicated = useReached() ∪ node hits, NOTHING_FOUND sentinel dims all when nothing found. GroupGlyph: data-graview-hits / data-graview-emphasis lit|dimmed, 'N match' button (hits-<kind>) → focus aggregate with in.q; tied now from useReached; withJackIn({carry}) sets in.q when a lit district is entered. BackOut: Esc clears q first. FindBox (primitives/find.tsx) in the Shell's own slot (own row < 720px): / and ⌘K, combobox + listbox grouped by kind, why lines, place 'Go to …', acts under the highlighted node (search with subject), Enter travels (node focus+select, kind descends narrowed, place, rule selects its nodes, act opens the context menu on the subject), live count, sheet on a phone. verify-navigation: typingLightsAndALitDistrictLandsNarrowed, theFindBoxIsACombobox, theDistrictOpensNarrowed, theStripIsASheetOnAPhone — 41/41; theWheelPansTheGround's fixed (400,300) had come to sit over the lists picture, so the harness now finds a ground point. React test a-search-lights-the-picture."
acceptanceCriteria:
  - "q is a ViewState field carried as #q=; keystrokes replace rather than push history; Back returns to the search"
  - "Hits are lit and everything else dimmed through the existing emphasis; a district with hits raises and shows its count at altitude; pressing it focuses the kind with in.q set; Esc clears q"
  - "The Find box in the Shell is reached by / and ⌘K; the strip is a combobox listbox with aria-activedescendant and a live count; ↑↓ move, Enter travels to the highlighted hit, an act hit appears only under a highlighted node hit"
  - "At 390px the strip is a sheet under the box and the page does not scroll sideways at a 32px root font; every control is at least 24px"
  - "verify-navigation holds the claim: typing lights, pressing a lit district lands narrowed, Back restores"
description: "q joins ViewState beside focusId, sel, overview and within (#q=van; keystrokes are adjustments, not history). Emphasis reads hits ∪ what the selection reaches; districts with hits raise and count at altitude; members and lenses light through implicated. Pressing a lit district focuses the kind with in.q set; Esc clears q, the row clears in.q. The Find box sits in the Shell's top bar, focused by / and ⌘K; the strip under it lists hits grouped by kind with mark, label, why and standing, a place hit as 'Go to …', an act hit only once a node hit is highlighted; combobox semantics, aria-activedescendant, a live region announcing counts; a sheet on a phone. Harness claim in verify-navigation."
lastModified: "2026-09-28T21:53:14.570Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
