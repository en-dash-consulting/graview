---
"@graview/core": patch
"@graview/tools": patch
"@graview/primitives": patch
"@graview/studio": patch
---

One switch, four rungs — and a rung that says what it cannot do. `IntelligenceConfig.source` is now `"graph" | "local" | "decision" | "remote"`: graph only, onboard AI, Jev, LLM — one setting, live, saved in the person's own browser. The ladder has two axes and `RUNGS` says so: each rung declares the capabilities it serves (`prose`, `decide`, `propose`); a surface asks `rungFor(config, capability)` for a capability and never for a provider; and a capability the chosen rung cannot serve falls down to the graph, which is keyless and always there. `capabilitiesOf(kind)` in `@graview/core` is the same table for declared providers, and `graview describe` reads the ladder out — which rungs the app declares and what each can do, and what the graph answers instead on a rung that cannot.

On the decision rung the chat seat is answered by the graph and SAYS so in the answer itself — "(Jev decides rather than talks — the graph is answering here.)" — as part of `ChatReply.say`, not chrome painted by the panel, so every surface the seat speaks from carries the sentence unchanged. A turn that started on one rung while the person moved to another says which rung answered it rather than finishing silently (`configuredResponder`'s `current` hook, wired in the chat panel and the studio's). `decideFor(config)` is the decision behind a rung for a surface that wants one: the provider exactly on the decision rung (by the person's key, or through the dev server's door), a model behind the full parse-and-refuse layer (`completionDecide`) on a model rung, and nothing on the graph rung — where `graphDecide(store)` answers what the store's own rules already decided and names what it cannot. The picker offers the fourth rung with an optional key; with none, the app's decision door is used.
