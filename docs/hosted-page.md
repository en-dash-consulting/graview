# The hosted page's weight

What Graview Cloud's app shell loads from the framework before the app draws — `openRemote` plus the embed over a compiled document, built as Cloud builds it (esbuild, split, minified) — is **596.8 KB** up front (208.3 KB gzipped), against a budget of 596.9 KB (208.6 gzipped): **0.1 KB of headroom**, and 3.2 KB under the 600 KB Graview Cloud's brief set. 34.7 KB of it is zod (at most 150.0). The budget is its base raised by `a-board-moves-without-buttons-a-hosted-page.json`, `a-change-from-elsewhere-is-heard-a-hosted-page.json`, `a-change-is-said-in-words-a-hosted-page.json`, `a-compacted-store-serves-no-unseen-id-hosted-page.json`, `a-declared-row-names-its-record-a-hosted-page.json`, `a-draft-view-is-swapped-in-place-a-hosted-page.json`, `a-drop-reads-upload-at-a-hosted-page.json`, `a-field-typed-together-is-edited-live-hosted-page.json`, `a-form-for-a-visitor-a-hosted-page.json`, `a-frame-guest-holds-back-the-drawn-signal-a-hosted-page.json`, `a-grant-to-make-a-kind-takes-out-only-what-you-made-a-hosted-page.json`, `a-kept-view-is-a-place-in-the-nav-hosted-page.json`, `a-logo-for-each-scheme-a-hosted-page.json`, `a-long-headline-a-hosted-page.json`, `a-page-opened-on-a-draft-view-a-hosted-page.json`, `a-page-opens-on-a-short-tail-a-hosted-page.json`, `a-part-is-waited-for-until-it-has-drawn-a-hosted-page.json`, `a-place-is-tidied-from-its-menu-a-hosted-page.json`, `a-record-holds-a-video-a-hosted-page.json`, `a-rules-today-is-the-apps-day-hosted-page.json`, `a-text-field-takes-a-splice-hosted-page.json`, `a-view-is-as-tall-as-it-draws-a-hosted-page.json`, `a-view-that-bleeds-a-hosted-page.json`, `a-views-link-carries-the-hosts-address-a-hosted-page.json`, `a-views-place-flows-a-hosted-page.json`, `a-visitor-is-told-how-to-get-in-hosted-page.json`, `act-names-edit-refusals-and-capitals-a-hosted-page.json`, `an-act-in-another-spelling-hosted-page.json`, `an-edge-sign-steps-past-a-districts-name-a-hosted-page.json`, `blocks-lay-out-as-written-a-hosted-page.json`, `built-in-views-look-designed-a-hosted-page.json`, `dates-and-the-quick-ask-together-a-hosted-page.json`, `datetimes-in-the-apps-time-zone-hosted-page.json`, `edge-fields-client-ids-opaque-cursor-hosted-page.json`, `edits-reach-readers-when-published-a-hosted-page.json`, `every-form-asks-in-one-order-hosted-page.json`, `every-relation-comes-with-its-connect-and-disconnect-hosted-page.json`, `first-draw-chunks-hosted-page.json`, `formats-fail-closed-hosted-page.json`, `inline-ai-finish-hosted-page.json`, `lenses-and-views-a-hosted-page.json`, `navigate-filters-and-hidden-lenses-a-hosted-page.json`, `not-now-and-a-nights-run-a-hosted-page.json`, `nothing-stands-over-a-control-a-hosted-page.json`, `ops-carry-their-value-once-hosted-page.json`, `playback-reads-the-archive-a-hosted-page.json`, `suggestion-and-lineage-shapes-a-hosted-page.json`, `templates-cards-and-bar-a-hosted-page.json`, `text-is-typed-together-hosted-page.json`, `text-is-typed-together-over-the-wire-hosted-page.json`, `the-0-1-30-wave-a-hosted-page.json`, `the-0-1-30-wave-second-half-a-hosted-page.json`, `the-0-1-37-batch-and-the-walk-merged-a-hosted-page.json`, `the-0-1-37-batch-merged-a-hosted-page.json`, `the-0-1-37-harness-reds-hosted-page.json`, `the-0-1-42-batch-merged-hosted-page.json`, `the-bar-holds-still-a-hosted-page.json`, `the-document-builds-its-shapes-on-first-use-hosted-page.json`, `the-first-load-waits-on-less-a-hosted-page.json`, `the-inline-ai-a-hosted-page.json`, `the-keyboard-reaches-a-long-list-a-hosted-page.json`, `the-lazy-past-declaration-a-hosted-page.json`, `the-notify-me-a-hosted-page.json`, `the-page-says-when-a-place-has-drawn-a-hosted-page.json`, `the-quick-ask-a-hosted-page.json`, `the-scene-opens-on-the-overview-a-hosted-page.json`, `the-scene-strip-tells-the-watch-a-hosted-page.json`, `the-scene-under-a-hosts-bar-a-hosted-page.json`, `the-tenth-walk-a-hosted-page.json`, `the-twelfth-walk-hosted-page.json`, `views-take-a-drop-hosted-page.json`.

| Package | Up front (KB, minified) |
| --- | ---: |
| @graview/core | 230.9 |
| react-dom | 176.3 |
| @graview/primitives | 47.3 |
| @graview/react | 35.5 |
| zod | 34.7 |
| @graview/embed | 25.3 |
| @graview/ship | 18.3 |
| react | 7.9 |
| @graview/layout | 4.2 |
| scheduler | 3.6 |
| @graview/guest | 2.1 |
| (the page) | 0.6 |
| @graview/tools | 0.3 |
| **Total** | **596.8** |

Before a face draws, with what it fetches as it is first drawn: the scene 993.3 KB (396.5 KB fetched), the pages 972.9 KB (376.1 KB fetched).

Handed the compiled app its server made (`appFromOrCompile` from `@graview/core/compiled`, FR-123), the same page loads **548.1 KB** up front (191.1 KB gzipped) against a budget of 548.2 KB — 48.7 KB less, with no compiler in it.

Before its doors were tied to what it draws first and what draws a notice came to be fetched with the first (the headroom after 0.1.29, again), the page that compiles its document loaded 536.8 KB up front (187.9 KB gzipped) and the page handed a compiled app 495.6 KB (173.5 KB gzipped): -60.0 KB (-20.5 KB gzipped) and -52.4 KB (-17.7 KB gzipped) less now.
