---
"@graview/primitives": patch
---

The board lens takes a choice about what a press selects. `pickTarget: "slot"` makes a press on a mark choose the slot itself even when one occupant fills it — a load map is asked about the component, not its sole owner — where the default, `"occupant"`, keeps a sole-filled mark standing for that person.
