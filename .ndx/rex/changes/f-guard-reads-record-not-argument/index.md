---
id: "880ce0eb-e956-4419-bc1b-367071e90089"
type: "change"
title: "A guard can say the record's own value where an argument has the same name, and graview check says when they collide"
slug: "f-guard-reads-record-not-argument"
intent: "Found building Graview HQ's lease kind (2026-11-08). An act with `writes: [\"holder\", \"expiresAt\"]` and `allowedWhen: \"holder == null or expiresAt < now()\"` judged the call's arguments, not the record, because the bindings shadow the fields, so any caller could take a live lock by passing an old expiresAt. The refusal template likewise names the caller's values (\"held by worker-b\" when worker-a held it). Asked: let a guard and a refusal template say the record's own value unambiguously (for example `$subject.holder`), and have graview check warn when a guard's bare name is both a field of the kind and an argument of the act."
acceptanceCriteria:
  - "A guard can read the record's own value of a field the act also takes as an argument, and a test shows it judging the record, not the call"
  - "A refusal template can name the record's own value the same way (unit test)"
  - "graview check warns, naming the act and the field, when a guard or refusal template reads a bare name that is both a field and an argument of the act"
  - "The rule language docs and the authoring skill that teach guards say which a bare name reads"
touches:
  - "3b647ea3-7070-40ee-b351-5115f42c5d3f"
priority: "high"
tags:
  - "graview"
  - "core"
  - "rules"
  - "hq:feature:f-guard-reads-record-not-argument"
source: "Graview HQ feature:f-guard-reads-record-not-argument, from request:a-guard-s-bare-name-reads-the-call-s-argument-before-the-record-s-field-silently"
---
