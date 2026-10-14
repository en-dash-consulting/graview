# The hosted page's weight

What Graview Cloud's app shell loads from the framework before the app draws — `openRemote` plus the embed over a compiled document, built as Cloud builds it (esbuild, split, minified) — is **535.9 KB** up front (187.3 KB gzipped), against a budget of 538.0 KB (188.0 gzipped): **2.1 KB of headroom**, and 64.1 KB under the 600 KB Graview Cloud's brief set. 34.0 KB of it is zod (at most 150.0).

| Package | Up front (KB, minified) |
| --- | ---: |
| @graview/core | 184.0 |
| react-dom | 176.2 |
| @graview/primitives | 46.4 |
| zod | 34.0 |
| @graview/react | 29.1 |
| @graview/embed | 19.7 |
| @graview/ship | 17.2 |
| react | 7.7 |
| @graview/layout | 4.9 |
| scheduler | 3.6 |
| @graview/guest | 2.0 |
| (the page) | 0.6 |
| @graview/tools | 0.1 |
| **Total** | **535.9** |

Before a face draws, with what it fetches as it is first drawn: the scene 838.1 KB (302.3 KB fetched), the pages 815.1 KB (279.3 KB fetched).

Handed the compiled app its server made (`appFromOrCompile` from `@graview/core/compiled`, FR-123), the same page loads **494.7 KB** up front (172.8 KB gzipped) against a budget of 497.5 KB — 41.2 KB less, with no compiler in it.

Before zod's JSON-Schema writer left the page (the headroom after 0.1.29), the page that compiles its document loaded 550.9 KB up front (191.4 KB gzipped) and the page handed a compiled app 510.1 KB (177.0 KB gzipped): 15.0 KB (4.1 KB gzipped) and 15.4 KB (4.2 KB gzipped) less now.
