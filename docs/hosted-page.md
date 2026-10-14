# The hosted page's weight

What Graview Cloud's app shell loads from the framework before the app draws — `openRemote` plus the embed over a compiled document, built as Cloud builds it (esbuild, split, minified) — is **523.6 KB** up front (180.6 KB gzipped), against a budget of 531.5 KB (184.5 gzipped): **7.9 KB of headroom**, and 76.4 KB under the 600 KB Graview Cloud's brief set. 34.0 KB of it is zod (at most 150.0).

| Package | Up front (KB, minified) |
| --- | ---: |
| @graview/core | 178.9 |
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
| **Total** | **523.6** |

Before a face draws, with what it fetches as it is first drawn: the scene 838.5 KB (314.9 KB fetched), the pages 819.2 KB (295.7 KB fetched).

Handed the compiled app its server made (`appFromOrCompile` from `@graview/core/compiled`, FR-123), the same page loads **482.7 KB** up front (166.2 KB gzipped) against a budget of 490.5 KB — 40.9 KB less, with no compiler in it.

Before its doors were tied to what it draws first and what draws a notice came to be fetched with the first (the headroom after 0.1.29, again), the page that compiles its document loaded 531.0 KB up front (185.4 KB gzipped) and the page handed a compiled app 490.1 KB (171.0 KB gzipped): 7.4 KB (4.8 KB gzipped) and 7.4 KB (4.9 KB gzipped) less now.
