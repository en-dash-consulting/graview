# What a screen reader is told

Written by `scripts/verify-screen-reader.mjs` from the accessibility tree Chromium exposes (CDP `Accessibility.getFullAXTree`), read in document order the way a screen reader moves through a page: each line is what it would say at that point, as *name, role, state*. Lists are cut to their first few items. **Focus after** is where the keyboard is after the act or navigation, and **Heard** is what the live regions said, as a reader announces it without moving.

No system screen reader was turned on to write this. `scripts/voiceover-walk.mjs` listens to the same stops with real VoiceOver in Safari, when somebody chooses to.

Claims: 52 of 52 hold. The verdict is `docs/screen-reader.json`.

## Roadmap: The bar

The Roadmap's home, as Ada. The bar is the first thing in the app's region.

**Read in order**

```text
A Roadmap, sectionheader
  A Roadmap, heading level 1
    A Roadmap, link
  Scene or Pages, group
    Scene, button, not pressed
    Pages, button, pressed
  A Roadmap · The app’s places, navigation landmark
    Home, link
    Areas, link
    Features, link
    Requests, link
    People, link
    Releases, link
    More — 7 more places, button, collapsed
  A Roadmap · Find anything, search landmark
    Find anything, search text
  Everything is in order, button, collapsed, dimmed
  Ada Lovelace — you, your seat and your settings, button, collapsed
```

**The Tab key reaches, in order**

```text
A Roadmap, link
Scene, button, not pressed
Pages, button, pressed
Home, link
Areas, link
Features, link
Requests, link
People, link
Releases, link
More — 7 more places, button, collapsed
```

## Roadmap: The Pages and Scene switch

Pressed from the keyboard: Scene, then Pages again.

**The switch**

```text
Scene or Pages, group
  Scene, button, not pressed
  Pages, button, pressed
```

**Focus after pressing Scene**

```text
Scene, button, pressed
```

**The scene, under the bar (lists cut to two items)**

```text
A Roadmap, region landmark
  (no name), status
  (no name), alert
  areas, group
    AREAS
    14
    See the areas in here, button, collapsed
  briefs, group
    BRIEFS
    20
    See the briefs in here, button, collapsed
  features, group
    FEATURES
    146
    See the features in here, button, collapsed
    19 considering, 19 planned, 18 building, 90 shipped, image
    features: pictures, group
      features: Roadmap, button, not pressed
      features: Up next, button, not pressed
  people, group
    PEOPLE
    18
    See the people in here, button, collapsed
  releases, group
    RELEASES
    28
    See the releases in here, button, collapsed
    2 draft, 26 published, image
    releases: pictures, group
      releases: What each release touched, button, not pressed
      releases: Release calendar, button, not pressed
  requests, group
    REQUESTS
    60
    See the requests in here, button, collapsed
    21 open, 13 accepted, 14 declined, 12 done, image
    requests: pictures, group
      requests: Triage, button, not pressed
  Zoom, group
    Zoom out, button
```

**Focus after pressing Pages**

```text
Pages, button, pressed
```

## Roadmap: A list

Features, reached from the bar's places by the keyboard.

**Focus after following the Features link**

```text
Features, heading level 2
```

**Read in order (each list to its first three)**

```text
A Roadmap, region landmark
  (no name), status
  (no name), alert
  A Roadmap, sectionheader
    Features, heading level 2
    A capability: considered, planned, being built, or shipped.
    Related:
    The part it lives in, link
    What has to ship first, link
    Its other half in the other layer, link
    The requests behind it, link
    The release it shipped in, link
    The briefs about it, link
    Also as:
    Roadmap, link
    Up next, link
  Arrange, group
    146 features
    Sorted by name, a to z, button, collapsed
    Group, button, collapsed
    Filter, button, collapsed
    Stage, group
      Stage: Considering, 19, button, not pressed
      Stage: Planned, 19, button, not pressed
      Stage: Building, 18, button, not pressed
      Stage: Shipped, 90, button, not pressed
    Layer, group
      Layer: Framework, 113, button, not pressed
      Layer: Cloud, 33, button, not pressed
  Features, group
    A Roadmap · Jump to, navigation landmark
      B, link
      C, link
      E, link
      F, link
      H, link
      I, link
      L, link
      O, link
      R, link
      S, link
      T, link
      U, link
    B, region landmark
      B, heading level 2
      list, 7 items
        Choose Billing across apps, checkbox, not checked
        Billing across apps, link
        Building · Cloud
        Choose Billing at scale, checkbox, not checked
        Billing at scale, link
        Planned · Framework
        Choose Billing for strangers, checkbox, not checked
        Billing for strangers, link
        Shipped · Framework
        … and 4 more
    C, region landmark
      C, heading level 2
      list, 22 items
        Choose Calendar across apps, checkbox, not checked
        Calendar across apps, link
        Planned · Framework
        Choose Calendar at scale, checkbox, not checked
        Calendar at scale, link
        Considering · Cloud
        Choose Calendar for strangers, checkbox, not checked
        Calendar for strangers, link
        Shipped · Cloud
        … and 19 more
    E, region landmark
      E, heading level 2
      list, 8 items
        Choose Export across apps, checkbox, not checked
        Export across apps, link
        Considering · Cloud
        Choose Export at scale, checkbox, not checked
        Export at scale, link
        Building · Framework
        Choose Export for strangers, checkbox, not checked
        Export for strangers, link
        Shipped · Framework
        … and 5 more
    F, region landmark
      F, heading level 2
      list, 22 items
        Choose Files across apps, checkbox, not checked
        Files across apps, link
        Planned · Framework
        Choose Files at scale, checkbox, not checked
        Files at scale, link
        Considering · Framework
        Choose Files for strangers, checkbox, not checked
        Files for strangers, link
        Shipped · Framework
        … and 19 more
    H, region landmark
      H, heading level 2
      list, 7 items
        Choose History across apps, checkbox, not checked
        History across apps, link
        Building · Framework
        Choose History at scale, checkbox, not checked
        History at scale, link
        Planned · Framework
        Choose History for strangers, checkbox, not checked
        History for strangers, link
        Shipped · Framework
        … and 4 more
    I, region landmark
      I, heading level 2
      list, 15 items
        Choose Import across apps, checkbox, not checked
        Import across apps, link
        Building · Cloud
        Choose Import at scale, checkbox, not checked
        Import at scale, link
        Planned · Cloud
        Choose Import for strangers, checkbox, not checked
        Import for strangers, link
        Shipped · Cloud
        … and 12 more
    L, region landmark
      L, heading level 2
      list, 7 items
        Choose Lenses across apps, checkbox, not checked
        Lenses across apps, link
        Building · Framework
        Choose Lenses at scale, checkbox, not checked
        Lenses at scale, link
        Planned · Framework
        Choose Lenses for strangers, checkbox, not checked
        Lenses for strangers, link
        Shipped · Cloud
        … and 4 more
    O, region landmark
      O, heading level 2
      list, 7 items
        Choose Offline across apps, checkbox, not checked
        Offline across apps, link
        Planned · Framework
        Choose Offline at scale, checkbox, not checked
        Offline at scale, link
        Considering · Framework
        Choose Offline for strangers, checkbox, not checked
        Offline for strangers, link
        Shipped · Framework
        … and 4 more
    R, region landmark
      R, heading level 2
      list, 14 items
        Choose Roles across apps, checkbox, not checked
        Roles across apps, link
        Planned · Cloud
        Choose Roles at scale, checkbox, not checked
        Roles at scale, link
        Considering · Cloud
        Choose Roles for strangers, checkbox, not checked
        Roles for strangers, link
        Shipped · Framework
        … and 11 more
    S, region landmark
      S, heading level 2
      list, 22 items
        Choose Search across apps, checkbox, not checked
        Search across apps, link
        Considering · Framework
        Choose Search at scale, checkbox, not checked
        Search at scale, link
        Building · Framework
        Choose Search for strangers, checkbox, not checked
        Search for strangers, link
        Shipped · Framework
        … and 19 more
    T, region landmark
      T, heading level 2
      list, 7 items
        Choose Themes across apps, checkbox, not checked
        Themes across apps, link
        Building · Cloud
        Choose Themes at scale, checkbox, not checked
        Themes at scale, link
        Planned · Cloud
        Choose Themes for strangers, checkbox, not checked
        Themes for strangers, link
        Shipped · Cloud
        … and 4 more
    U, region landmark
      U, heading level 2
      list, 8 items
        Choose Undo across apps, checkbox, not checked
        Undo across apps, link
        Building · Framework
        Choose Undo at scale, checkbox, not checked
        Undo at scale, link
        Planned · Framework
        Choose Undo for strangers, checkbox, not checked
        Undo for strangers, link
        Shipped · Framework
        … and 5 more
  Add a feature, button, collapsed
```

## Roadmap: A record page

The first feature, opened from the list by the keyboard.

**Focus after opening “Billing across apps”**

```text
Billing across apps, heading level 2
```

**Read in order**

```text
A Roadmap, region landmark
  (no name), status
  (no name), alert
  A Roadmap, sectionheader
    FEATURES, link
    Billing across apps, heading level 2
    building
    In the scene, link
    Seen in:
    Roadmap, link
    Roadmap, in the scene, link
    Up next, link
    Up next, in the scene, link
  The facts, heading level 2
  NAME
  Name: Billing across apps, button
  STAGE
  Stage: Building, button
  LAYER
  Layer: Cloud, button
  AREAS
  The part it lives in, heading level 2
  list, 1 item
    embed, link
  BRIEFS
  The briefs about it, heading level 2
  list, 1 item
    Brief 10, link
  Sort and filter the briefs about it, link
  What can be done, heading level 2
  Change the feature, button, collapsed
  Show 4 more, button, collapsed
```

## Roadmap: An act's form

“Change the feature” on the record page: opened, put away with Escape, opened again and sent.

**Focus after opening the form**

```text
Name, edit text
```

**The form, read in order**

```text
Name
Name, edit text
Stage
Stage, —, pop-up button, collapsed
  (no name), MenuListPopup
    —, option
    Considering, option
    Planned, option
    Building, option
    Shipped, option
Layer
Layer, —, pop-up button, collapsed
  (no name), MenuListPopup
    —, option
    Framework, option
    Cloud, option
    Both, option
Summary
Summary, edit text
Change the feature, button
```

**Focus after Escape**

```text
Change the feature, button, collapsed
```

**Focus after sending it**

```text
Change the feature, button, collapsed
```

**Heard: after sending it**

```text
(polite) Take back “Change Billing across apps: summary → " Said aloud."”
```

## Roadmap: A columns lens

The Roadmap board: features in columns by stage, reached from the home by the keyboard; a card moved with its Move… menu.

**Focus after following the Roadmap link**

```text
Roadmap, heading level 2
```

**Read in order (each column to its first two cards)**

```text
A Roadmap, region landmark
  (no name), status
  (no name), alert
  (no name), status
  A Roadmap, sectionheader
    Roadmap, heading level 2
    146 features
    .
    All features as a list, link
  Roadmap, group
    (no name), status
    A Roadmap · Features by stage, region landmark
      Roadmap · Considering, 19, region landmark
        Considering 19, heading level 3
        list, 19 items
          Themes without a build, link
          Considering
          Framework
          Choose Themes without a build, checkbox, not checked
          Move “Themes without a build” to another column, button, collapsed
          Charts without a build, link
          Considering
          Framework
          Choose Charts without a build, checkbox, not checked
          Move “Charts without a build” to another column, button, collapsed
          … and 17 more
      Roadmap · Planned, 19, region landmark
        Planned 19, heading level 3
        list, 19 items
          Forms without a build, link
          Planned
          Framework
          Choose Forms without a build, checkbox, not checked
          Move “Forms without a build” to another column, button, collapsed
          Comments without a build, link
          Planned
          Cloud
          Choose Comments without a build, checkbox, not checked
          Move “Comments without a build” to another column, button, collapsed
          … and 17 more
      Roadmap · Building, 18, region landmark
        Building 18, heading level 3
        list, 18 items
          Rules without a build, link
          Building
          Framework
          Choose Rules without a build, checkbox, not checked
          Move “Rules without a build” to another column, button, collapsed
          Files without a build, link
          Building
          Framework
          Choose Files without a build, checkbox, not checked
          Move “Files without a build” to another column, button, collapsed
          … and 16 more
      Roadmap · Shipped, 90, region landmark
        Shipped 90, heading level 3
        list, 90 items
          Filters that stay usable, link
          Shipped
          Framework
          Choose Filters that stay usable, checkbox, not checked
          Move “Filters that stay usable” to another column, button, collapsed
          Undo that stay usable, link
          Shipped
          Cloud
          Choose Undo that stay usable, checkbox, not checked
          Move “Undo that stay usable” to another column, button, collapsed
          … and 88 more
  Add a feature, heading level 2
  Put a feature on the roadmap.
  Name
  Name, edit text, required
  Stage
  Stage, —, pop-up button, collapsed
    (no name), MenuListPopup
      —, option
      Considering, option
      Planned, option
      Building, option
      Shipped, option
  Layer
  Layer, —, pop-up button, collapsed
    (no name), MenuListPopup
      —, option
      Framework, option
      Cloud, option
      Both, option
  Summary
  Summary, edit text
  Add a feature, button
```

**Focus after opening “Themes without a build”'s Move… menu**

```text
Planned, menuitem
```

**Focus after choosing a column**

```text
Move “Themes without a build” to another column, button, collapsed
```

**Heard: after the move**

```text
(polite) Moved “Themes without a build” to Planned.Undo
(polite) Take back “Change Themes without a build: stage → "planned"”
```

## Roadmap: A blocks lens

“Up next”: a headline and a list of cards, reached from the home by the keyboard.

**Focus after following the Up next link**

```text
Up next, heading level 2
```

**Read in order**

```text
A Roadmap, region landmark
  (no name), status
  (no name), alert
  (no name), status
  A Roadmap, sectionheader
    Up next, heading level 2
    146 features
    .
    All features as a list, link
  Being built, heading level 3
  list, 4 items
    Rules without a build, link
    Building
    Framework
    Files without a build, link
    Building
    Framework
    Invites without a build, link
    Building
    Framework
    … and 1 more
  14 more · all features, link
  Add a feature, heading level 2
  Put a feature on the roadmap.
  Name
  Name, edit text, required
  Stage
  Stage, —, pop-up button, collapsed
    (no name), MenuListPopup
      —, option
      Considering, option
      Planned, option
      Building, option
      Shipped, option
  Layer
  Layer, —, pop-up button, collapsed
    (no name), MenuListPopup
      —, option
      Framework, option
      Cloud, option
      Both, option
  Summary
  Summary, edit text
  Add a feature, button
```

## Roadmap: The Ask box

The seat's box at the foot of the page, asked a question with no model lent.

**Read in order**

```text
A Roadmap · Ask A Roadmap, region landmark
  Ask A Roadmap, heading level 2
  Ask A Roadmap, edit text
```

**Focus after asking**

```text
Ask A Roadmap, edit text
```

**Heard: after asking**

```text
(polite) I can answer about what's in this app. Open questions need AI, which isn't on here.
```

**The seat after the question**

```text
A Roadmap · Ask A Roadmap, region landmark
  Ask A Roadmap, heading level 2
  Move to the right, button
  Close Ask A Roadmap, button
  list, 2 items
    How many features are being built?
    I can answer about what's in this app. Open questions need AI, which isn't on here.
  I can answer about what's in this app. Open questions need AI, which isn't on here.
  Ask A Roadmap, edit text
```

## Roadmap: A change from someone else

Ada is on a feature's page, her keyboard on one of its facts; Ben, in another tab sharing the store, changes its stage.

**Heard: on Ada's page when Ben changed the stage**

```text
(polite) Ben Okafor: Change Billing across apps: stage → "considering"
```

**Focus after Ben's change (Ada's keyboard was on a fact)**

```text
Name: Billing across apps, button
```

## Things (todo): The bar

The todo example's routed face, standalone: its own banner, main and footer.

**Read in order**

```text
(no name), banner landmark
  Things, heading level 1
    Things, link
  Scene or Pages, group
    Scene, button, not pressed
    Pages, button, pressed
  The app’s places, navigation landmark
    Home, link
    Lists, link
    Tasks, link
    The month, link
    The week, link
    More — 8 more places, button, collapsed
  Find anything, search landmark
    Find anything, search text
  2 rules broken — open what is broken, and what would fix it, link
  Nora — you, your seat and your settings, button, collapsed
(no name), sectionheader
  SEP 1, 2026
  1 thing is late., heading level 1
  10
  open across
  3
  lists.
(no name), sectionheader
  Late, heading level 2
  1
(no name), sectionheader
  Today, heading level 2
  1
(no name), sectionheader
  Coming up, heading level 2
  5
```

**Landmarks**

```text
(no name), banner landmark
The app’s places, navigation landmark
Find anything, search landmark
(no name), main landmark
(no name), contentinfo landmark
Ask Things, region landmark
```

## Things (todo): A list

Tasks, from the bar's places by the keyboard.

**Focus after following the Tasks link**

```text
Tasks, heading level 2
```

**Read in order (each list to its first three)**

```text
(no name), main landmark
  (no name), sectionheader
    Tasks, heading level 2
    One thing to do.
    Related:
    The list it is on, link
    What has to happen first, link
    Why this is here, link
    Also as:
    What is left, link
    The month, link
    The week, link
  Arrange, group
    10 of 12
    tasks
    Finished: no
    Remove: Finished: no, button
    Sorted by name, a to z, button, collapsed
    Grouped by the list it is on, button, collapsed
    Filter — 1 on, button, collapsed
    Day, group
      Day: Tue, 2, button, not pressed
      Day: Wed, 1, button, not pressed
      Day: Thu, 3, button, not pressed
      Day: Fri, 1, button, not pressed
  Tasks, group
    Someday 3, heading level 2
    list, 3 items
      Choose Find someone who moves pianos, checkbox, not checked
      Finish Find someone who moves pianos, button, not pressed
      Find someone who moves pianos, link
      Breaks a rule, image
      Choose Take down the shelves, checkbox, not checked
      Finish Take down the shelves, button, not pressed
      Take down the shelves, link
      Choose Touch up the paint, checkbox, not checked
      Finish Touch up the paint, button, not pressed
      Touch up the paint, link
    This week 5, heading level 2
    list, 5 items
      Choose Give notice on the flat, checkbox, not checked
      Finish Give notice on the flat, button, not pressed
      Give notice on the flat, link
      Sep 2
      Choose Hand back the keys, checkbox, not checked
      Finish Hand back the keys, button, not pressed
      Hand back the keys, link
      Sep 5
      Choose Move the broadband, checkbox, not checked
      Finish Move the broadband, button, not pressed
      Move the broadband, link
      Sep 4
      … and 2 more
    Today 2, heading level 2
    list, 2 items
      Choose Book the van, checkbox, not checked
      Finish Book the van, button, not pressed
      Book the van, link
      Sep 1
      Choose Pay the deposit, checkbox, not checked
      Finish Pay the deposit, button, not pressed
      Pay the deposit, link
      Breaks a rule, image
      Aug 28
  Add a task, button, collapsed
```

## Things (todo): A record page

“Pay the deposit”, which is late, opened from the list.

**Focus after opening it**

```text
Pay the deposit, heading level 1
```

**Read in order**

```text
(no name), main landmark
  (no name), sectionheader
    TASKS, link
    Pay the deposit, heading level 1
      Pay the deposit, button
    In the scene, link
  "Pay the deposit" was due Aug 28, 2026
  Give it a new date …, button, collapsed
  Finish it, button
  (no name), sectionheader
    The facts, heading level 2
    Change one where you can.
  FINISHED
  Finished: No, button
  DUE
  Due: Aug 28, 2026, button
  DAY
  Day: Tue, button
  BLOCKED
  Blocked: 09:00, button
  UNTIL
  Until: 09:15, button
  (no name), sectionheader
    The list it is on, heading level 2
  list, 1 item
    Today, link
  (no name), sectionheader
    Why this is here, heading level 2
  list, 1 item
    The landlord holds the date for 48 hours once the deposit…, link
  (no name), sectionheader
    What can be done, heading level 2
  Give it a new date …, button, collapsed
  Finish it, button, collapsed
  Note why this is here …, button, collapsed
  Move it to another list …, button, collapsed
  Rename …, button, collapsed
  This has to happen first …, button, collapsed
  Change the task …, button, collapsed
  Block time for it …, button, collapsed
  Show 4 more, button, collapsed
```

## Things (todo): An act's form

“Rename …” on the record page: opened, sent, and the keyboard after.

**Focus after opening it**

```text
Name, edit text, required
```

**The form, read in order**

```text
Name
Name, edit text, required
Rename, button
```

**Focus after sending it**

```text
Rename …, button, collapsed
```

**Heard: after sending it**

```text
(polite) Take back “Rename to "Pay the deposit today"”
```

## Things (todo): The Ask box

The seat at the page's foot, asked what is late.

**Focus after asking**

```text
Ask Things, edit text
```

**Heard: after asking**

```text
(polite) Went to the overdue tasks. One task is overdue: Pay the deposit today.
(polite) Take back “Rename to "Pay the deposit today"”
```
