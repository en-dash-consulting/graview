# The hosted page's weight

What Graview Cloud's app shell loads from the framework before the app draws — `openRemote` plus the embed over a compiled document, built as Cloud builds it (esbuild, split, minified) — is **575.9 KB** up front, against a budget of 579.7 KB: **3.8 KB of headroom**, and 24.1 KB under the 600 KB Graview Cloud's brief set. 54.6 KB of it is zod (at most 150.0).

| Package | Up front (KB, minified) |
| --- | ---: |
| @graview/core | 196.6 |
| react-dom | 176.2 |
| zod | 54.6 |
| @graview/primitives | 45.7 |
| @graview/react | 28.8 |
| @graview/embed | 19.7 |
| @graview/ship | 17.0 |
| @graview/guest | 10.4 |
| react | 7.7 |
| @graview/layout | 5.4 |
| scheduler | 3.6 |
| (the page) | 0.6 |
| @graview/tools | 0.1 |
| **Total** | **575.9** |

Before a face draws, with what it fetches as it is first drawn: the scene 877.0 KB (301.1 KB fetched), the pages 840.0 KB (264.1 KB fetched).

Handed the compiled app its server made (`appFromOrCompile` from `@graview/core/compiled`, FR-123), the same page loads **534.6 KB** up front — 41.3 KB less, with no compiler in it.
