---
id: "04830254-bdf1-4882-875a-9be6db061135"
type: "capability"
title: "Describe a place without a browser: describePlace for a chat to check its own work (FR-89)"
slug: "describe-a-place-without-a-browser"
statement: "describePlace gives a chat a structured and plain-text account of what a named place (home, a lens, or a record page) shows a given viewer at a given width, so the chat can check what it built without a browser."
criteria: [{"id":"c1","text":"When called with a store, a principal, a place and a width, describePlace shall return what the named place (home, a lens or a record page) shows that viewer, including headings, figures, lists with their items, and problems, as both structured data and plain text."},{"id":"c2","text":"When describePlace describes a place for a viewer, it shall apply sight, so that the description contains only what that viewer may see."},{"id":"c3","text":"When describePlace describes the LifeLogics front page or any of its four lenses at phone width, it shall produce a description in words that match what draws."}]
tags:
  - "graview-cloud"
  - "FR-89"
  - "chat-authored"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.9: chat-authored interfaces, ADR 0007)"
priority: "high"
---

A chat building interfaces from a phone needs to check what it made without a browser.
