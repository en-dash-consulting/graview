---
id: "a13b08b1-d9b4-4d09-9f9a-65ed40a562ca"
type: "change"
title: "0.1.62: Calendar events invite the people they are about, a view links to the Scene, formulas build words and times, an act carries a change across a link, a rule covers every record, and the seat proposes a change to the app."
slug: "release-0-1-62"
intent: "What 0.1.62 shipped, recorded after the release from its entry in apps/site/releases.json. The work itself was tracked on the Graview Roadmap app."
acceptanceCriteria:
  - "Calendar guests. A Google connection's `guests` maps the people an event is about to its attendees both ways: a field of addresses, or `{ via: \"who\" }` through a relation to people with Invite me on. Quiet by default (`notify` sends invitations); an unknown attendee is kept, never dropped."
  - "Views. A view links to the Scene and the home (`data-place=\"overview\"`, `graview.navigate`), read from one vocabulary the live host and the headless check share; a worker view's draw budget fits the device it runs on; `brand.views` gives every view one stylesheet and a fade between records; `<graview-video autoplay cover>` is a muted, looping hero background."
  - "Rules and acts. `concat`, `format`, `datetime`, `addMinutes`, `weekday` and `startOfWeek` build words and moments in the app's locale and zone; `setsLinked` carries a change to the records an act's subject is linked to, in one undo; a rule's `covers` judges that each record reaches every one of another kind without a cost warning; a date that knows only its year or month is compared by its span and drawn across its month."
  - "Pages and notices. A notice carries its tone as a chip, not a side accent, and the framework's own error toasts offer a host's Report this (`onReport`); a home's Recently leaves out what the reader cannot see; `brand.splash` puts the app's opening screen in its declaration, drawn by `@graview/pages/splash` and `graview preview`."
  - "The seat and tidying. For an owner or editor with a host to apply it, the seat proposes a change to the app from words, as a card of what it adds, keeps and drops; a suggestion pressed by someone who may not make it records their vote, and whoever may decide sees the tally."
shippedIn: "0.1.62"
tags:
  - "backfill"
  - "0.1.62"
source: "apps/site/releases.json"
---
