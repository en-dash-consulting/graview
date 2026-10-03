import type { Policy } from "@graview/core";

/**
 * WHO MAY DO WHAT on the programme, and most of it is refused.
 *
 * - the CHAIR runs the programme: everything.
 * - a REVIEWER decides on talks and says what they are about.
 * - a VOLUNTEER checks speakers in and looks after rooms — and is refused
 *   every other act, which on a talk is a dozen of them (W-115: every
 *   harness's narrower seat used to be refused three or fewer).
 * - the SCHEDULER, an agent, moves talks into slots and sessions into rooms.
 * - a visitor holds no role, and reads — the programme, not the staff
 *   behind it: who is on staff is the programme's own people's to see
 *   (`sees`), so the watch's "shown-what-is-not-theirs" has a seat to hold
 *   in every harness that sits the visitor down (the seventh walk).
 *
 * The acts are named rather than starred below the chair, so an act added
 * tomorrow is refused until somebody decides who may run it.
 */
export const policy: Policy = {
  roles: ["chair", "reviewer", "volunteer", "scheduler"],
  sees: [
    { roles: "*", kinds: ["talk", "speaker", "session", "workshop", "room", "topic"], describe: "The programme is everybody's to see." },
    { roles: ["chair", "reviewer", "volunteer", "scheduler"], kinds: ["staff"], describe: "The programme's own people see who is on staff." },
  ],
  grants: [
    { roles: ["chair"], mutations: "*", describe: "The programme chair runs the programme." },
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
