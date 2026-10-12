---
"@graview/core": patch
"@graview/tools": patch
"@graview/pages": patch
"@graview/primitives": patch
"@graview/studio": patch
---

A form, a field read as a document says it, and what can be done are entries of their own, so a page that has drawn none of them carries none of them. A bundler places a whole file in a page's first chunk when the first chunk can reach it and any chunk uses it, and three did: `formFields` and the rest of a form's reading rode in every hosted page's first load through `@graview/core`, though only a drawn form, the strip's ask and a seat read them; a field read in a document's words (`fieldSpecOf`) rode in it through `@graview/core/document`, though only a face's blocks and the checker read it; and the routed face reached `deriveAffordances` through `@graview/tools`, which carried the chat, the agent's tool surface and zod's JSON Schema into the pages face's first load. Now:

- `formFields`, `formField`, `formComplete`, `formArgs`, `undecidableArguments` and the types `FormField`, `ScalarField` and `UndecidableArgument` are `@graview/core/forms`', and no longer `@graview/core`'s;
- `fieldSpecOf` is `@graview/core/blocks`', beside `fieldSpecsOf`, and no longer `@graview/core/document`'s; `validateViewSpecs`, the checker's reading of a declaration's view specs, has a module of its own and is still `/document`'s;
- `@graview/tools/derive` carries `deriveAffordances`, `applyAffordance`, `previewAffordance` and `defaultProviders`, which `@graview/tools` still exports too, and the routed face reads them there.

What that buys, with a record's files (FR-162, FR-163) in the same pages: the hosted page carries 1,609 bytes fewer up front (587,604 where main is 589,213) and 280 fewer handed a compiled app (546,632 where main is 546,912); the pages face alone loads 26,338 bytes fewer first (505,306 where main is 531,644; 10,782 fewer gzipped), and the hosted page's routed face 25.7 KB fewer before it draws (834,347). The embed with the studio handed in loads 4,965 more first (1,571,334; the value's check, the file field's door on every face and the checker reading a field as a document says it), and every face 18,725 more in all, 12,787 of it the files' own chunk, fetched with the first file field drawn; both budgets are raised by that, measured.

Compatibility: breaking for an import, and nothing else. Ops, stored formats, wire messages, the document format, the compiled format, check finding codes and tool names and schemas are unchanged, and so is what each name does. What a host does: import `formFields` and the rest of a form from `@graview/core/forms`, and `fieldSpecOf` from `@graview/core/blocks`; a bundler alias list that names `@graview/core`'s subpaths names `@graview/core/forms` and `@graview/tools/derive` before the bare names (`graview create` writes both). Graview Cloud imports none of the moved names.
