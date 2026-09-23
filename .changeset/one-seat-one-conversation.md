---
"@graview/primitives": patch
"@graview/studio": patch
---

One seat, one conversation. The app's chat and the studio's declaration seat are the same thread now: `useSeatConversation`, `SeatThread`, `SeatHeader`, `SeatComposer` and `SeatSettings` in `@graview/primitives`, used by both `ChatPanel` and `StudioAgentPanel`. The person in a bubble, the seat in prose with its rung aside set quieter, each proposal settling in place ("✓ …", struck through when discarded, "Refused: …" beside the form it came from), "Apply all" / "Keep all" in order, and the history the model is told includes what was applied. The studio's gear opens the same `LadderSetting` the profile holds; `IntelligenceSettings` is retired. `StudioAgentPanel` takes a `respond` like `ChatPanel` does.
