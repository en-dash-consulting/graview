---
"@graview/studio": patch
"@graview/embed": patch
"@graview/skills": patch
"@graview/core": patch
---

A host's refusal is said in its own words, and an Apply with nothing changed asks the host nothing (FR-65). `onApply` could answer `{ ok: false, findings }` (FR-60), which the studio always headed "Not kept: the host could not keep this change. Your edits are still here.", so Graview Cloud said "Nothing changed in the studio." as a finding under a heading about failing to keep something. A verdict may now carry a `sentence`, which the studio says as its heading in place of its own; with one, `findings` may be empty or left out, and no empty list is drawn. Apply with nothing changed, or with every change taken back, no longer reaches the host: the studio says "Nothing to apply: the declaration is as the studio opened it. Change something, then Apply." and stays open. `Studio.unchanged()` reads that from the graph, not the history, so a change undone is no change. The applied panel's `data-applied` gains `unchanged`. Tests in `@graview/embed` hold the sentence as the heading with findings, with an empty list and with none, the studio's own heading where there is no sentence, and `onApply` not called for an untouched studio or one whose change was undone; `verify-studio` presses Apply in a host's page before any change and finds the host handed nothing, then finds the host's sentence heading its refusal. `capabilities().shipped` names FR-65.

Compatibility: the wire — additive: `capabilities().shipped` gains `FR-65`. `StudioHostVerdict` widens: a refusal may carry `sentence`, and with it `findings` is optional. A host whose `onApply` was handed an unchanged declaration is no longer called for it. Ops, stored formats, check codes and tool schemas are unchanged.
