---
"@graview/react": patch
---

A card does not swallow a field's key. Making the view host answer Enter and Space meant it called `preventDefault()` before asking whose key it was — and the in-place title editor is a one-field form inside a card, which the browser submits on Enter by default. Renaming a record stopped committing: the field stayed open and nothing was written. A key from inside a real control is left alone now; the card's own marks are unaffected.
