# The hosted page's weight

What Graview Cloud's app shell loads from the framework before the app draws — `openRemote` plus the embed over a compiled document, built as Cloud builds it (esbuild, split, minified) — is **529.3 KB** up front (182.9 KB gzipped), against a budget of 537.5 KB (186.4 gzipped): **8.2 KB of headroom**, and 70.7 KB under the 600 KB Graview Cloud's brief set. 34.0 KB of it is zod (at most 150.0).

| Package | Up front (KB, minified) |
| --- | ---: |
| @graview/core | 184.5 |
| react-dom | 176.2 |
| @graview/primitives | 41.9 |
| zod | 34.0 |
| @graview/react | 29.3 |
| @graview/embed | 19.7 |
| @graview/ship | 17.2 |
| react | 7.9 |
| @graview/layout | 4.2 |
| scheduler | 3.6 |
| @graview/guest | 2.0 |
| (the page) | 0.6 |
| @graview/tools | 0.1 |
| **Total** | **529.3** |

Before a face draws, with what it fetches as it is first drawn: the scene 846.6 KB (317.3 KB fetched), the pages 827.8 KB (298.5 KB fetched).

Handed the compiled app its server made (`appFromOrCompile` from `@graview/core/compiled`, FR-123), the same page loads **488.1 KB** up front (168.5 KB gzipped) against a budget of 496.0 KB — 41.2 KB less, with no compiler in it.

Before its doors were tied to what it draws first and what draws a notice came to be fetched with the first (the headroom after 0.1.29, again), the page that compiles its document loaded 536.8 KB up front (187.9 KB gzipped) and the page handed a compiled app 495.6 KB (173.5 KB gzipped): 7.6 KB (5.0 KB gzipped) and 7.6 KB (5.0 KB gzipped) less now.
