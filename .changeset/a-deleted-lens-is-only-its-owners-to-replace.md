---
"@graview/core": patch
"@graview/ship": patch
---

A deleted lens of the declaration can no longer be wiped by a seat that may not restore it. A deleted lens is kept under Recently deleted as `lens:<title>`, beside the script views, and an editor who may tidy views but not lenses could `POST /graview/views { remove: "lens:Calendar" }`: `memoryViews` replaced the owner's entry with a plain view's of the same name, and the owner's restore then answered 200 and brought nothing back. Now `/graview/views` refuses hide, show and remove of a name under `lens:`, or of one a deleted lens holds, to a seat without `may.lenses` (403, "Only the app's owner changes a lens the app declares."), and `memoryViews.remove` never replaces a deleted lens's entry. Core's place-menu test holds that a view's removal leaves a deleted lens restorable, and ship's views test that an editor is refused all four and the owner's restore still reaches the declaration.

Compatibility: ops and primitives, the declaration and derived tool names and input schemas — unchanged. Stored formats — unchanged: a kept views file reads and writes as before. The wire — `/graview/views` answers 403 to hide, show or remove of a `lens:` name from a seat that may not change lenses, where it answered 200.
