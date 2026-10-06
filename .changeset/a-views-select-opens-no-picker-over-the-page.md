---
"@graview/guest": patch
---

A worker view's select can no longer open a picker over the whole page (FR-90). The open kit let a stylesheet set `appearance` to anything and write `::picker(select)`. Since Chrome 135, `appearance: base-select` makes a select customizable, and its picker is drawn in the top layer, outside the region's containment and clip, styled by the view. A view could size the picker to cover the viewport and draw it as the app's own chrome. The person's first click on the select opened it over the app's bar and took their next click. In the installed Chrome 154 and Chrome Canary 157 the picker covered the bar. Playwright's pinned Chromium 131 predates customizable selects, so the harness cannot show it. Now `appearance` and `-webkit-appearance` are held to `auto`, `none`, `menulist-button` and `textfield`, as `position` is held to its keywords, and `::picker` is a refused selector. Unit cases hold out `base-select` in any spelling or through `var()`, and the picker rule. With the fix, the same page in Chrome 154 and Canary 157 keeps the bar on top.

Compatibility: unchanged. No op, stored format, wire message, check code or tool schema moves.
