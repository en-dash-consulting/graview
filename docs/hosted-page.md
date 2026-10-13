# The hosted page's weight

What Graview Cloud's app shell loads from the framework before the app draws — `openRemote` plus the embed over a compiled document, built as Cloud builds it (esbuild, split, minified) — is **550.5 KB** up front (190.3 KB gzipped), against a budget of 554.0 KB (191.5 gzipped): **3.5 KB of headroom**, and 49.5 KB under the 600 KB Graview Cloud's brief set. 54.6 KB of it is zod (at most 150.0).

| Package | Up front (KB, minified) |
| --- | ---: |
| @graview/core | 179.1 |
| react-dom | 176.2 |
| zod | 54.6 |
| @graview/primitives | 46.1 |
| @graview/react | 29.3 |
| @graview/embed | 19.7 |
| @graview/ship | 17.2 |
| react | 7.7 |
| @graview/layout | 4.9 |
| scheduler | 3.6 |
| @graview/guest | 2.0 |
| (the page) | 0.6 |
| @graview/tools | 0.1 |
| **Total** | **550.5** |

Before a face draws, with what it fetches as it is first drawn: the scene 842.8 KB (292.4 KB fetched), the pages 822.5 KB (272.0 KB fetched).

Handed the compiled app its server made (`appFromOrCompile` from `@graview/core/compiled`, FR-123), the same page loads **509.7 KB** up front (175.9 KB gzipped) against a budget of 513.5 KB — 40.8 KB less, with no compiler in it.
