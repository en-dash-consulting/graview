---
id: "90b438f3-5664-45a5-9902-564a6b0b011c"
type: "capability"
title: "A document names the kind that stands for its people, and a record's id is a member's principal"
slug: "a-document-names-the-kind-that-stands"
statement: "A Graview document declares which kind stands for its people, and a seat whose principal id is a record of that kind is treated as that person."
criteria: [{"id":"c1","text":"When a document declares its people kind, the compiler and checker shall accept it as the kind that stands for the app's people."},{"id":"c2","text":"If a document's people kind is missing or ambiguous, the compiler and checker shall refuse the document."},{"id":"c3","text":"When a seat's principal id is a record of the people kind, the document shall treat the seat as that person."},{"id":"c4","text":"While a seat is a person of the people kind, self grants and own sights shall hold in a document as they do in TypeScript."},{"id":"c5","text":"describeApp shall say which kind is people."},{"id":"c6","text":"The JSON Schema shall say which kind is people."}]
tags:
  - "roadmap"
  - "f-people-kind"
source: "Graview Roadmap: f-people-kind"
priority: "high"
resolution: "Shipped in #234: `people: true` on one kind (document, defineNode, the installation's user); describeApp and the kind's JSON Schema say it; check says people-ambiguous and people-unsaid."
---

An installation's TypeScript can say which kind is its users; a document cannot, so self grants and own sights do not work in a Cloud app. Cloud's half (f-member-records) creates a record per member under their principal id.
