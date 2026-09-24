---
"@graview/primitives": patch
---

The board lens takes two choices about its discs. `pickTarget: "slot"` makes a press on a disc choose the slot itself even when one occupant fills it — a load map is asked about the component, not its sole owner — where the default, `"occupant"`, keeps a sole-filled disc standing for that person. `occupantLabel: "given"` writes only the first word of each name under a disc, so two full names on a shared seat do not collide; the hover title still carries them whole.
