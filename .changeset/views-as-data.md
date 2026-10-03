---
"@graview/core": patch
"@graview/primitives": patch
"@graview/skills": patch
---

A kind's card, row and page can be declared as data. `defineApp({ viewSpecs })` takes blocks from a closed set: title, text, badge with a tone, field with `as`, progress, group, `when`, divider and figure. Fields are bound by `{field}` templates, and conditions and tones are written in the rule language. A document's `views` compile to the same thing, and `toDocument` writes them back.

`registerViewSpecs(registry, schema, specs)` in `@graview/primitives` draws them into the view matrix:
- `card` at one × summary, beside the focus and on the pages face's gallery;
- `row` at one × glyph;
- `page` at one × full, above the framework's own view, which `DefaultView` draws.

The scaffold's `views()` registers them, so a new project shows the card it declares with no component code.

The tones are the theme's tokens, `good`, `warn`, `bad`, `neutral` and `accent`, and the blocks are styled by a fixed set of classes. Nothing in a spec runs. It carries no CSS, no markup and no URL, and the only link a view draws is an http(s) `url` field's own value. `graview check` holds every name and tone to the declaration (`view-field`, `view-name`, `view-tone`, `view-kind`, `view-slot`, `view-figure`, `view-block`).

The rule language reads a record's own values only. `constructor` was taken for an operator by the tokenizer, and read through `in` it handed a template the function `Object`. It is now a name like any other, and no field (FR-03).

Compatibility: the declaration — additive: `GraviewApp.viewSpecs` is optional, and its finding codes are new and reported only for a declaration that has view specs. The rule language — a name on `Object.prototype` (`constructor`, `toString`) is no longer read as a field or a binding; no declared field has such a name.
