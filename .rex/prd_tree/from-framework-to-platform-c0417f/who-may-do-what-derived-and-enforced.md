---
id: "fff3406f-43fe-40aa-8f99-10d45423f4f1"
level: "feature"
title: "Who may do what, derived and enforced"
status: "pending"
priority: "critical"
acceptanceCriteria:
  - "A principal with roles is part of the store's context, not a UI concern"
  - "The store refuses a mutation the principal may not run, and the tool runtime inherits that refusal without its own check"
  - "Derived affordances narrow to what the principal may do, with no per-app filtering code"
  - "An action withheld by permission is stated, not hidden, and names what would be needed"
  - "The generated agent tool schema contains only permitted mutations for that seat"
  - "graview check reports a mutation no role can ever run, and a role with no mutations"
description: "This fits the grain unusually well, which is why it is worth doing properly rather than bolting on.\n\nMutations already declare the kinds they act on. What can be done is already DERIVED rather than authored. So a permission model is another input to that derivation: a principal, some roles, and rules saying which mutations a role may run against which kinds — after which the interface hides what you cannot do for free, and an agent's generated tool surface narrows to the same set without anyone maintaining a second list.\n\nTWO THINGS THAT MUST NOT BE GOT WRONG:\n\nEnforcement belongs at the STORE, not in the interface. The tool runtime calls the same mutations a person does, so a check that lives in a React component is not a permission system, it is a suggestion — and the agent seat is the bypass.\n\nAn action you may not take should SAY SO rather than vanish. The framework already treats an empty action list as a result and explains it; \"you cannot do this, and here is who can\" is the same honesty. Silently hiding it teaches people the software is broken.\n\nThe op log already carries author as `{ kind, id, session }`, which is the seam a principal threads through. Attribution and authorisation should be the same fact seen twice, not two systems."
---
