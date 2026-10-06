---
"@graview/guest": patch
"@graview/skills": patch
---

A worker view no longer speaks to assistive technology as the app's own chrome (FR-90). The open kit refused `role="navigation"`, `"banner"` and `"status"`, but drew the elements that carry those roles of their own. `<nav>` was a navigation landmark, `<header>` a banner, `<footer>` contentinfo, `<aside>` complementary, `<search>` search, `<output>` a status and a named `<section>` a region. `role="complementary"`, `"search"`, `"form"` and `"region"` were not refused at all. Setting a role cannot cover the elements: `role="none"` on a focusable or named element is ignored, and the landmark comes back.

Now `<nav>`, `<header>`, `<footer>`, `<aside>` and `<search>` are drawn as `<div>`, and `<output>` as `<span>` (`HTML_DRAWN_AS`), each with what it holds. Each is marked `data-graview-as`, and the view's selectors for those names are read as that attribute. So `.package header { … }` still styles the header the view drew. A `<section>` keeps its tag but is never named: `aria-label`, `aria-labelledby` and `title` are refused on it. `REFUSED_ROLES` gains `complementary`, `search`, `form` and `region`.

`guest-sandbox --transport=open` gains a view that tries each of these, and reads back each engine's accessibility tree. Before the change Chromium, WebKit and Firefox exposed eleven to thirteen landmarks and a status under the view's region, and now none. The view's words are still drawn, and its rule for `header` still styles the div. Unit cases hold each element, role and name. The `graview-worker-view` skill and the guest README say what a view's chrome-like elements become.

Compatibility: unchanged. No op, stored format, wire message, check code or tool schema moves.
