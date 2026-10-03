---
"@graview/core": patch
"@graview/tools": patch
---

Agents name records the way people do. A person says "book the florist", never `vendor:bloom-co`. Every argument that names a record now takes its id or its name:
- a label, case and accents aside;
- or the one label it starts;
- among the records the seat may see, of the kinds the argument accepts.

`book` with `id: "bloom"` books `vendor:bloom-co`, and the result's `resolved` names the id it took. Two matches are refused with both listed, in the message and in `candidates`. None says so, and points at `search_graph`. `get_node` and `preview_mutation` take a name the same way. Ids keep working unchanged.

`store.resolveRef(arg, given, principal)` gives a host the same answer: one id, or the candidates. A record the principal may not see is never a candidate, by name or by id. It reads a label index kept per kind as sorted keys. The index follows the graph's diffs, so resolving costs the matches, not a scan of every record.

`nodeRefArgs` no longer needs the copy of the framework that compiled an act. A node reference keeps its kinds on the schema under a registry symbol rather than in a module's WeakMap. A host that bundles its own copy reads them too (FR-33).

Compatibility: derived tool names and input schemas: unchanged, and the conformance fixtures match. Derived tool descriptions: every act tool with an argument that names a record ends with "An argument that names a record takes its id or its name." `get_node`'s `id` is described as "A node's id, or its name." where it said "Node id." Behaviour: a node argument that is neither an id the seat sees nor a name it can resolve is refused by the runtime, before the store sees it, where the act used to say so itself. A name that matches several records is refused rather than passed through. Additive: `Store.resolveRef`, and the `RefResolution`, `RefCandidate` and `NodeRefArg` types, `nameKey`, `BY_NAME`, `Resolved`, `ToolResult`'s `candidates` and `argument`.
