# What `graview check` says

`graview check` reads a Graview app's declaration without a browser and reports what is wrong with it, in words. It can say 89 things, read here out of the checker's own source. An **error** should fail your build. A **warning** is a judgment call. A **note** is a question worth answering once.

## 57 errors

`brand-accent-not-a-hue`, `brand-accent-unknown-kind`, `brand-currency`, `brand-locale`, `creates-unknown-kind`, `edge-claim-unknown-kind`, `edge-name-shared`, `edge-target-undeclared`, `field-role-missing-field`, `figure-undrawable`, `figure-unknown-kind`, `fixed-unknown-field`, `glance-unknown-field`, `grant-unknown-kind`, `grant-unknown-mutation`, `intelligence-decision-cannot-call`, `intelligence-reach-unknown`, `intelligence-unknown-mutation`, `invariant-scope-undeclared`, `kit-contrast-below-aa`, `lens-binding-empty`, `lens-binding-empty-path`, `lens-binding-fieldless-owner`, `lens-binding-missing-field`, `lens-binding-not-a-field`, `lens-binding-path-misses`, `lens-binding-undeclared-edge`, `lens-binding-undeclared-kind`, `lens-role-unbound`, `lifecycle-missing-field`, `lifecycle-never-retires`, `migration-gap`, `migration-not-single-step`, `migration-without-version`, `module-unknown-invariant`, `module-unknown-kind`, `module-unknown-mutation`, `module-unknown-requirement`, `mutation-subject-arg-missing`, `mutation-subject-undeclared`, `mutation-unreachable-by-any-role`, `mutation-untitled`, `node-ref-undeclared`, `page-too-large`, `plot-overlap`, `plural-slug-collision`, `repair-unknown-mutation`, `setting-name-taken`, `setting-name-unusable`, `setting-not-a-length`, `setting-not-honorable`, `setting-starts-nowhere`, `setting-without-a-choice`, `sight-unknown-kind`, `theme-contrast-below-aa`, `view-for-undeclared-kind`, `writes-unknown-field`

## 24 warnings

`act-reads-hidden-kind`, `act-without-far-end-reading`, `act-without-title`, `brand-unnamed`, `edge-without-inverse`, `edge-without-severer`, `field-without-writer`, `fixed-but-written`, `intelligence-decision-prose-door`, `intelligence-key-without-storage`, `intelligence-local-without-bridge`, `intelligence-reach-on-graph`, `kind-without-view`, `kit-color-unreadable`, `module-edge-leak`, `mutation-title-ambiguous`, `mutation-title-is-an-identifier`, `mutation-undescribed`, `order-role-unknown`, `required-invariant-unregistered`, `role-may-do-nothing`, `sight-hides-required-ref`, `sight-unnamed-kind`, `theme-token-unreadable`

## 8 notes

`blank-graph-has-no-door`, `blank-graph-unreachable`, `glance-unchosen`, `label-unbounded`, `lens-arrangement-unknown`, `lens-authored-here`, `lens-binding-disagrees-with-field-role`, `lens-column-unreached`

---

Every one of the 89 things graview check can tell you, and how loudly.

The page: https://graview.dev/docs/checks.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
