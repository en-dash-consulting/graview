---
id: "6108c269-4156-4d3f-a6a4-aed173e8b966"
type: "change"
title: "People talk to each other inside an app: rooms declared, messages as records, a room's page and a record's thread on the one face"
slug: "f-chat-rooms"
intent: "From HQ feature:f-chat-rooms (Nick, 2026-11-26): a chat room construct any app can offer, so the people in an app can talk to each other inside it. A declaration says its rooms beside its kinds (one for the whole app, or a thread on each record of a kind, with the roles that read, post and moderate); what is said is a record of the framework's message kind, made, edited and removed by derived acts, so sight, roles, history, undo and the agent's tools hold of it; mentions tell the person named through the subscriptions' hook and what is unread waits on the bell; the routed face, the one face and the embed draw a room's page and a record's thread, at a desk, on a phone and from the keyboard. Delivery by email or push, plan limits and turning it on per app are Graview Cloud's."
acceptanceCriteria:
  - "defineApp and a compiled document fold a room's message kind, post-message, edit-message and remove-message, and their grant and sights into an app with rooms, and toDocument gives the declaration back without them (unit test)"
  - "graview check names a thread on a kind the app lacks, a role the policy does not know, a title taken twice, and a message kind or room act of the app's own (unit test)"
  - "A room that reads only some roles, and a thread on a record a seat may not see, are not served to that seat, its log included (unit test, harness aSeatWithoutSightSeesNone)"
  - "Only a message's author edits it; its author or a moderating role removes it, and undo puts it back (unit test, harness editAndRemoveOwn)"
  - "A mention tells the person it names, as they may see it, never of their own message (unit test, harness aMentionReachesTheirNotices)"
  - "Two seats in two browsers on one served store each see the other's message live, in a room and on a record's thread (harness twoSeatsSeeEachOtherLive, aThreadOnARecord)"
  - "What a person has not read is counted on the bell until they read the room (harness unreadCounts)"
  - "A room and a thread work at phone width and from the keyboard alone: a log region, a labeled composer, Enter to send and Shift+Enter for a newline (harness aPhone, keyboardOnly)"
  - "Messages stand on no list, district, home or Activity row and in no static export (unit tests)"
priority: "high"
tags:
  - "rooms"
  - "hq:feature:f-chat-rooms"
source: "Graview HQ feature:f-chat-rooms"
---
