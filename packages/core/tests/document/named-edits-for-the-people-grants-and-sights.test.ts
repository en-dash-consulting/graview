import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { diffDocuments, editDocument, EDIT_OPS, readDocument, type GraviewDocument } from "../../src/document/index.js";
import { compileDocument } from "../../src/check.js";

/**
 * NAMED EDITS FOR THE PEOPLE KIND, GRANTS AND SIGHTS (FR-170). `add-kind`
 * and `add-act` passed `people: true` and `$me` through, but nothing set
 * `people` on a kind already there and nothing touched the policy, so an
 * own-end grant or a sight via a relation could only be made by a raw JSON
 * patch, which a builder's form or a chat's change cannot offer as a named
 * change with a preview in words. `set-people`, `add-grant`, `remove-grant`,
 * `add-sight` and `remove-sight` are those changes, each said in the
 * declaration's words and judged as `graview check` judges what it makes.
 */
const fixture = (name: string): GraviewDocument => readDocument(JSON.parse(readFileSync(new URL(`./fixtures/${name}.gdd.json`, import.meta.url), "utf8"))).document!;
const santa = fixture("secret-santa");
const ideas = fixture("idea-board");
const vendors = fixture("vendors");

/** The document with no policy and no kind said to be the people: what a builder starts from. */
function unsaid(document: GraviewDocument): GraviewDocument {
  const { policy: _policy, ...rest } = structuredClone(document);
  for (const spec of Object.values(rest.kinds)) delete (spec as { people?: boolean }).people;
  return rest as GraviewDocument;
}

function edited(document: GraviewDocument, edits: readonly unknown[]) {
  const outcome = editDocument(document, edits);
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
  return outcome;
}
function refused(document: GraviewDocument, edits: readonly unknown[]) {
  const outcome = editDocument(document, edits);
  if (outcome.ok) throw new Error(`applied: ${outcome.said.join(" ")}`);
  return outcome.findings;
}

const SANTA_EDITS = [
  { op: "set-people", kind: "participant", people: true },
  { op: "add-grant", roles: ["organizer"], mutations: "*" },
  { op: "add-grant", roles: ["participant"], mutations: ["edit-participant"], kinds: ["participant"], self: true, describe: "Anyone may change their own wish." },
  { op: "add-sight", roles: "*", kinds: ["participant"] },
  { op: "add-sight", roles: ["organizer"], kinds: ["match"] },
  { op: "add-sight", roles: ["participant"], kinds: ["match"], via: "givenBy" },
];
const IDEA_EDITS = [
  { op: "set-people", kind: "member", people: true },
  { op: "add-grant", roles: "*", mutations: ["add-idea", "vote-for", "champion"] },
  { op: "add-grant", roles: "*", mutations: ["take-back"], ownEnd: true, describe: "A vote is taken back only by whoever cast it." },
];

describe("named edits for the people kind, grants and sights", () => {
  it("are in the vocabulary", () => {
    for (const op of ["set-people", "add-grant", "remove-grant", "add-sight", "remove-sight"]) expect(EDIT_OPS).toContain(op);
  });

  it("make the secret santa's people, grants and sights from nothing, equal to the fixture's, and it checks clean", () => {
    const outcome = edited(unsaid(santa), SANTA_EDITS);
    expect(outcome.document.policy).toEqual(santa.policy);
    expect(outcome.document.kinds["participant"]!.people).toBe(true);
    expect(outcome.document.kinds["match"]!.people).toBeUndefined();
    const compiled = compileDocument(outcome.document);
    expect(compiled.findings.filter((finding) => finding.severity === "error")).toEqual([]);
  });

  it("make the idea board's people and grants from nothing, equal to the fixture's, and it checks clean", () => {
    const outcome = edited(unsaid(ideas), IDEA_EDITS);
    expect(outcome.document.policy).toEqual(ideas.policy);
    expect(outcome.document.kinds["member"]!.people).toBe(true);
    const compiled = compileDocument(outcome.document);
    expect(compiled.findings.filter((finding) => finding.severity === "error")).toEqual([]);
  });

  it("say what each did in the declaration's words: nouns, plurals, act titles and relation names, never an act's id", () => {
    expect(edited(unsaid(santa), SANTA_EDITS).said).toEqual([
      "Participants are now the people who sign in: a participant whose id is someone's is that person.",
      "The app gets a policy: from now on, only what a grant gives is allowed.",
      "An organizer may do anything.",
      'A participant may "Change the participant" on participants, only on their own record: "Anyone may change their own wish."',
      "From now on, a kind no sight names is seen by nobody but the system.",
      "Everyone sees participants.",
      "An organizer sees matches.",
      'A participant sees matches, only those "givenBy" joins to their own participant.',
    ]);
    expect(edited(unsaid(ideas), IDEA_EDITS).said).toEqual([
      "Members are now the people who sign in: a member whose id is someone's is that person.",
      "The app gets a policy: from now on, only what a grant gives is allowed.",
      'Everyone may "Add an idea", "Vote for it" and "Champion it".',
      'Everyone may "Take back a vote", only where they are the member at the other end of the link: "A vote is taken back only by whoever cast it."',
    ]);
  });

  it("are previewed in the same words: the change's diff says each sentence its edit said", () => {
    for (const [document, edits] of [
      [santa, SANTA_EDITS],
      [ideas, IDEA_EDITS],
    ] as const) {
      const outcome = edited(unsaid(document), edits);
      const preview = diffDocuments(unsaid(document), outcome.document);
      expect(preview.breaking).toBe(false);
      expect(preview.sentences).toEqual(outcome.said);
    }
    const removed = edited(santa, [{ op: "remove-grant", roles: ["organizer"], mutations: "*" }, { op: "remove-sight", roles: ["participant"], kinds: ["match"] }]);
    expect(diffDocuments(santa, removed.document).sentences).toEqual(removed.said);
  });
});

describe("set-people", () => {
  it("refuses a second kind of people with a sentence: an app has exactly one", () => {
    const [finding] = refused(ideas, [{ op: "set-people", kind: "idea", people: true }]);
    expect(finding).toMatchObject({ code: "people-ambiguous", path: "edits.0.kind", message: "members are already the people who sign in, and an app has one kind for them" });
    expect(finding!.fix).toBe('{"op": "set-people", "kind": "member", "people": false} first, in the same change');
  });

  it("moves the people from one kind to another in one change: off, then on", () => {
    const outcome = edited(vendors, [{ op: "set-people", kind: "vendor", people: true }]);
    const moved = edited(outcome.document, [
      { op: "set-people", kind: "vendor", people: false },
      { op: "set-people", kind: "category", people: true },
    ]);
    expect(moved.said).toEqual(["Vendors are no longer the people who sign in.", "Categories are now the people who sign in: a category whose id is someone's is that person."]);
    expect(moved.document.kinds["vendor"]!.people).toBeUndefined();
    expect(moved.document.kinds["category"]!.people).toBe(true);
  });

  it("off clears it, and says so when there was nothing to clear", () => {
    expect(edited(vendors, [{ op: "set-people", kind: "vendor", people: false }]).said).toEqual(["Vendors were not the people who sign in."]);
    expect(edited(ideas, [{ op: "set-people", kind: "member", people: true }]).said).toEqual(["Members are already the people who sign in."]);
  });

  it("off is refused while the policy reads a person's own record and no kind is left to be the people (people-unsaid)", () => {
    const [finding] = refused(santa, [{ op: "set-people", kind: "participant", people: false }]);
    expect(finding).toMatchObject({ code: "people-unsaid", path: "edits.0" });
    expect(finding!.message).toBe("a sight via a relation reads each person's own record, and no kind is the people who sign in");
  });

  it("a move that leaves a sight's relation short of the new people is refused (sight-via-misses-people)", () => {
    const [finding] = refused(santa, [
      { op: "set-people", kind: "participant", people: false },
      { op: "set-people", kind: "match", people: true },
    ]);
    expect(finding).toMatchObject({ code: "sight-via-misses-people", path: "edits.1" });
    expect(finding!.message).toBe('"givenBy" never joins matches to matches, so the sight shows no match to anyone');
  });
});

describe("add-grant and remove-grant", () => {
  it("refuses an act, a kind or a relation the app does not have, by its name and what it has", () => {
    expect(refused(ideas, [{ op: "add-grant", roles: "*", mutations: ["delete-idea"] }])[0]).toMatchObject({ code: "grant-act", path: "edits.0.mutations.0" });
    expect(refused(ideas, [{ op: "add-grant", roles: "*", mutations: ["edit-vote"] }])[0]).toMatchObject({ code: "grant-act", path: "edits.0.mutations.0" });
    expect(refused(ideas, [{ op: "add-grant", roles: "*", mutations: "*", kinds: ["vote"] }])[0]).toMatchObject({ path: "edits.0.kinds.0" });
    expect(refused(ideas, [{ op: "add-grant", roles: "*", mutations: "*", whatever: true }])[0]).toMatchObject({ path: "edits.0" });
  });

  it("a role the app has not declared becomes one of its roles, and says so", () => {
    const outcome = edited(santa, [{ op: "add-grant", roles: ["elf"], mutations: ["draw"] }]);
    expect(outcome.document.roles).toEqual(["organizer", "participant", "elf"]);
    expect(outcome.said).toEqual(["An elf is a new role.", 'An elf may "Draw a match".']);
    expect(diffDocuments(santa, outcome.document).sentences).toEqual(outcome.said);
  });

  it("holds an own-end grant to an act that takes the record at the far end of a link (grant-own-end-without-link)", () => {
    const every = refused(ideas, [{ op: "add-grant", roles: "*", mutations: "*", ownEnd: true }])[0]!;
    expect(every).toMatchObject({ code: "grant-own-end-without-link", path: "edits.0" });
    expect(every.message).toBe("a grant held to a person's own end of a link names every act, and most link nothing");
    const noLink = refused(ideas, [{ op: "add-grant", roles: "*", mutations: ["champion"], ownEnd: true }])[0]!;
    expect(noLink.message).toBe('"Champion it" connects and severs nothing, so a grant held to a person\'s own end of a link has no end to hold');
    const toMe = refused(ideas, [{ op: "add-grant", roles: "*", mutations: ["vote-for"], ownEnd: true }])[0]!;
    expect(toMe.message).toBe('"Vote for it" takes no record at the other end of what it links, so a grant held to a person\'s own end of it is never met');
  });

  it("a first grant on an app with no policy says that from now on only what a grant gives is allowed", () => {
    const outcome = edited(unsaid(vendors), [{ op: "add-grant", roles: ["owner"], mutations: "*" }]);
    expect(outcome.said[0]).toBe("The app gets a policy: from now on, only what a grant gives is allowed.");
  });

  it("remove-grant names the grant by what it says, in any order, keys left out matching any", () => {
    const outcome = edited(ideas, [{ op: "remove-grant", roles: "*", mutations: ["champion", "add-idea", "vote-for"] }]);
    expect(outcome.document.policy!.grants).toEqual([ideas.policy!.grants[1]]);
    expect(outcome.said).toEqual(['The grant is removed that said everyone may "Add an idea", "Vote for it" and "Champion it".']);
  });

  it("remove-grant refuses two grants it could mean, and asks for the key that tells them apart", () => {
    const two = edited(ideas, [{ op: "add-grant", roles: "*", mutations: ["take-back"] }]).document;
    const [finding] = refused(two, [{ op: "remove-grant", roles: "*", mutations: ["take-back"] }]);
    expect(finding).toMatchObject({ path: "edits.0", message: '2 grants say everyone may "Take back a vote"' });
    expect(finding!.fix).toBe("say ownEnd, self, kinds or describe as the one to remove says them");
    const kept = edited(two, [{ op: "remove-grant", roles: "*", mutations: ["take-back"], ownEnd: false }]);
    expect(kept.document.policy!.grants).toEqual(ideas.policy!.grants);
  });

  it("remove-grant refuses a grant there is not, and says the ones there are", () => {
    const [finding] = refused(ideas, [{ op: "remove-grant", roles: "*", mutations: ["champion"] }]);
    expect(finding!.message).toBe('no grant says everyone may "Champion it"; the grants say everyone may "Add an idea", "Vote for it" and "Champion it"; and everyone may "Take back a vote", only where they are the member at the other end of the link');
  });

  it("the last grant removed leaves a policy that gives nothing, and says so", () => {
    const outcome = edited(vendors, [{ op: "remove-grant", roles: ["owner", "planner"], mutations: "*" }]);
    expect(outcome.document.policy).toEqual({ grants: [] });
    expect(outcome.said).toEqual(["The grant is removed that said an owner or a planner may do anything.", "No grant is left, so nobody but the system may do anything."]);
  });
});

describe("add-sight and remove-sight", () => {
  it("refuses a sight via a relation no kind has (sight-via-unknown-edge), or one that never reaches the people (sight-via-misses-people)", () => {
    expect(refused(santa, [{ op: "add-sight", roles: ["participant"], kinds: ["match"], via: "wrappedBy" }])[0]).toMatchObject({ code: "sight-via-unknown-edge", path: "edits.0", message: 'no kind has a relation "wrappedBy", so a sight via it shows nothing' });
    const ideasSeen = edited(ideas, [{ op: "add-sight", roles: "*", kinds: ["member"] }]).document;
    const [misses] = refused(ideasSeen, [{ op: "add-sight", roles: "*", kinds: ["member"], via: "votedBy" }]);
    expect(misses).toMatchObject({ code: "sight-via-misses-people", path: "edits.0", message: '"votedBy" never joins members to members, so the sight shows no member to anyone' });
  });

  it("refuses a sight via a relation while no kind is the people (people-unsaid)", () => {
    const [finding] = refused(unsaid(santa), [{ op: "add-sight", roles: ["participant"], kinds: ["match"], via: "givenBy" }]);
    expect(finding).toMatchObject({ code: "people-unsaid", path: "edits.0" });
    expect(finding!.fix).toBe('{"op": "set-people", "kind": "<the kind whose records are the people>", "people": true}');
  });

  it("a first sight on an app with no policy keeps every act open: everyone may still do anything", () => {
    const outcome = edited(unsaid(vendors), [{ op: "add-sight", roles: "*", kinds: ["vendor", "category"] }]);
    expect(outcome.document.policy).toEqual({ grants: [{ roles: "*", mutations: "*" }], sees: [{ roles: "*", kinds: ["vendor", "category"] }] });
    expect(outcome.said).toEqual(["The app gets a policy: from now on, only what a grant gives is allowed.", "Everyone may do anything.", "From now on, a kind no sight names is seen by nobody but the system.", "Everyone sees vendors and categories."]);
    expect(diffDocuments(unsaid(vendors), outcome.document).sentences).toEqual(outcome.said);
  });

  it("remove-sight names the sight by its roles and kinds, a via or own left out matching any", () => {
    const outcome = edited(santa, [{ op: "remove-sight", roles: ["participant"], kinds: ["match"] }]);
    expect(outcome.document.policy!.sees).toEqual(santa.policy!.sees!.slice(0, 2));
    expect(outcome.said).toEqual(['The sight is removed that showed a participant matches, only those "givenBy" joins to their own participant.']);
  });

  it("the last sight removed takes the sights away, and everyone sees everything", () => {
    const outcome = edited(santa, [
      { op: "remove-sight", roles: "*", kinds: ["participant"] },
      { op: "remove-sight", roles: ["organizer"], kinds: ["match"] },
      { op: "remove-sight", roles: ["participant"], kinds: ["match"], via: "givenBy" },
    ]);
    expect(outcome.document.policy!.sees).toBeUndefined();
    expect(outcome.said.at(-1)).toBe("With no sight left, everyone sees everything.");
  });

  it("remove-sight refuses a sight there is not, and says the ones there are", () => {
    const [finding] = refused(santa, [{ op: "remove-sight", roles: ["organizer"], kinds: ["participant"] }]);
    expect(finding!.message).toBe('no sight shows an organizer participants; the sights show everyone participants; an organizer matches; and a participant matches, only those "givenBy" joins to their own participant');
  });
});

/*
 * WHAT THE OLDER EDITS DO TO A GRANT AND A SIGHT. Removing a kind took it
 * out of every sight and dropped a sight left showing nothing — and when
 * that was the last sight, every other kind came to be seen by everyone,
 * which the edit never said. A grant left on no kind read as a grant on
 * every kind, and a grant on the kind's derived edit named an act that was
 * gone, so the change failed the check it was previewed by.
 */
describe("remove-kind and the policy", () => {
  it("is refused when it would take the last sight away, which would show everyone everything", () => {
    const matchesOnly: GraviewDocument = { ...santa, policy: { ...santa.policy!, sees: [santa.policy!.sees![1]!] } };
    const [finding] = refused(matchesOnly, [{ op: "remove-kind", kind: "match" }]);
    expect(finding).toMatchObject({ path: "edits.0.kind", message: "every sight shows only matches, so with them gone everyone would see everything" });
    const said = edited(matchesOnly, [{ op: "remove-sight", roles: ["organizer"], kinds: ["match"] }, { op: "remove-kind", kind: "match" }]).said;
    expect(said).toContain("With no sight left, everyone sees everything.");
  });

  it("takes a grant on the kind's derived edit with it, and a grant left on no kind, so what is left checks clean", () => {
    const outcome = edited(santa, [
      { op: "set-people", kind: "participant", people: false },
      { op: "remove-sight", roles: ["participant"], kinds: ["match"] },
      { op: "remove-kind", kind: "participant" },
    ]);
    expect(outcome.document.policy!.grants).toEqual([santa.policy!.grants[0]]);
    expect(compileDocument(outcome.document).findings.filter((finding) => finding.severity === "error")).toEqual([]);
    expect(diffDocuments(santa, outcome.document).sentences).toContain('The grant is removed that said a participant may "Change the participant" on participants, only on their own record.');
  });
});

describe("a grant on no kind", () => {
  it("is refused as an edit, since it gives nothing", () => {
    expect(refused(santa, [{ op: "add-grant", roles: ["participant"], mutations: ["draw"], kinds: [] }])[0]).toMatchObject({ path: "edits.0.kinds", message: "a grant on no kind gives nothing" });
  });

  it("is said as giving nothing where a document holds one, never as a grant on every kind", () => {
    const before = { ...santa, policy: { ...santa.policy!, grants: [santa.policy!.grants[0]!] } };
    const after = { ...santa, policy: { ...santa.policy!, grants: [santa.policy!.grants[0]!, { roles: ["participant"], mutations: ["draw"], kinds: [] }] } };
    expect(diffDocuments(before, after).sentences).toEqual(['A participant may "Draw a match" on no kind, so on nothing.']);
  });
});

describe("the preview of who may do what", () => {
  it("says a role taken away, beside what else changed", () => {
    const after = { ...santa, roles: ["organizer"], policy: { ...santa.policy!, grants: [santa.policy!.grants[0]!] } };
    expect(diffDocuments(santa, after).sentences).toContain("A participant is no longer a role.");
  });

  it("says a new policy that gives nothing gives nothing", () => {
    expect(diffDocuments(unsaid(vendors), { ...unsaid(vendors), policy: { grants: [] } }).sentences).toEqual([
      "The app gets a policy: from now on, only what a grant gives is allowed.",
      "No grant is left, so nobody but the system may do anything.",
    ]);
  });
});
