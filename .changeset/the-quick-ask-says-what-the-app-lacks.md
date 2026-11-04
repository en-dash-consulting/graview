---
"@graview/tools": patch
"@graview/core": patch
---

A quick ask that finds nothing can say what the app lacks, and the friction log learns it (Roadmap f-quick-ask-friction-hint). With Jev in the Fast slot and the light and full models behind it (0.1.65), an open answer goes through the framework's prompts, which a host cannot add to, so Graview Cloud's `couldNotFind` hint was lost. `HostAi.couldNotFind` (`true`, or a callback told a `CouldNotFind`: the words, the sentence, the need, the place or kind) is that hint, worded by the framework: the model is asked to say of words nothing here answers what the app does not keep ("This app keeps no budgets.") and what field or link would, the card says it, and the friction log keeps it as `unanswered` with `lacks` (`@graview/core/friction`: the event, the summary's questions and `frictionDigest`'s line carry it). Unsaid, the quick ask is asked as it was. Test: `a-quick-ask-that-finds-nothing-says-what-the-app-lacks`.

Compatibility: ops and primitives — unchanged. Stored formats — a friction event may carry `lacks`, optional and additive; a host that keeps events keeps it as it keeps the rest. The wire — unchanged. The declaration and check finding codes — unchanged. Derived tool names and input schemas — unchanged.

What Graview Cloud does: pass `couldNotFind` on the `HostAi` it hands the page — `true`, or its callback — in place of the prompt hint it added before 0.1.65.
