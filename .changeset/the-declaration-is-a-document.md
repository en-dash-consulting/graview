---
"@graview/core": patch
"@graview/ship": patch
"@graview/tools": patch
---

The declaration is a document. One JSON object, the Graview declaration document, compiles into the same app `defineApp` declares, through `compileDocument` in `@graview/core/document`.
- **Kinds** have typed fields, label templates, lifecycles and relations.
- **Acts** are a closed set of effects with `allowedWhen` refusals.
- **Rules** are written in the rule language.
- **Policy, modules, lenses and settings** are the data they already are.

Nothing in the document path runs a string as code, and a test reads the module to hold that. `canonicalize` gives two documents equal in meaning the same bytes.

`toDocument(app)` gives a document-made app back exactly. For a TypeScript app it writes what is data and names, at its JSON path, each surface that is code.

`graview check`, `serve`, `mcp` and `describe` take `--document <file>` with no TypeScript entry, and check reports a document's findings with the path to fix each at. `capabilities().documentFormats` says `graview-document@1` (FR-01).

Compatibility: the declaration — additive: a new entry point, a new format (graview-document 1), and `--document` on the commands; a TypeScript declaration is read as before.
