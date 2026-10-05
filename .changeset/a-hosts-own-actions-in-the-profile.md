---
"@graview/embed": patch
"@graview/primitives": patch
"@graview/core": patch
"@graview/skills": patch
---

A host's own actions are drawn in the profile menu (FR-72). Graview Cloud had nowhere in the embed for "Change the app", "Your apps" and "Report this app", so it kept them in a `<details>` menu of its own fixed over the corner of the scene. `mount(root, { hostActions: [{ label, href }] })` now draws them in the strip's profile menu, under who is signed in, in the order given: each a link (with `target` where it opens elsewhere) or, with `onSelect` and no `href`, a press; a press of either closes the menu. They are stops for the keyboard like everything else in the menu, which takes the keyboard when it opens (FR-77), and they are drawn in the embed's own scheme. `@graview/embed/pages` takes the same option, and so does the whole-page `Shell`; `HostAction` is exported from `@graview/embed` and `@graview/primitives`. A unit test finds the links in the menu of the whole embed and of the pages alone, in order and reachable, and a press that closes it; `verify-chrome` mounts the embed on a host's page with Cloud's three actions and reaches each by the keyboard alone from the profile button, on the Graview and pages faces, at 1440×900 and 390×844, in light and in dark, at better than 4.5:1 against the menu, with nothing of the host's fixed over the embed. The `graview-embed` skill says to put a host's furniture inside the embed, never over it. `capabilities().shipped` names FR-72.

Compatibility: the wire — `capabilities().shipped` gains `FR-72`, nothing else on it moves. Ops, stored formats, check codes and tool schemas are unchanged.
