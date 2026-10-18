---
id: "3fc72b36-85b5-4006-a7d9-d52d10e25700"
level: "task"
title: "0.1.34 · FR-183: A reader who may do nothing is told how to get in"
status: "completed"
startedAt: "2026-10-18T05:50:00.000Z"
completedAt: "2026-10-18T06:30:00.000Z"
priority: "high"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.34"
source: "ndx-capture"
acceptanceCriteria:
  - "a host can say what a seat could gain (mount({ signIn: { label, run } }) or equivalent); a visitor whose every withheld act a member could take sees that one line in the context menu, the Inspector and Pages list foot instead of struck acts"
  - "a member lacking one role still sees the struck list with the reason (FR-16 unchanged)"
  - "canBeTold is false for a principal the host marks as a visitor, so Notify me is not offered"
description: "Roadmap f-withheld-for-visitors (FR-183, priority next). A signed-out visitor on a public app sees every act struck through with the policy sentence, and Notify me offered to anonymous. Cloud carries INTERIM(FR-183) in packages/client/src/shell.ts (visitorMenuSections) until this ships."
lastModified: "2026-10-18T03:00:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Notes

Decided: the host's word is `signIn?: SignIn` (`{ label, run, roles? }`, exported from `@graview/core` with `signInInstead(withheld, signIn)`), handed only while the reader is a visitor — its presence is the mark, so there is no second "visitor" flag. It lives on `GraviewProvider` (a provider inside another takes the one around it, so the Shell and the pages drawn under the embed's provider read it), on the pages' `PageContext` (the router hands it to the provider under the pages, and a list's foot or a record's acts read it with no provider), and on the embed's `FrameOptions` (`providerProps` for the scene and `@graview/embed/pages`, the pages' context in `pages-content.tsx`). Chosen over `withheldFor?: (refusal) => …` because the sign-in is one fact about the seat, not per refusal, and `canBeTold` needs it without any refusal in hand. The line stands in for the struck acts only where every withheld act is one some role could take (`wouldNeed` non-empty), or one of `roles` when the host names what signing in gives; otherwise the struck list stands (FR-16). Where it stands in, the Inspector (both the rail and the pointer menu, on either face) draws one `data-testid="sign-in"` button that closes the menu and calls `run`, and neither the "Nothing you may do … withheld" sentence nor the struck list; the face's own rows (Open, Show in the scene) are untouched. `canBeTold(principal, signIn)` is false with `signIn` given, so the menu's Notify me, the record page's and after-an-act `NotifyButton` are not drawn, and the chat seat is handed no subscriptions for a visitor. The list's foot and a record's acts share `WithheldActs` (`packages/pages/src/withheld-acts.tsx`). The hosted page grew ~0.2 KB up front: raises in `scripts/budget-raises/a-visitor-is-told-how-to-get-in-hosted-{page,compiled}.json`. The graview-embed skill and the embed README say the option; `capabilities().shipped` gains FR-183.

Tests, each watched failing first (the Inspector and embed ones by reverting the source files and rerunning): `packages/core/tests/unit/a-visitor-is-offered-the-way-in-instead-of-struck-acts.test.ts` (5, failed: no export), `packages/pages/tests/unit/a-visitor-is-told-how-to-get-in.test.tsx` (5; the three visitor claims failed, the two controls — a proofreader lacking one role, a visitor with no `signIn` — held before and after), `packages/primitives/tests/unit/a-visitor-is-shown-the-way-in-not-struck-acts.test.tsx` (2; the way-in claim failed), `packages/embed/tests/unit/a-host-offers-a-visitor-the-way-in.test.tsx` (2, both failed without the embed threading).

Harnesses (GRAVIEW_PORT_BASE=5700, --quick): menu passed (18 checks, none failing), notify passed (6), who passed (12), hosted holds its budget (557 KB up front, 193 KB gzipped). No harness drives a signed-out seat yet; Walkthrough XI should right-click as a visitor on a view-link app.
