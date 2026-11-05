---
"@graview/tools": patch
---

The host's Answer slot hears and says what the app lacks (Roadmap f-answer-slot-could-not-find). `HostAi.couldNotFind` (0.1.66) reached only the Thinking slot: where a host answered the quick ask itself (`HostAi.answer`, Graview Cloud's when Jev is off), the request said nothing of it and the reply had no way to say what the app does not keep, so those apps logged no `lacks` in friction. Now, with `couldNotFind` set, `AnswerRequest.couldNotFind` carries the framework's own instruction, in words a model reads, to answer what the app does not keep rather than only that nothing was found; and an `AnswerReply` may say `lacks` — one whole sentence to the person, "This app keeps no budgets." — with the `need` that would hold it. The card says it in place of `text`, the friction log keeps it (`unanswered`, with `lacks`) and the host's callback is told it, as the Thinking path does; a `lacks` that is not a sentence for the person is said by code from the need.

The unit test `an-answer-slot-that-finds-nothing-says-what-the-app-lacks` holds both ways: told and saying it, and asked as before without `couldNotFind`.

Compatibility: the JavaScript API — new, optional: `AnswerRequest.couldNotFind`, `AnswerReply.lacks` and `AnswerReply.need`. Ops and primitives — unchanged. Stored formats — unchanged. The wire — unchanged. The declaration and check finding codes — unchanged. Derived tool names and input schemas — unchanged.

What Graview Cloud does: where its Answer slot is told `couldNotFind`, pass the instruction to its model and return the model's `lacks` (and `need`) on the reply.
