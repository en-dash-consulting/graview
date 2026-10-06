---
"@graview/guest": patch
---

A worker view can no longer offer suggestions for a field, so the browser never types the view's words for the person (FR-92). The open kit drew `<datalist>` and an input's `list`. When the person picks a suggestion, the browser fills the field and raises a trusted `input` event, and the host took that as typing. A view could list one suggestion, "Looks right", whose value was the internal cost Erin may see. Her pick and press wrote the cost into the summary Lin reads. Now `list` is not drawn on an input, `<datalist>` is not drawn at all, and both are named in `NEVER_DRAWN`.

`guest-sandbox --transport=writes` gains a view that offers the suggestion. Before the fix, picking it with the keyboard and pressing wrote "costs 18500" for Lin in WebKit and Firefox. Chromium, headless, shows no suggestion. Now nothing is written in any of the three. A unit case holds `list` out.

Compatibility: unchanged. No op, stored format, wire message, check code or tool schema moves.
