import React from "react";
import { TypePlate } from "./TypePlate";

/** @deprecated Prefer TypePlate — kept as alias for compatibility. */
export const TitleCard: React.FC<{
  line: string;
  sub?: string;
  appearAt?: number;
  disappearAt?: number;
  align?: "center" | "bottom";
}> = ({ line, sub, appearAt, disappearAt, align = "bottom" }) => (
  <TypePlate
    line={line}
    sub={sub}
    appearAt={appearAt}
    disappearAt={disappearAt}
    align={align === "bottom" ? "lower-third" : "center"}
    voice="literary"
  />
);
