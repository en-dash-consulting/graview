# The hosted page's weight

What Graview Cloud's app shell loads from the framework before the app draws — `openRemote` plus the embed over a compiled document, built as Cloud builds it (esbuild, split, minified) — is **579.7 KB** up front, against a budget of 579.7 KB: **0.0 KB of headroom**, and 20.3 KB under the 600 KB Graview Cloud's brief set. 54.6 KB of it is zod (at most 150.0).

| Package | Up front (KB, minified) |
| --- | ---: |
| @graview/core | 200.3 |
| react-dom | 176.2 |
| zod | 54.6 |
| @graview/primitives | 45.7 |
| @graview/react | 28.8 |
| @graview/embed | 19.6 |
| @graview/ship | 17.0 |
| @graview/guest | 10.4 |
| react | 7.7 |
| @graview/layout | 5.4 |
| scheduler | 3.6 |
| (the page) | 0.6 |
| @graview/tools | 0.2 |
| **Total** | **579.7** |

Before a face draws, with what it fetches as it is first drawn: the scene 883.9 KB (304.2 KB fetched), the pages 847.2 KB (267.5 KB fetched).

Handed the compiled app its server made (`appFromOrCompile` from `@graview/core/compiled`, FR-123), the same page loads **535.2 KB** up front — 44.5 KB less, with no compiler in it.
