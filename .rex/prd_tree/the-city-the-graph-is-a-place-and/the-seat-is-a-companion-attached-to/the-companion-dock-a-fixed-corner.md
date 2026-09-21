---
id: "82820801-f31e-435b-b1b6-375721ed72b3"
level: "task"
title: "The companion dock: a fixed corner element that expands into the panel, with the subject in its header, in every mode of the scene"
status: "pending"
priority: "high"
tags:
  - "assistant"
  - "scene"
  - "presence"
acceptanceCriteria:
  - "One entrance: the companion dock; the robot figure, its pad, follow mode and the bar's Ask pill are gone from the scene"
  - "The dock's box is identical at altitude, on the ground, flown closer and inside a full-screen lens (verify-companion: theDockIsFixed)"
  - "The header names the subject: selection, else hovered pick after a short dwell, else the place; a message saying 'this' resolves to it (theSubjectFollowsTheHover, thisIsTheHoveredTask)"
  - "Drawer on a desk, sheet on a phone; Escape closes it; tab reaches the dock; targets ≥ 32px; no document side-scroll at 390px"
  - "who, seat, chat, navigation, survey, audit-ui, pages and shrunk stay green; Squad and Groundskeeper re-run"
description: "A `Companion` primitive in @graview/primitives replaces the robot figure and the bar's Ask pill as the one entrance to the seat. Closed, it is a static dock fixed to the scene's bottom-right corner (the zoom control stacks above it): the seat's glyph, its name, and a one-line state — listening, and the subject it is listening about; working, while a turn runs; asked, when it has a question back; refused, with the policy's sentence. Open, it is the existing ChatPanel body in a drawer docked to the right edge on a desk and a sheet from the bottom on a phone, never anchored to a point in the picture. It is `position: fixed` relative to the scene's frame, so it stays put at altitude, on the ground, while flying closer, and inside a full-screen lens, where the figure had no place. The SUBJECT replaces follow mode: the selection when there is one, else the pick under the pointer (the same hover the robot read in follow mode, now read always, with a short dwell so it does not flicker), else where you are — the focused district, place or record — named in the header (\"about Pay the deposit\", \"about The week\", \"about the whole thing\"); \"this\" in a message means it. Escape closes the drawer and never changes the subject. `RobotMode`'s docked/following retire; reading/writing/refused/asking remain as the seat's state and the companion shows them. The robot's `padPlot` leaves the city map; `occupants.tsx` keeps people's figures only; the `Ask` pill leaves the bar; `keyboardReachesIt` becomes a tab stop on the dock. verify-robot.mjs is rewritten as verify-companion.mjs: dockedOnOpen becomes theDockIsFixed (same box at altitude, on the ground, flown closer and in a full-screen lens), followModeTrailsThePointer becomes theSubjectFollowsTheHover, thisIsTheHoveredTask and aRefusalIsSaidAtTheGate keep their meaning, escapeReleases becomes escapeClosesTheDrawer. Unit: the-occupants.test.tsx loses the robot cases; a-companion-names-its-subject test."
lastModified: "2026-09-21T18:51:43.726Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
