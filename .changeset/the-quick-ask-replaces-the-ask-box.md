---
"@graview/core": patch
"@graview/layout": patch
"@graview/tools": patch
"@graview/react": patch
"@graview/primitives": patch
"@graview/pages": patch
"@graview/embed": patch
"@graview/skills": patch
---

The quick ask replaces the Ask box (Roadmap f-quick-ask-framework). No face draws a field at its foot that grows into a chat thread any more: `SeatField`, its panel and Pages' `PageAsk` are gone, and so are their settings, the Shell's `ask` and `chat`, a routed face's `context.ask`, the embed's `seat` option and `handle.setAskField`. In their place, where the host's `ai` gives a model and does not say `off`, ⌘K (Ctrl+K) opens a command bar beside what the reader is on — the selected card on the scene, the record or list a page is about — that completes the acts on it, "Show …" for a panel the catalog can draw of it, its places and its records. Words that complete nothing are asked, and the answer is a card beside the record or the list: a few sentences, the places, records and panels that act on it, and the changes it proposes as a ghost on the card, accepted all or some as one batch with its one undo. A follow-up is asked on the card and replaces its answer; it is not a thread. The context menu's "Ask about this…", Find's last row and the search page's "Ask: ‘…’" open the same card, Activity keeps each ask as an AI interaction (`ask.kind` `"ask"`, with its `answer`) and "Ask again" asks it on the card again. Where the quick ask is drawn ⌘K is its and `/` stays Find's — Pages' Find hears `/` too, and the bar says `/` over its box; where it is not, both are Find's.

`quickAsk` (a boolean, on by default) on `Shell`, a routed face's context and `mount`/`<Embed>`, and `handle.setQuickAsk(on)`, say whether it is drawn; `quickAskOf(setting)` reads a setting a host kept from the Ask box — `"field"` is on, `"hidden"` is off — and the embed reads a kept string the same way. The answer is the host's: `HostAi.answer` (`{ model, answer({ said, target, targetLabel, state, catalog, follows }) → { text, pick?, usage? } }`) answers it, else the Thinking slot, else the Fast slot's pick among the candidates; `answerHere` on `@graview/tools/inline-ai` is the engine, and `stubThinking` answers it for a test. A provider drawn inside another now takes the outer one's `ai` unless given its own, so an embed's routed face draws the inline AI and the quick ask too.

The conversation stays the app's (`seatTalk`, the responders, `ai.turn`): no face draws it, and `ChatPanel` is there for a product that places one in its own layout. The strip the scene kept clear at its foot for the field stays, always, as the foot's (where the zoom, the way back, a notice and a proposal stand), so the city keeps its fit; `useSeatDrawn` and the conversation's `open`, `side`, `drawn`, `setOpen` and `setSide` went with the field. The four harnesses that existed for the box (`chat`, `phone-seat`, `seat-guide`, `seat-goes-and-draws`) are retired, and `quick-ask` holds the new surface on both faces in three engines.

It adds 0.1 KB more up front to a hosted page (100 bytes, 60 gzipped, about the 19 its first load grew by and a margin), and its raises are filed in `scripts/budget-raises/`.

Compatibility: no surface changes. Removed: `SeatField`, `SeatFieldProps`, `SeatStart`, `SEAT_WIDTH`, `SEAT_PHONE_BELOW`, `PageAsk`, `useSeatDrawn`, `SeatSide`, the Shell's `ask` and `chat`, `PageContext.ask`, `EmbedOptions.seat` and `EmbedHandle.setAskField`. New: `QuickAskDoor`, `openQuickAsk`, `useQuickAskDrawn`, `quickAskOf`, `QuickAskOpening` on `@graview/primitives`, `PageQuickAsk` on `@graview/pages`, `quickAsk` on `ShellProps`, `PageContext` and `EmbedOptions`, `EmbedHandle.setQuickAsk`, `HostAi.answer` with `AnswerProvider`, `AnswerRequest` and `AnswerReply`, `answerHere`, `answerOf` and `QuickAsk` on `@graview/tools/inline-ai`, `AiInteraction.answer`, and `HeldGhost.onCard`.
