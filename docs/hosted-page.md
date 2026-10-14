# The hosted page's weight

What Graview Cloud's app shell loads from the framework before the app draws — `openRemote` plus the embed over a compiled document, built as Cloud builds it (esbuild, split, minified) — is **530.2 KB** up front (185.0 KB gzipped), against a budget of 538.0 KB (188.0 gzipped): **7.8 KB of headroom**, and 69.8 KB under the 600 KB Graview Cloud's brief set. 34.0 KB of it is zod (at most 150.0).

| Package | Up front (KB, minified) |
| --- | ---: |
| @graview/core | 178.6 |
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
| **Total** | **530.2** |

Before a face draws, with what it fetches as it is first drawn: the scene 830.7 KB (300.5 KB fetched), the pages 807.3 KB (277.1 KB fetched).

Handed the compiled app its server made (`appFromOrCompile` from `@graview/core/compiled`, FR-123), the same page loads **489.4 KB** up front (170.6 KB gzipped) against a budget of 497.5 KB — 40.8 KB less, with no compiler in it.

Before zod's JSON-Schema writer left the page (the headroom after 0.1.29), the page that compiles its document loaded 550.9 KB up front (191.4 KB gzipped) and the page handed a compiled app 510.1 KB (177.0 KB gzipped): 20.7 KB (6.4 KB gzipped) and 20.7 KB (6.4 KB gzipped) less now.
