# What `graview check` says

`graview check` reads a Graview app's declaration without a browser and reports what is wrong with it, in words. It can say 124 things, read here out of the checker's own source. An **error** should fail your build. A **warning** is a judgment call. A **note** is a question worth answering once.

## 85 errors

`brand-accent-not-a-hue`, `brand-accent-unknown-kind`, `brand-currency`, `brand-emoji`, `brand-locale`, `brand-logo`, `brand-mark`, `brand-time-zone`, `creates-unknown-kind`, `edge-claim-unknown-kind`, `edge-target-undeclared`, `field-role-ill-typed`, `field-role-missing-field`, `figure-undrawable`, `figure-unknown-kind`, `fixed-unknown-field`, `form-act-not-granted`, `form-act-on-a-record`, `form-field-unfillable`, `form-field-unknown`, `form-omits-required`, `form-unknown-act`, `form-visitor-may-more`, `form-without-sight`, `glance-unknown-field`, `grant-own-end-without-link`, `grant-unknown-kind`, `grant-unknown-mutation`, `intelligence-decision-cannot-call`, `intelligence-reach-unknown`, `intelligence-unknown-mutation`, `invariant-scope-undeclared`, `kit-contrast-below-aa`, `lens-binding-empty`, `lens-binding-empty-path`, `lens-binding-fieldless-owner`, `lens-binding-missing-field`, `lens-binding-not-a-field`, `lens-binding-path-misses`, `lens-binding-undeclared-edge`, `lens-binding-undeclared-kind`, `lens-option`, `lens-role-unbound`, `lifecycle-missing-field`, `lifecycle-never-retires`, `migration-gap`, `migration-not-single-step`, `migration-without-version`, `module-unknown-invariant`, `module-unknown-kind`, `module-unknown-mutation`, `module-unknown-requirement`, `mutation-subject-arg-missing`, `mutation-subject-undeclared`, `mutation-unreachable-by-any-role`, `mutation-untitled`, `node-ref-undeclared`, `page-too-large`, `pages-kind-unknown`, `pages-list-arrangement`, `pages-list-export-not-a-boolean`, `people-ambiguous`, `people-unsaid`, `plot-overlap`, `plural-slug-collision`, `publishing-act-taken`, `publishing-nobody-working`, `publishing-publisher-not-working`, `publishing-unknown-role`, `repair-unknown-mutation`, `repair-wrong-kind`, `setting-name-taken`, `setting-name-unusable`, `setting-not-a-length`, `setting-not-honorable`, `setting-starts-nowhere`, `setting-without-a-choice`, `sight-hides-a-required-field`, `sight-names-an-unknown-field`, `sight-unknown-kind`, `sight-via-misses-people`, `sight-via-unknown-edge`, `theme-contrast-below-aa`, `view-for-undeclared-kind`, `writes-unknown-field`

## 29 warnings

`act-reads-hidden-kind`, `act-without-far-end-reading`, `brand-unnamed`, `describe-template-in-code`, `edge-without-inverse`, `field-without-writer`, `fixed-but-written`, `form-visitor-sees`, `intelligence-decision-prose-door`, `intelligence-key-without-storage`, `intelligence-local-without-bridge`, `intelligence-reach-on-graph`, `kind-without-view`, `kit-color-unreadable`, `lens-column-written-unsaid`, `lens-title-repeated`, `module-edge-leak`, `mutation-title-ambiguous`, `mutation-title-is-an-identifier`, `mutation-undescribed`, `order-role-unknown`, `pages-filter-unknown`, `required-invariant-unregistered`, `role-may-do-nothing`, `rule-says-hidden-fact`, `sight-hides-a-labeled-field`, `sight-hides-required-ref`, `sight-unnamed-kind`, `theme-token-unreadable`

## 10 notes

`blank-graph-has-no-door`, `blank-graph-unreachable`, `brand-hues-crowded`, `glance-unchosen`, `label-unbounded`, `lens-arrangement-unknown`, `lens-authored-here`, `lens-binding-disagrees-with-field-role`, `lens-column-unreached`, `rules-read-the-clock`

---

Every one of the 124 things graview check can tell you, and how loudly.

The page: https://graview.dev/docs/checks.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
