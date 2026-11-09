---
id: "b7ab8bd2-02dc-4fec-8fec-d31aac1c1ce7"
type: "change"
title: "0.1.71: A visitor is told plainly they are not signed in; an act clears a field with null and its condition says $subject and $arg; a view's faces come from origins of their own and a file the app holds is bounded; a record page with its own layout draws one divider; and acts are offered only where they apply."
slug: "release-0-1-71"
intent: "What 0.1.71 shipped, recorded after the release from its entry in apps/site/releases.json. The work itself was tracked on Graview HQ and in the twelve changes it completed."
acceptanceCriteria:
  - "A visitor is not signed in. When the host hands `signIn`, the account pane says \"Not signed in\" and offers sign-in first, the bar's button says so too, and no seat's id is shown."
  - "An act clears a field. A literal `null` in a document act's `set` removes an optional field's value; on a required field `graview check` warns (`act-clears-required`)."
  - "An act's condition says which value it means. `$subject.<field>` is the record's own value and `$arg.<name>` the call's argument; inside `where`, `every` and the rest, a member's own field comes first. `graview check` warns where a bare name means both (`act-name-means-both`) and where `$arg` means nothing (`act-arg-unknown`, `arg-outside-act`)."
  - "A view's faces have origins of their own. A host lists them in `fonts: { origins }`; `images.origins` is for images only. A file the app holds may be at most 2 MB as a face, and when two faces share a name the one lent last draws."
  - "A record page with its own layout draws one divider and no empty band before its facts, and a view that throws in its slot is caught there, in words, while the page stays."
  - "A bleeding view on a phone keeps each safe area on its own side in a right-to-left page."
  - "Acts are offered only where they apply. The several bar acts on the chosen records an act applies to and says how many; an act done as you is not offered to a seat that cannot see its own person; a link that is not there is refused in words."
  - "A workflow's far step says the host's own refusal (`otherApp` may answer `{ refused }`), and other ways to show a list at a filtered address offer only what that address would draw."
  - "Security and reliability fixes."
shippedIn: "0.1.71"
tags:
  - "release"
  - "0.1.71"
source: "apps/site/releases.json"
---
