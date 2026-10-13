# The hosted page's weight

What Graview Cloud's app shell loads from the framework before the app draws — `openRemote` plus the embed over a compiled document, built as Cloud builds it (esbuild, split, minified) — is **575.0 KB** up front, against a budget of 579.7 KB: **4.7 KB of headroom**, and 25.0 KB under the 600 KB Graview Cloud's brief set. 54.6 KB of it is zod (at most 150.0).

| Package | Up front (KB, minified) |
| --- | ---: |
| @graview/core | 194.9 |
| react-dom | 176.2 |
| zod | 54.6 |
| @graview/primitives | 46.1 |
| @graview/react | 29.0 |
| @graview/embed | 19.7 |
| @graview/ship | 17.0 |
| @graview/guest | 10.4 |
| react | 7.7 |
| @graview/layout | 5.4 |
| scheduler | 3.6 |
| (the page) | 0.6 |
| @graview/tools | 0.1 |
| **Total** | **575.0** |

Before a face draws, with what it fetches as it is first drawn: the scene 883.3 KB (308.3 KB fetched), the pages 818.8 KB (243.8 KB fetched).

Handed the compiled app its server made (`appFromOrCompile` from `@graview/core/compiled`, FR-123), the same page loads **534.3 KB** up front — 40.7 KB less, with no compiler in it.
