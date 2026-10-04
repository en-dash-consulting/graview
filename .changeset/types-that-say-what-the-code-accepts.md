---
"@graview/core": patch
"@graview/ship": patch
"@graview/tools": patch
---

Four types now say what the code already accepts, found when every package's tests began to be typechecked. A lens role may be bound to a field and the values that make it true — `{ field: "status", is: ["done"] }`, the shape `lifecycle` reads a state in — which the checker and the calendar lens always read, but `LensDeclaration.bindings` refused. `withViews` keeps the app's schema (`<S>(app: GraviewApp<S>, …) => GraviewApp<S>`) instead of widening it to one a typed app is not. `instructionsFor` takes anything with a `name`, the only thing it reads. And a live `welcome`'s `state.snapshot` is typed a `GraphSnapshot`, which it always was, rather than `unknown`.

Compatibility: types only, and each one wider or more exact than before: nothing that compiled stops compiling, and nothing at run time changes. The wire, `WIRE_PROTOCOL`, ops, stored formats and check codes are unchanged.
