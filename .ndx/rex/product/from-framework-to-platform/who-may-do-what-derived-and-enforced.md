---
id: "fff3406f-43fe-40aa-8f99-10d45423f4f1"
type: "capability"
title: "Who may do what, derived and enforced"
slug: "who-may-do-what-derived-and-enforced"
statement: "Graview derives who may do what from a declared principal, roles and per-kind mutation rules, enforces it at the store, and narrows the interface and the agent tool surface to the same permitted set."
criteria: [{"id":"c1","text":"The store shall carry the principal and its roles as part of its context, independent of any UI."},{"id":"c2","text":"If the principal may not run a mutation, the store shall refuse it."},{"id":"c3","text":"When the tool runtime runs a mutation, the tool runtime shall apply the store's refusal without a check of its own."},{"id":"c4","text":"Derived affordances shall narrow to the mutations the principal may run, without per-app filtering code."},{"id":"c5","text":"When an action is withheld by permission, the interface shall state that it is withheld and name what would be needed to run it, rather than hide it."},{"id":"c6","text":"The generated agent tool schema for a seat shall contain only the mutations that seat is permitted to run."},{"id":"c7","text":"When graview check finds a mutation that no role can ever run, graview check shall report it."},{"id":"c8","text":"When graview check finds a role with no mutations, graview check shall report it."}]
priority: "critical"
---

This fits the grain unusually well, which is why it is worth doing properly rather than bolting on.

Mutations already declare the kinds they act on. What can be done is already DERIVED rather than authored. So a permission model is another input to that derivation: a principal, some roles, and rules saying which mutations a role may run against which kinds — after which the interface hides what you cannot do for free, and an agent's generated tool surface narrows to the same set without anyone maintaining a second list.

TWO THINGS THAT MUST NOT BE GOT WRONG:

Enforcement belongs at the STORE, not in the interface. The tool runtime calls the same mutations a person does, so a check that lives in a React component is not a permission system, it is a suggestion — and the agent seat is the bypass.

An action you may not take should SAY SO rather than vanish. The framework already treats an empty action list as a result and explains it; "you cannot do this, and here is who can" is the same honesty. Silently hiding it teaches people the software is broken.

The op log already carries author as `{ kind, id, session }`, which is the seam a principal threads through. Attribution and authorisation should be the same fact seen twice, not two systems.
