---
id: "5f233f8f-feb9-431e-9515-029d94f7ec49"
level: "task"
title: "Raising a relation breaks the composition: the planes touch and the board collapses to a stamp"
status: "pending"
priority: "high"
tags:
  - "bug"
  - "layout"
  - "scene"
  - "board-lens"
source: "Reported from screenshots in session 2026-08-31; reproduced and measured with playwright against the coaching example."
acceptanceCriteria:
  - "With a relation raised in the coaching example at 1280x800, 1440x900 and 1512x780, no plane-1 card's rendered box intersects any plane-2 card's rendered box, and there is at least 12px of clear ground between the two bands"
  - "A tucked kind card never covers its parent's name or its proportion bar at any viewport the survey covers"
  - "With a relation raised, the board lens fills at least 40% of its focus card's area, or the lens changes what it draws at that size rather than shrinking the same picture"
  - "No slot label overlaps another slot's disc, and no slot is clipped by the pitch edge — asserted in scripts/audit-ui.mjs so it stays true"
  - "scripts/audit-ui.mjs gains a state with a relation raised for each app that has one, since every existing state left plane 1 empty and that is why this went unseen"
  - "The panel meta and the warning key no longer read as contradicting each other"
  - "The trail emits no separator when it has no crumb to separate"
  - "The board key shows one line per distinct violation message, not one per implicated node"
  - "pnpm survey and pnpm audit are clean, and pnpm test, pnpm typecheck and pnpm check still pass"
description: "With a relation raised, the scene stops composing. Two faults dominate, both measured rather than eyeballed, plus four smaller ones on the same screens.\n\nREPRODUCE\nthe coaching example, place \"The team\". Click the DRILLS kind card to raise it, then click a drill. Reproduced at 1440x900, 1333x720, 1280x800 and 1512x780 — every viewport tried short of 2000x1080.\n\n1. PLANE 1 AND PLANE 2 TOUCH. The lowest raised card's bottom edge and the highest kind card's top edge measure a gap of MINUS ONE PIXEL. The five drill cards sit directly on FIXTURES / PLAYERS / POSITIONS / REASONS / SKILLS, and the tucked cards make it worse: \"PLAYERS 10\" runs into \"UNAVAILABILITY 1\", \"SKILLS 8\" into \"DRILLS 5\", and \"REASONS 2 / RULES 6 / SESSIONS 2\" pile into one another.\n\n   The arithmetic is in packages/layout/src/layout.ts, the with-relations branch: relationY 0.74 + relationH 0.175 = 0.915 against contextY 0.918. Three thousandths of the height — about 2.6px at 883 — and the rendered cards eat it. The bands were retuned twice this session (once when the actions strip started reserving room, once when the kinds plane became a strip of glyphs) and this branch was never checked with a relation actually raised.\n\n2. THE BOARD COLLAPSES. The pitch renders 200x277 inside a 1040x424 focus card — THIRTEEN PER CENT of the card's area. About 340px of empty card sits to the left of the pitch and 490px to the right of the \"NOT IN\" column. The lens sizes the pitch from the height it is given and derives the width from aspect 0.72, so when the focus band shrinks to make room for plane 1 the pitch shrinks in both directions at once while the card keeps its full width.\n\n   At that size the arrangement stops being readable: in the reported screenshots the slot labels overlap the next row's discs — \"Hana\", \"Jo\" and \"Dev\" sit on the LB and RB circles, \"Bo\" and \"Cass\" on the GK circle, and \"Amara\" is clipped by the pitch's bottom edge. The zone rail (ATTACK / MIDFIELD / DEFENCE) is vertical text crammed against a 200px-wide field.\n\nSMALLER FAULTS ON THE SAME SCREENS\n\n3. The panel meta reads \"COMPLETE\" while the key immediately below lists two warnings. Both are true — every slot is filled, and two positions demand a skill nothing trains — but side by side they read as a contradiction. \"Complete\" is about occupancy and does not say so.\n\n4. The agent seat renders as a 161px disabled ghost button (\"Every position is filled\") in the command bar. Correct behaviour, wrong presence: a permanently-visible control that is dead most of the time. Related to the open question about whether that button belongs in the bar at all.\n\n5. A stray \"›\" separator sits between the places switcher and the raised-relation chip. The Trail drops its home crumb when an app has a places switcher, but still emits the separator that was meant to follow it.\n\n6. The two key lines under the board can carry the same sentence twice — one violation naming two positions produces one line per position with identical text. Deduplicate by message, or name both positions on one line."
---
