---
id: "d699930d-5fb5-49c1-82a6-a07dd9ed3007"
type: "capability"
title: "A rule's refusal says so: reason refused, not invalid (FR-119)"
slug: "a-rule-s-refusal-says-so-reason"
statement: "When a rule or a declared act's own logic says no, the product refuses with reason \"refused\" (or \"guard\"), keeping \"invalid\" for wrongly sent arguments and for nothing to change, so a host can tell the two apart."
criteria: [{"id":"c1","text":"When an allowedWhen rule refuses an act, the product shall return an ActRefusal whose reason is \"refused\" (or \"guard\") rather than \"invalid\"."},{"id":"c2","text":"When a declared act's own logic refuses, the product shall return an ActRefusal whose reason is \"refused\" (or \"guard\") rather than \"invalid\"."},{"id":"c3","text":"When an act is refused because its arguments are wrong or because there is nothing to change, the product shall return an ActRefusal with reason \"invalid\"."},{"id":"c4","text":"The refusalOf function shall read the reason carried by a refusal."},{"id":"c5","text":"When resolve-question is applied to an already resolved question, the product shall refuse it with reason \"refused\"."},{"id":"c6","text":"When edit-person is applied with only an id, the product shall refuse it with reason \"invalid\"."}]
tags:
  - "graview-cloud"
  - "FR-119"
  - "chat-authored"
source: "Graview Cloud, 2026-10-07 (brief after 0.1.14)"
priority: "high"
resolution: "Shipped in #123 (0.1.15): REFUSAL_REASONS gains refused; a document act's allowedWhen and ActRefusal's default say it; invalid stays for the call as sent; agent tools, the MCP adapter and graview mcp say reason beside error."
---

ActRefusal's reason defaults to invalid, so a host can't tell 'the rules say no' from 'you sent the wrong thing'.
