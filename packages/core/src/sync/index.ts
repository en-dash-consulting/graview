/*
 * `@graview/core/sync` — two-way sync on the op log: the engine, its
 * mappings, the conflict invariant, and the transports (Google Calendar, a
 * tool server over MCP).
 *
 * An entry of its own, not part of `@graview/core`: a hosted page imports the
 * main entry up front and draws without ever syncing, so the engine and its
 * transports are reached only by a host that runs one.
 */
export { googleCalendar, googleCalendarMapping } from "./google-calendar.js";
export type { Fetcher, GoogleCalendarOptions } from "./google-calendar.js";
export { syncConflictInvariant, SYNC_CONFLICTS } from "./conflict.js";
export type { SyncConflictOptions } from "./conflict.js";
export { SyncEngine } from "./engine.js";
export type { SettledConflict, SyncOptions, SyncReport } from "./engine.js";
export { allowTools, doorClient, mcpClient, mcpDoor, mcpRemote, sameOrigin } from "./mcp.js";
export type { DoorHeaders, DoorRequest, DoorResponse, McpClientOptions, McpDoorOptions, McpRemoteOptions, ToolCall } from "./mcp.js";
export { EMPTY_SYNC_STATE, systemAuthor } from "./types.js";
export type {
  ConflictPolicy,
  RemoteAck,
  RemoteChange,
  RemoteLink,
  RemoteSystem,
  RemoteWrite,
  ResourceMapping,
  SyncConflict,
  SyncMapping,
  SyncState,
} from "./types.js";
