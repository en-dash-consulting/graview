# The hosted page's weight

What Graview Cloud's app shell loads from the framework before the app draws — `openRemote` plus the embed over a compiled document, built as Cloud builds it (esbuild, split, minified) — is **573.1 KB** up front, against a budget of 579.7 KB: **6.6 KB of headroom**, and 26.9 KB under the 600 KB Graview Cloud's brief set. 54.6 KB of it is zod (at most 150.0).

| Package | Up front (KB, minified) |
| --- | ---: |
| @graview/core | 193.1 |
| react-dom | 176.2 |
| zod | 54.6 |
| @graview/primitives | 46.0 |
| @graview/react | 29.0 |
| @graview/embed | 19.7 |
| @graview/ship | 17.0 |
| @graview/guest | 10.4 |
| react | 7.7 |
| @graview/layout | 5.4 |
| scheduler | 3.6 |
| (the page) | 0.6 |
| @graview/tools | 0.1 |
| **Total** | **573.1** |

Before a face draws, with what it fetches as it is first drawn: the scene 881.8 KB (308.7 KB fetched), the pages 814.3 KB (241.2 KB fetched).

Handed the compiled app its server made (`appFromOrCompile` from `@graview/core/compiled`, FR-123), the same page loads **533.1 KB** up front — 40.0 KB less, with no compiler in it.
