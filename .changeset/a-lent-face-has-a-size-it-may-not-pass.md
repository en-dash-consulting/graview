---
"@graview/core": patch
"@graview/guest": patch
"@graview/skills": patch
---

A face a brand lends its views has a size it may not pass, and two lent under one name say which draws (Graview HQ f-lent-faces-bounded). A face the app lends its views (`brand.views.fonts`) was handed to `FontFace` by its address and loaded with the first view dressed in its brand, whatever its size, since `FontFace` has nothing to stop at a size with. The host now fetches the file itself — a file the app holds where `asset` serves it, or an `https:` address on an origin in `fonts.origins`, as before — and hands `FontFace` the bytes. A file that says it is larger than `VIEW_FONT_MOST_BYTES` (2 MB, from `@graview/core/css`) is not read; one that says no size is read only until it passes it. Either way the face is not loaded, and the view's notice and the host's `onProblem` say so: "…is more than 2 MB, the most a face lent to views may be." Two million bytes is more than any one Latin face needs and less than one weight of a whole CJK face, which wants subsetting before a page loads it eagerly. A face sent on by a listed origin to one the host does not list is refused as an unlisted origin is.

Two brands on one page that lend one family, weight and style from two files no longer leave the engine to choose: the page holds one of them at a time, the one lent later, once it has loaded, in every view; the earlier is set aside, drawn again when the later goes, and each lender is told. A brand that changes one file for another gives the old back as the new is lent, and nothing is said. The graview-view-drawing skill states the limit and the rule.

Tests: `a-lent-face-past-its-size-is-not-loaded` (guest) loads a face within the limit and at it, refuses one whose file says it is larger without reading it, stops reading one that says no size once it passes the limit, and says each, for a file the app holds and an `https:` one; `two-faces-lent-under-one-name-the-later-draws` (guest) draws the later of two files lent under one name though the earlier loaded last, draws the earlier again once the later goes, keeps the earlier until the later has loaded, says nothing when one brand changes its file, and draws both where their weights differ. Each failed before the change. guest-sandbox's brand claims serve a 3 MB face in Chromium, WebKit and Firefox and hold that it is not loaded and is said. The tests that mount a view with lent faces hand the page a `fetch`.

Every face grows by 1.9 KB (0.9 KB gzipped), as does the guest host drawing a worker view on the open kit, under a raise of their budgets.

Compatibility: ops and primitives — unchanged. Stored formats — unchanged. The wire — unchanged. The declaration and check finding codes — unchanged. Derived tool names and input schemas — unchanged. A lent face is fetched by the page now, so a host whose page has a content security policy admits a face's origin in `connect-src` as well as `font-src`; a file the app holds on the page's own origin needs only `'self'`.

What Graview Cloud does: nothing for faces it serves itself; where it lends Google Fonts files, its page's `connect-src` lists https://fonts.gstatic.com.
