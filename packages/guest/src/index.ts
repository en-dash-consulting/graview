export { connectGuest } from "./guest.js";
export type { ConnectGuestOptions, Guest } from "./guest.js";
export { GUEST_PROTOCOL, GUEST_SANDBOX, OPAQUE_ORIGIN, isGuestReady, isHostHello, navigateRequest } from "./protocol.js";
export type {
  GuestAct,
  GuestAnswer,
  GuestEdge,
  GuestDomEvent,
  GuestDroppedFile,
  GuestEvent,
  GuestFile,
  GuestFont,
  GuestNavigateTo,
  GuestNode,
  GuestPlace,
  GuestPressed,
  GuestProps,
  GuestTheme,
  GuestUnseen,
  GuestWhere,
  GuestReady,
  GuestRefusal,
  GuestRecordBox,
  GuestRequest,
  HostHello,
  HostMessage,
} from "./protocol.js";
