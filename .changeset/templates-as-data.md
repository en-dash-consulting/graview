---
"@graview/core": patch
"@graview/tools": patch
---

Templates as data. A template made in Graview Cloud — a declaration document, the questions that set it up, what the answers do as ordinary acts, and example content, in Cloud's `graview-template` shape — now scaffolds a self-hosted project and sets up a live store with no Cloud in the room.

`graview create <dir> --template <file|url>` judges the template first (its shape, its document through `compileDocument`, its setup acts against that document, its examples against the schema) and refuses with the path of every finding before a directory exists. The project is the checkout `graview create` always writes, with the declaration kept as the document: `src/domain/app.json`, compiled by `compileDocument` when the domain loads, and the template beside it as `template.json`. Writing TypeScript from the document would need a generator for every construct the document has and would then be a second declaration to drift from the first; kept as the document, `graview describe` says the same of the project as of the template, by construction. The project's test holds the declaration to `graview check` and runs the template's setup as one batch that one undo takes back, and `apply-template` is a script.

`graview apply [<entry>] --template <file|url> [--answers '<json>'] [--examples]` runs the setup through the same `planFrom` and `applyPlan` as `--plan`: judged under the seat first, applied as one batch authored by the template (`{ kind: "system", id: "template:<id>" }` unless `--as` or `--roles` say who), with "Set up from <title>" as its intent. One `--undo` takes it back. `--examples` brings the example content as a batch of its own. Without an entry, the template's document is the app.

`@graview/core/document` gains `readGraviewTemplate`, `isGraviewTemplate`, `instantiateTemplate`, `templateSeedPrimitives`, `TemplateSpec` and `TEMPLATE_FORMAT`, and `ScaffoldOptions` gains `template`. Every command that reads a `.json` entry reads a template as the document inside it (FR-08).

Compatibility: the declaration — additive: a template is a new format beside the document, which is unchanged; every document that compiled compiles the same, and no check finding code changes. `graview create` without `--template` writes the same files as before. The wire — additive: `capabilities().shipped` now names FR-08. Derived tool names and input schemas: unchanged.
