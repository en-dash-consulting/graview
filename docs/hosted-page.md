# The hosted page's weight

What Graview Cloud's app shell loads from the framework before the app draws — `openRemote` plus the embed over a compiled document, built as Cloud builds it (esbuild, split, minified) — is **545.1 KB** up front (188.9 KB gzipped), against a budget of 545.2 KB (189.0 gzipped): **0.1 KB of headroom**, and 54.9 KB under the 600 KB Graview Cloud's brief set. 34.0 KB of it is zod (at most 150.0). The budget is its base raised by `a-grant-to-make-a-kind-takes-out-only-what-you-made-a-hosted-page.json`, `the-0-1-30-wave-a-hosted-page.json`, `the-tenth-walk-a-hosted-page.json`.

| Package | Up front (KB, minified) |
| --- | ---: |
| @graview/core | 196.3 |
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
| **Total** | **545.1** |

Before a face draws, with what it fetches as it is first drawn: the scene 883.3 KB (338.2 KB fetched), the pages 854.9 KB (309.7 KB fetched).

Handed the compiled app its server made (`appFromOrCompile` from `@graview/core/compiled`, FR-123), the same page loads **501.5 KB** up front (173.5 KB gzipped) against a budget of 501.6 KB — 43.6 KB less, with no compiler in it.

Before its doors were tied to what it draws first and what draws a notice came to be fetched with the first (the headroom after 0.1.29, again), the page that compiles its document loaded 536.8 KB up front (187.9 KB gzipped) and the page handed a compiled app 495.6 KB (173.5 KB gzipped): -8.3 KB (-1.0 KB gzipped) and -5.9 KB (0.0 KB gzipped) less now.
