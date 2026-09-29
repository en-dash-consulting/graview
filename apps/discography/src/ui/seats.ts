import type { Principal } from "@graview/core";

/** Who can sit at the keyboard: the label, an artist, a producer, and a fan with no role. */
export const SEATS = [
  { label: "Lena, the label", principal: { kind: "human", id: "user-lena", roles: ["label"] } },
  { label: "Mara Vey, artist", principal: { kind: "human", id: "user-mara", roles: ["artist"] } },
  { label: "June Arlo, producer", principal: { kind: "human", id: "user-june", roles: ["producer"] } },
  { label: "A fan", principal: { kind: "human", id: "user-fan", roles: [] } },
] as const satisfies readonly { label: string; principal: Principal }[];

/** `?as=user-june` sits somebody else down. */
export function openingSeat(): Principal {
  if (typeof window !== "undefined") {
    const asked = new URLSearchParams(window.location.search).get("as");
    const found = SEATS.find((seat) => seat.principal.id === asked);
    if (found) return found.principal;
  }
  return SEATS[0].principal;
}
