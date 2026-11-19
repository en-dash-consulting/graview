---
id: "2c102f15-09f2-43d8-be6b-35694ff61bac"
type: "change"
title: "0.2.7: An owner can merge a member's own record into the person entered for them, an act can ask for a record that may be left out, and a picture or video offers its download."
slug: "release-0-2-7"
intent: "What 0.2.7 shipped, recorded after the release from its entry in apps/site/releases.json. The work was tracked on Graview HQ and in the changes of the same names: f-merge-own-record-into-person and f-rebind-follow-ups (#649), f-optional-record-input-in-create, f-frame-form-grouped-by-kind, f-authoring-schemas-args-workflows and f-download-control-video-picture (#648), f-dependency-security-gate (#652), and the guest harness on the verify runner (#653, feature:f-guest-holds-on-verify-runner on HQ); batch #654. f-one-face-holds-at-slow-4 (#650) was not in it."
acceptanceCriteria:
  - "**A member's own record merges into the person entered for them**: `mergePerson` from the host's own seat, one undoable change; `bindPerson`'s refusal names the merge."
  - "**The binding acts are the host's alone**: their author is minted by `hostSeat({ id, name })`."
  - "**A move covers an ended binding** and the links made as themselves."
  - "**An act may ask for a record that can be left out**, offered as a picker; a form view stands beside its kind's list."
  - "**A video and a full-size picture offer a Download link.**"
  - "The schema and the skills say an act's `args` and a workflow's triggers."
  - "Security fixes in what the packages depend on: zod `^4.6.7`, and a dependency check on pull requests and releases."
shippedIn: "0.2.7"
source: "apps/site/releases.json"
tags:
  - "release"
  - "0.2.7"
---
