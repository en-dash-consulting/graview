---
"@graview/core": patch
---

What the stylesheet sanitizer keeps now reads the same wherever it is put, so a host may wrap `sanitizeStylesheet`'s output, or a headless run's `css`, in a cascade layer or an `@media` of its own. A condition and a selector hold no `}`, `;`, at-keyword, `<!--`, `-->`, lone backslash or unmatched bracket at any depth, and a value holds no unmatched bracket. Each is refused and said (`unreadable`), and `graview check` warns of it in `brand.views.css` (`brand-views-css`). A sheet that wrote one of these lost nothing it drew: the browser dropped that rule already. Test: `a-judged-stylesheet-cannot-close-what-holds-it` (core).

Compatibility: ops and primitives — unchanged. Stored formats — unchanged. The wire — unchanged. The declaration and check finding codes — unchanged; `brand-views-css` now also says these. Derived tool names and input schemas — unchanged.

What Graview Cloud does: take this release, and check any sheet it stored before it.
