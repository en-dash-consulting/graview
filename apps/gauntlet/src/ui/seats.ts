import type { Principal } from "@graview/core";

/**
 * WHO CAN SIT AT THE KEYBOARD — and not one id is a name (W-114).
 *
 * Two humans with roles, a volunteer refused nearly everything (W-115), an
 * agent, and a visitor with no role. The ids are what an identity provider
 * hands over, which is never what a person reads; a surface that prints one
 * has printed a machine name.
 */
export const SEATS = [
  { label: "Ingrid Ødegård, programme chair", principal: { kind: "human", id: "u-4f1c9a", roles: ["chair"] } },
  { label: "Tomás Ó Briain, reviewer", principal: { kind: "human", id: "u-9b27e0", roles: ["reviewer"] } },
  { label: "Aiyana Whitehorse, volunteer", principal: { kind: "human", id: "u-02d8c4", roles: ["volunteer"] } },
  { label: "The scheduling assistant", principal: { kind: "agent", id: "agent-sched-7", roles: ["scheduler"] } },
  { label: "A visitor", principal: { kind: "human", id: "u-anon-0", roles: [] } },
] as const satisfies readonly { label: string; principal: Principal }[];

/** `?as=u-02d8c4` sits somebody else down. */
export function openingSeat(): Principal {
  if (typeof window !== "undefined") {
    const asked = new URLSearchParams(window.location.search).get("as");
    const found = SEATS.find((seat) => seat.principal.id === asked);
    if (found) return found.principal;
  }
  return SEATS[0].principal;
}
