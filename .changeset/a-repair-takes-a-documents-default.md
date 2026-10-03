---
"@graview/core": patch
---

A repair takes a document's default. `compileDocument` keeps a field's `default` out of the zod schema on purpose, since hydration must not invent values, so `validateGraph` could not find it: a record whose required `status` no longer fit was planned as `drop`, and every other fix on it went too. A kind now carries its fields' defaults beside its schema as `defaults`, and `compileDocument` fills it from the document. When a required field that no longer fits has no zod `.default()`, `validateGraph` reads `defaults` and plans `coerce` to it, provided the default fits; the plan says "1 required field would be set to its default". A field the schema can leave empty is still cleared, the smaller fix. A kind declared in TypeScript may declare `defaults` too, and `toDocument` writes them as each field's `default`. A zod `.default()` behaves as before (FR-50).

Compatibility: the declaration — additive. `NodeDefinitionSpec` gains an optional `defaults`, and the document format is unchanged. Check finding codes are unchanged. For a document-compiled app, a record whose only unfixable field was a required one with a default is now patched rather than removed, so a repair plan for it changes from `drop` to `coerce`. The wire — `capabilities().shipped` adds FR-50. Ops, primitives and stored formats are unchanged.
