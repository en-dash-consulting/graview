# The hosted page's weight

What Graview Cloud's app shell loads from the framework before the app draws — `openRemote` plus the embed over a compiled document, built as Cloud builds it (esbuild, split, minified) — is **544.9 KB** up front (188.8 KB gzipped), against a budget of 544.9 KB (188.9 gzipped): **0.1 KB of headroom**, and 55.1 KB under the 600 KB Graview Cloud's brief set. 34.0 KB of it is zod (at most 150.0). The budget is its base raised by `the-0-1-30-wave-a-hosted-page.json`.

| Package | Up front (KB, minified) |
| --- | ---: |
| @graview/core | 196.1 |
| react-dom | 176.2 |
| @graview/primitives | 43.2 |
| zod | 34.0 |
| @graview/react | 31.3 |
| @graview/embed | 20.0 |
| @graview/ship | 17.2 |
| react | 7.9 |
| @graview/layout | 4.2 |
| scheduler | 3.6 |
| @graview/guest | 2.0 |
| (the page) | 0.6 |
| @graview/tools | 0.1 |
| **Total** | **544.9** |

Before a face draws, with what it fetches as it is first drawn: the scene 882.4 KB (337.6 KB fetched), the pages 854.1 KB (309.2 KB fetched).

Handed the compiled app its server made (`appFromOrCompile` from `@graview/core/compiled`, FR-123), the same page loads **501.3 KB** up front (173.4 KB gzipped) against a budget of 501.3 KB — 43.6 KB less, with no compiler in it.

Before its doors were tied to what it draws first and what draws a notice came to be fetched with the first (the headroom after 0.1.29, again), the page that compiles its document loaded 536.8 KB up front (187.9 KB gzipped) and the page handed a compiled app 495.6 KB (173.5 KB gzipped): -8.0 KB (-1.0 KB gzipped) and -5.6 KB (0.1 KB gzipped) less now.
