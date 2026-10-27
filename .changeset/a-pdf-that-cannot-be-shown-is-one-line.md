---
"@graview/primitives": patch
"@graview/core": patch
"@graview/skills": patch
---

A PDF that cannot be shown is one line (FR-234), Roadmap f-pdf-fallback-one-line. A record's PDF was an `<object>` 420 px tall with a frame, its fallback sentence inside it: where a browser draws no PDF inline — an iPhone, or a host whose page says `object-src 'none'` — the reader got a tall empty box with one sentence. The file's line now stands outside the box and says it all, "week44.pdf · PDF · 1.2 MB — Open / Download" (Open in a tab, Download with the file's name), and the box takes its height and its frame only once the browser has loaded the PDF into it (a browser with a PDF viewer — Chrome, headed Chromium — fires `load` on the object; Playwright's headless engines, an iPhone and a page whose CSP refuses the route fire nothing, and the box stays at nothing). The host contract says the rest: a host's page that carries a `Content-Security-Policy` allows its files route in `object-src` if it wants a PDF drawn inline (`docs/stability.md`, the ship and host-page skills). A primitives test holds it (`a-pdf-that-cannot-be-shown-is-one-line`), and the files harness reads the line on every engine and holds the box to its state — sized once loaded, nothing until then. FR-234 is said as shipped: `capabilities().shipped` gains FR-234.

Compatibility: ops and primitives, stored formats, the declaration and check finding codes, and derived tool names and input schemas — unchanged. The wire: unchanged; `capabilities().shipped` lists FR-234. What Graview Cloud does: allow its files route in the hosted page's `object-src`, or nothing — the line is there either way.
