---
"@graview/primitives": patch
"@graview/react": patch
"@graview/embed": patch
"@graview/core": patch
"@graview/skills": patch
---

A host's buttons stand on the app bar (FR-227), Roadmap f-host-buttons-in-the-app-bar. Graview Cloud's "Send feedback" could sit only in the person's menu (`hostActions`) or the right-click menu, two taps from a reader, and a host may float nothing over an app (FR-72). An embed, the pages alone and the Shell now take `barActions: [{ label, icon?, onSelect }]`: each is a button on the bar itself, on both faces, before the standing and the person, named by its label with its mark (an emoji, a glyph or an inline `<svg>`) hidden from a reader who cannot see it. Where the bar has their width over a phone's they stand on the row; where it does not — a phone, a small box — they fold into one control, "More", that lists them, one of the bar's own family of popovers. `handle.setBarActions` changes them live, as `setHostActions` does the menu's; `undefined` takes them off, and nothing is drawn when a host gives none. They are the host's only: no declaration and no sandboxed view can put a button on the bar. The primitives' and the embed's tests hold it (`a-hosts-buttons-stand-in-the-bar-or-fold`, `a-hosts-buttons-are-in-the-app-bar-on-both-faces`), and the chrome harness presses "Send feedback" by the keyboard on both faces, standing on a desk and folded on a phone. The host-page skill and the embed's README say it beside `hostActions`. FR-227 is said as shipped: `capabilities().shipped` gains FR-227.

Compatibility: ops and primitives, stored formats, the declaration and check finding codes, and derived tool names and input schemas — unchanged. The wire: unchanged; `capabilities().shipped` lists FR-227. What Graview Cloud does: hand `mount` its "Send feedback" as `barActions`, and keep `hostActions` for the menu.
