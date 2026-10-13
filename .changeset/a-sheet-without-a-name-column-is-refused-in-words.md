---
"@graview/core": patch
---

A sheet without a name column is refused in words rather than thrown (the ninth walk, W-196). `importRows` and `previewImport` named each planned record by its kind's label, and a kind declared in TypeScript is labeled `(node) => node.label`, which says nothing where the sheet holds no name — so a beekeeping co-op's sheet of inspections threw "Cannot read properties of undefined (reading 'trim')" before a row was read. A label that says nothing, or throws, now names the row the way a row with no name is named, and the row is refused: "it has no Name, which every inspection needs".

Compatibility: none of the import's shapes change; a sheet that threw now answers.
