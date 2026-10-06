---
"@graview/guest": patch
---

A worker view's stylesheet can no longer reach its own region by writing `:-->host` or `:<!--host` (FR-90). The sanitiser judged a selector token by token and refused `:host` when a colon stood right before it, but it wrote `<!--` and `-->` back as nothing. So `:-->host { contain: none !important; overflow: visible !important; position: static !important }` was judged harmless and drawn as `:host { … }`. A view's `!important` rule on `:host` wins over the region's own styles, inline ones included. The view could lift the region's containment and clip, then draw an absolutely placed element over the app's own bar, capturing clicks meant for it. `::slotted`, `::part` and `:host-context` got through the same way. Now `<!--` and `-->` in a selector refuse the rule as unreadable, and wherever they are written back they are written as they were, so nothing the sanitiser drops can join two tokens into a name it never judged.

`guest-sandbox --transport=open` gains a fourth view that tries this. Before the fix it covered the app's bar in Chromium, WebKit and Firefox. Now the region keeps its containment and the bar stays on top in all three, and five unit cases hold the spellings out.

Compatibility: unchanged. No op, stored format, wire message, check code or tool schema moves.
