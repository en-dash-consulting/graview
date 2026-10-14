import type { Policy } from "@graview/core";

/**
 * WHO MAY DO WHAT on the program, and most of it is refused.
 *
 * - the CHAIR runs the program: everything.
 * - a REVIEWER decides on talks and says what they are about.
 * - a VOLUNTEER checks speakers in and looks after rooms — and is refused
 *   every other act, which on a talk is a dozen of them (W-115: every
 *   harness's narrower seat used to be refused three or fewer).
 * - the SCHEDULER, an agent, moves talks into slots and sessions into rooms.
 * - anybody may propose a talk, and change or take out only their own.
 * - a visitor holds no role, and reads — the program, not the staff
 *   behind it: who is on staff is the program's own people's to see
 *   (`sees`), so the watch's "shown-what-is-not-theirs" has a seat to hold
 *   in every harness that sits the visitor down (the seventh walk).
 *   And of a speaker, the visitor reads who they are and not where they
 *   come from: a sight that hides a field (Roadmap f-field-sight).
 *
 * The acts are named rather than starred below the chair, so an act added
 * tomorrow is refused until somebody decides who may run it.
 */
export const policy: Policy = {
  roles: ["chair", "reviewer", "volunteer", "scheduler"],
  sees: [
    { roles: "*", kinds: ["talk", "session", "workshop", "room", "topic"], describe: "The program is everybody's to see." },
    { roles: "*", kinds: ["speaker"], hide: ["country"], describe: "The speakers are everybody's to see, but not where they come from." },
    { roles: ["chair", "reviewer", "volunteer", "scheduler"], kinds: ["speaker"], describe: "The program's own people see where a speaker comes from." },
    { roles: ["chair", "reviewer", "volunteer", "scheduler"], kinds: ["staff"], describe: "The program's own people see who is on staff." },
  ],
  grants: [
    { roles: ["chair"], mutations: "*", describe: "The program chair runs the program." },
    /*
     * A call for papers is open to everybody: a door, not a key. Riding it,
     * a visitor may change or take out only a talk they submitted (the
     * ninth walk, W-201: "anybody may join" let a co-op's novice remove
     * her mentor).
     */
    { roles: "*", mutations: ["submit-talk"], describe: "Anybody may propose a talk." },
    {
      roles: ["reviewer"],
      mutations: ["accept-talk", "reject-talk", "tag", "untag"],
      kinds: ["talk"],
      describe: "A reviewer decides on talks and says what they are about.",
    },
    {
      roles: ["volunteer"],
      mutations: ["check-in"],
      kinds: ["speaker"],
      describe: "A volunteer checks speakers in at the desk.",
    },
    {
      roles: ["volunteer"],
      mutations: ["look-after", "stop-looking-after"],
      kinds: ["staff"],
      describe: "A volunteer says who looks after which room.",
    },
    {
      roles: ["scheduler"],
      mutations: ["schedule-talk", "unschedule-talk", "hold-in"],
      describe: "The scheduler gives talks their slots and sessions their rooms.",
    },
  ],
};
