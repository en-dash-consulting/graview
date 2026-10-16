---
id: "610d8397-c4cd-427a-bdd4-43dddd8a79d8"
level: "task"
title: "0.1.31 · 09–10: Quick-ask and in-place answer cards replace the Ask box, and graview.dev drops the chat box"
status: "completed"
startedAt: "2026-10-16T15:36:33.000Z"
completedAt: "2026-10-16T20:26:02.000Z"
priority: "high"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.31"
blockedBy:
  - "e493f990-e60a-44ca-b399-d6f6dae7188f"
source: "ndx-capture"
acceptanceCriteria:
  - "no framework surface draws the chat box, and the display setting is gone or mapped with a test over existing values"
  - "quick-ask works on Scene and Pages with a stub provider, and AI-off hides it cleanly"
  - "a search of graview.dev for the chat box (copy, alt text, images) finds nothing, and the new screenshots come from a real app"
description: "Roadmap f-quick-ask-framework (09, after 08) and f-dev-site-no-chatbox (10, after 09). Cloud's half is f-retire-ask-box. 09: remove or replace the Ask box component on Pages and the Scene and retire its display setting, mapping existing values onto the new surface so no app breaks; a / or Cmd-K command bar scoped to the current target and selection with completions for acts, places, records and 'show...'; answers as cards placed beside the record or list, using the candidate catalog and ghost layer for any proposed change, a follow-up being a quick-ask on the card, not a thread; a host seam for the answer provider, and AI-off hides it. 10: replace every graview.dev mention, screenshot and demo of the Ask/chat box (copy, alt text, images, recipes, docs pages) with the inline AI, screenshots taken from a real app after 09 lands. If 08 did not land, skip and say so on both Roadmap features."
lastModified: "2026-10-16T20:26:02.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Notes

### 2026-10-16

**09 — the quick ask replaces the Ask box.** No face draws the Ask box: `SeatField`, `SeatPanel` (`seat-field.tsx`, `seat-panel.tsx`) and Pages' `PageAsk` (`ask.tsx`, `ask-place.ts`) are deleted, and with them the Shell's `ask` and `chat`, `PageContext.ask`, `EmbedOptions.seat` and `EmbedHandle.setAskField`. The new surface:

- `QuickAskDoor` (`packages/primitives/src/quick-ask-door.tsx`, drawn by the Shell, the embed's scene face and Pages' `PageQuickAsk`) holds ⌘K/Ctrl+K in the capture phase where `inlineAiOn(ai)` and the setting are on, and fetches `quick-ask.tsx`: one card beside the target (the selected card or district on the scene, a record's pick target, else the page's heading; top-center for a place). As a bar it completes the target's acts (derived affordances the catalog offers, applied at once, or the menu for one that asks), "Show …" (the catalog's panels, drawn and kept as a lens), places and records (the search matcher), and "Ask: ‘…’". Asked, it becomes the answer card: the words, the offers that are places/records/panels, and the proposed changes as the existing ghost (`GhostTray placement="card"`, `HeldGhost.onCard`; back to the tray if the card is put away). A follow-up replaces the answer and hands the model only the ask before it. Find's last row, the search page's "Ask: ‘…’", the context menu's "Ask about this…" and Activity's "Ask again" all open the same card (`openQuickAsk`, `quick-ask-desk.ts`).
- Decision on the chord: the spec allowed `/` or ⌘K; ⌘K is the quick ask's where it is drawn and `/` stays Find's (the bar now says `/`, and Pages' Find hears `/` too). Where no quick ask is drawn both stay Find's, so no keyless app changes.
- Setting: `quickAsk` (boolean) on Shell, PageContext, EmbedOptions, plus `handle.setQuickAsk`. `quickAskOf(stored)` maps the old values (`"field"` → on, `"hidden"` → off, nothing → on); the embed applies it to whatever it is handed, so a stored string still works at run time. Tested over every value in `packages/embed/tests/unit/the-quick-ask-follows-the-apps-setting-on-both-faces.test.tsx`.
- Answer seam: `HostAi.answer` (`AnswerProvider`: `{ model, price?, answer({ said, target, targetLabel, state, catalog, follows }) → { text, pick?, usage? } }`); unsaid, the Thinking slot answers as JSON `{answer, pick}`, else the Fast slot picks candidates. Engine `answerHere` on `@graview/tools/inline-ai`; `stubThinking` answers it. Picks are filtered to the catalog; changes become a ghost via `ghostOf`; entries are `ask.kind: "ask"` with `AiInteraction.answer`.
- **What became of the seat's conversation UI:** the engine stays (seatTalk's turns and pending ask, the responders, `ai.turn`, the agent seat tools); `ChatPanel` stays exported for a product that places a conversation in its own layout (and the studio's seat keeps its thread), but no framework face draws it. `seatTalk` lost `open`, `side`, `drawn`, `setOpen`, `setSide`; `useSeatDrawn` is gone. The 64px strip the scene kept for the field stays, always, as the foot's (`FOOT` in `rails.ts`): dropping it moved districts at 390 wide under each other in quiet's and calendar's watch, so the city keeps the fit it had.
- A provider drawn inside another now inherits the outer `ai` unless given its own (the embed's routed face had no AI at all before).
- Keyless apps (no model) draw no quick ask: the graph-only answers the seat gave are reachable through Find and the agent tools, not a box.

**Harnesses.** New `verify-quick-ask` (registered in verify-all, three engines by default, replaces `chat` in the nightly shard): no Ask box on either face; ⌘K bar beside the selection; completions for acts, places, records and "Show …"; the answer card beside the record with its ghost accepted as one batch through `ai:<interaction>` and undone; a follow-up replaces the answer; Escape returns the keyboard; Activity keeps each ask once; "Show …" draws a panel kept as a lens; the menu's "Ask about this…"; on Pages the card by the record's heading; AI off draws none of it and ⌘K is Find's. All hold in Chromium, WebKit and Firefox. Retired, as they existed only for the box: `verify-chat`, `verify-phone-seat`, `verify-seat-guide`, `verify-seat-goes-and-draws` (and their ports and package scripts; the stale `docs/chat.json`, `docs/seat-guide.json`, `docs/seat-goes-and-draws.json` verdicts are left for Nick to delete, since harness output is not committed by these runs). Updated to the new surface: pages, chrome, navigation, a11y, playback, viewport, screen-reader, engines, inline-ai, smoke-create, audit-ui, survey-ui, progression, voiceover-walk, the watch's overlay list, arranging-line. Three harnesses leaned on geometry they did not name and were made robust: `lines` presses the card's panel rather than its slot, `drawn-once` reads a card tall enough for every row as one that says nothing is hidden, `navigation` carries a district already partly under a phone's sheet wholly under it.

**10 — graview.dev.** The tour's AI bullet and the agents page now describe the inline AI and the quick ask; the live seedbed frame's caption and label say "an agent's seat, in Activity"; the settle script no longer closes a seat. New pictures `docs/site/img/quick-ask-{light,dark}.png` are the todo example as it runs, taken by `scripts/site-quick-ask-shots.mjs` (the script is the host and lends a scripted Thinking slot whose words are true of the seed on 2026-09-01). Site rebuilt with `pnpm site:build` (chapters.js) and `pnpm site:build:all`; `tests/the-site-draws-no-chat-box.test.ts` holds that no page, alt text, picture name or live bundle on docs/site says or draws the box. The skills (agent-seat, pages, embed, new-app), the embed README and `docs/stability.md` say the quick ask.

**Left:** the unreleased `pages-honor-the-ask-field-setting.md` changeset (01) describes `PageContext.ask`/`setAskField`, which this one removes before release; fold it at the Version packages step. Pre-existing reds seen in the chain, not from this task (each also red on a worktree at HEAD or environmental): growing, address, calendar (the watch's control-covered at 390, the same on HEAD), playback stop 0, journeys, WebKit's Google Fonts `goto` timeouts (viewport, screen-reader, engines), engines' Firefox `isMobile` and seedbed context-menu waits. The branch's c0571230 (calendar-sync-demo) fails the port-base and en-US spelling tests.
